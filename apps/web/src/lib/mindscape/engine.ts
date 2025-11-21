import { CELL_HEIGHT, CELL_WIDTH, GLYPH_SET, signalToCharIndex } from "./math";
import { MindscapeRenderer } from "./renderer";

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<{
    charging: boolean;
    level: number;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  }>;
}

export class MindscapeEngine {
  private readonly canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | CanvasRenderingContext2D | null = null;
  private isWebGPU = false;
  private isRunning = false;
  private animationFrameId: number | null = null;
  private isLowPowerMode = false;

  private renderer: MindscapeRenderer | null = null;

  // Physics State
  private time = 0;
  private lastFrameTime = 0;
  private readonly mouse: Float32Array = new Float32Array([0, 0]);
  private readonly resizeObserver: ResizeObserver;

  // Audio State
  private audioContext: AudioContext | null = null;
  private analyzer: AnalyserNode | null = null;
  private audioData: Uint8Array | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private audioLow = 0;
  private audioMid = 0;

  // Transition Params (Current)
  private readonly currentParams = {
    f1: 10.0,
    f2: 8.0,
    f3: 13.0,
    tint_h: 0.0,
    tint_c: 0.0,
    flow_speed: 1.0,
  };

  // Target Params (Based on State)
  private targetParams = {
    f1: 10.0,
    f2: 8.0,
    f3: 13.0,
    tint_h: 0.0,
    tint_c: 0.0,
    flow_speed: 1.0,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Setup resize observer
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);

    // Interaction
    window.addEventListener("mousemove", this.handleMouseMove);

    this.checkBatteryStatus();
    this.init();
  }

  private readonly handleMouseMove = (e: MouseEvent) => {
    // Normalized mouse -1 to 1
    this.mouse[0] = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse[1] = (e.clientY / window.innerHeight) * 2 - 1;
  };

  private async checkBatteryStatus() {
    if (typeof navigator === "undefined") {
      return;
    }
    const nav = navigator as NavigatorWithBattery;

    if (nav.getBattery) {
      try {
        const battery = await nav.getBattery();
        const updatePowerMode = () => {
          // < 20% and not charging = Low Power
          this.isLowPowerMode = !battery.charging && battery.level < 0.2;

          // Trigger resize to update DPR if needed
          this.handleResize();
        };

        updatePowerMode();
        battery.addEventListener("levelchange", updatePowerMode);
        battery.addEventListener("chargingchange", updatePowerMode);
      } catch (_e) {
        // Ignore battery API errors
      }
    }
  }

  async init() {
    if (navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: "high-performance",
        });
        if (adapter) {
          const device = await adapter.requestDevice();
          this.initWebGPU(device);
          this.handleResize();
          return;
        }
      } catch (_e) {}
    }

    // Fallback to 2D Canvas
    this.initCanvas2D();
    this.handleResize();
  }

  private initWebGPU(device: GPUDevice) {
    this.isWebGPU = true;
    const ctx = this.canvas.getContext("webgpu");

    if (!ctx) {
      this.initCanvas2D();
      return;
    }
    this.context = ctx;

    this.renderer = new MindscapeRenderer(device, this.canvas, ctx);

    // Phase 7: Pre-warm shader
    try {
      this.renderer.render(0);
    } catch (_e) {}

    this.start();
  }

  private initCanvas2D() {
    this.isWebGPU = false;
    this.context = this.canvas.getContext("2d", { alpha: false });
    this.start();
  }

  private handleResize() {
    // Ensure canvas matches display size for sharp rendering
    const dpr = this.isLowPowerMode ? 1 : window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    // Use physical pixels for width/height to match device
    const width = Math.floor(rect.width * dpr);
    const height = Math.floor(rect.height * dpr);

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;

      if (this.isWebGPU && this.renderer) {
        this.renderer.resize(width, height);
      } else if (!this.isWebGPU && this.context) {
        // For 2D, we usually scale the context to handle DPR automatically
        // OR we just draw bigger.
        // Since we do manual drawing loop, drawing bigger is better for sharpness.
        // We don't need context.scale if we just fillRect/fillText with larger coords.
        // But `fillText` size depends on font size.
        // If we change canvas size, we need to scale font size or use scale().

        // Let's use context.scale so logical coords work.
        const ctx = this.context as CanvasRenderingContext2D;
        ctx.resetTransform(); // Reset before scaling
        ctx.scale(dpr, dpr);
      }
    }
  }

  start() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  destroy() {
    this.stop();
    this.resizeObserver.disconnect();
    window.removeEventListener("mousemove", this.handleMouseMove);

    if (this.audioContext) {
      this.audioContext.close();
    }
    if (this.audioSource) {
      this.audioSource.disconnect();
    }
  }

  async enableAudio() {
    if (this.audioContext) {
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      return;
    }

    try {
      this.audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      this.analyzer = this.audioContext.createAnalyser();
      this.analyzer.fftSize = 256;
      this.audioData = new Uint8Array(this.analyzer.frequencyBinCount);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioSource = this.audioContext.createMediaStreamSource(stream);
      this.audioSource.connect(this.analyzer);
    } catch (_e) {}
  }

  setAgentState(state: "idle" | "listening" | "processing" | "speaking") {
    switch (state) {
      case "idle":
        this.agentState = 0;
        this.targetParams = {
          f1: 10.0,
          f2: 8.0,
          f3: 13.0,
          tint_h: 0.0,
          tint_c: 0.0,
          flow_speed: 1.0,
        };
        break;
      case "listening":
        this.agentState = 1;
        this.targetParams = {
          f1: 12.0,
          f2: 10.0,
          f3: 15.0,
          tint_h: 150.0,
          tint_c: 0.1,
          flow_speed: 1.2,
        };
        break;
      case "processing":
        this.agentState = 2;
        this.targetParams = {
          f1: 23.0,
          f2: 19.0,
          f3: 29.0,
          tint_h: 240.0,
          tint_c: 0.15,
          flow_speed: 3.0,
        };
        break;
      case "speaking":
        this.agentState = 3;
        this.targetParams = {
          f1: 5.0,
          f2: 4.0,
          f3: 7.0,
          tint_h: 300.0,
          tint_c: 0.1,
          flow_speed: 0.8,
        };
        break;
    }
  }

  triggerWarp() {
    // Visual effect: Speed up time significantly
    const _warpLoop = () => {
      if (!this.isRunning) {
        return;
      }
      this.time += 0.1; // Much faster than 0.016
      requestAnimationFrame(_warpLoop);
    };
    // We don't actually need a separate loop, just modify the time increment in the main loop
    // But we need a flag.
    this.isWarping = true;
  }

  private isWarping = false;

  private loop(timestamp = 0) {
    if (!this.isRunning) {
      return;
    }

    // Frame limiting for Low Power Mode (30fps)
    if (this.isLowPowerMode) {
      const elapsed = timestamp - this.lastFrameTime;
      if (elapsed < 33) {
        // ~30fps
        this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
        return;
      }
    }
    this.lastFrameTime = timestamp;

    const delta = this.isWarping ? 0.2 : 0.016;
    this.time += delta;

    // Process Audio (Split Bands)
    if (this.analyzer && this.audioData) {
      this.analyzer.getByteFrequencyData(this.audioData);

      const binCount = this.audioData.length;
      // Lows: 0 - 20% (Bass)
      // Mids: 20% - 60% (Voice)
      const lowBins = Math.floor(binCount * 0.2);
      const midBins = Math.floor(binCount * 0.6);

      let sumLow = 0;
      for (let i = 0; i < lowBins; i++) {
        sumLow += this.audioData[i];
      }

      let sumMid = 0;
      for (let i = lowBins; i < midBins; i++) {
        sumMid += this.audioData[i];
      }

      const avgLow = sumLow / lowBins / 255.0;
      const avgMid = sumMid / (midBins - lowBins) / 255.0;

      this.audioLow = Math.max(avgLow, this.audioLow * 0.9);
      this.audioMid = Math.max(avgMid, this.audioMid * 0.9);
    }

    // Smooth Transitions (Lerp)
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const speed = 0.05; // Transition speed

    this.currentParams.f1 = lerp(
      this.currentParams.f1,
      this.targetParams.f1,
      speed
    );
    this.currentParams.f2 = lerp(
      this.currentParams.f2,
      this.targetParams.f2,
      speed
    );
    this.currentParams.f3 = lerp(
      this.currentParams.f3,
      this.targetParams.f3,
      speed
    );
    this.currentParams.tint_h = lerp(
      this.currentParams.tint_h,
      this.targetParams.tint_h,
      speed
    );
    this.currentParams.tint_c = lerp(
      this.currentParams.tint_c,
      this.targetParams.tint_c,
      speed
    );
    this.currentParams.flow_speed = lerp(
      this.currentParams.flow_speed,
      this.targetParams.flow_speed,
      speed
    );

    if (this.isWebGPU && this.renderer) {
      this.renderer.render(
        this.time,
        this.mouse,
        this.audioLow,
        this.audioMid,
        this.currentParams.f1,
        this.currentParams.f2,
        this.currentParams.f3,
        this.currentParams.tint_h,
        this.currentParams.tint_c,
        this.currentParams.flow_speed
      );
    } else {
      this.renderCanvas2D();
    }

    this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  private renderCanvas2D() {
    const ctx = this.context as CanvasRenderingContext2D;
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    // Clear background - The Void
    ctx.fillStyle = "oklch(0.05 0 0)";
    ctx.fillRect(0, 0, width, height);

    // Font settings
    ctx.font = `${CELL_HEIGHT}px monospace`;
    ctx.textBaseline = "top";

    const cols = Math.ceil(width / CELL_WIDTH);
    const rows = Math.ceil(height / CELL_HEIGHT);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Normalized coordinates
        const u = x / cols;
        const v = y / rows;

        // Interference Pattern (Matches WGSL/Plan)
        // S(x,y,t) = sin(x*f1 + t) + sin(y*f2 - t) + sin((x+y)*f3)
        let f1 = this.currentParams.f1;
        let f2 = this.currentParams.f2;
        const f3 = this.currentParams.f3;

        // Modulate Frequencies with Audio (Mid/Voice)
        f1 += this.audioMid * 5.0;
        f2 += this.audioMid * 5.0;

        // Temporal Distortion
        const t = this.time * 0.5 * this.currentParams.flow_speed;

        const interference =
          Math.sin(u * f1 + t) + Math.sin(v * f2 - t) + Math.sin((u + v) * f3);

        // Normalize (-3 to 3 -> 0 to 1)
        let intensity = (interference + 3.0) / 6.0;

        // Add Audio Pulse
        intensity += this.audioMid * 0.3; // Boost brightness on beat

        // Exponential curve for Void aesthetic
        intensity **= 3.0;

        const charIndex = signalToCharIndex(intensity, GLYPH_SET.length);
        const char = GLYPH_SET[charIndex];

        if (char !== " ") {
          // Color Grading
          // Use audioMid to boost chroma
          const tint_c = this.currentParams.tint_c + this.audioMid * 0.1;

          const l = 0.05 + intensity * (0.99 - 0.05);
          const c = l * 0.5 + tint_c;
          const h = this.currentParams.tint_h;

          // OKLCH to RGB string
          ctx.fillStyle = `oklch(${l} ${c} ${h})`;
          ctx.fillText(char, x * CELL_WIDTH, y * CELL_HEIGHT);
        }
      }
    }
  }
}
