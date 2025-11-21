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
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | CanvasRenderingContext2D | null = null;
  private isWebGPU: boolean = false;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private isLowPowerMode: boolean = false;

  private renderer: MindscapeRenderer | null = null;

  // Physics State
  private time: number = 0;
  private lastFrameTime: number = 0;
  private mouse: Float32Array = new Float32Array([0, 0]);
  private resizeObserver: ResizeObserver;

  // Audio State
  private audioContext: AudioContext | null = null;
  private analyzer: AnalyserNode | null = null;
  private audioData: Uint8Array | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private audioIntensity: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    
    // Setup resize observer
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);

    // Interaction
    window.addEventListener('mousemove', this.handleMouseMove);
    
    this.checkBatteryStatus();
    this.init();
  }

  private handleMouseMove = (e: MouseEvent) => {
    // Normalized mouse -1 to 1
    this.mouse[0] = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse[1] = (e.clientY / window.innerHeight) * 2 - 1;
  };

  private async checkBatteryStatus() {
    if (typeof navigator === "undefined") return;
    const nav = navigator as NavigatorWithBattery;
    
    if (nav.getBattery) {
        try {
            const battery = await nav.getBattery();
            const updatePowerMode = () => {
                // < 20% and not charging = Low Power
                this.isLowPowerMode = (!battery.charging && battery.level < 0.2);
                
                // Trigger resize to update DPR if needed
                this.handleResize();
            };
            
            updatePowerMode();
            battery.addEventListener('levelchange', updatePowerMode);
            battery.addEventListener('chargingchange', updatePowerMode);
        } catch (e) {
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
      } catch (e) {
        console.warn("WebGPU initialization failed, falling back to Canvas 2D", e);
      }
    }
    
    // Fallback to 2D Canvas
    this.initCanvas2D();
    this.handleResize();
  }

  private initWebGPU(device: GPUDevice) {
    console.log("Initializing Mindscape with WebGPU");
    this.isWebGPU = true;
    const ctx = this.canvas.getContext("webgpu");
    
    if (!ctx) {
      console.error("Failed to get WebGPU context");
      this.initCanvas2D();
      return;
    }
    this.context = ctx;

    this.renderer = new MindscapeRenderer(device, this.canvas, ctx);
    
    // Phase 7: Pre-warm shader
    try {
        this.renderer.render(0);
    } catch (e) {
        console.warn("Shader pre-warm failed", e);
    }

    this.start();
  }

  private initCanvas2D() {
    console.log("Initializing Mindscape with Canvas 2D");
    this.isWebGPU = false;
    this.context = this.canvas.getContext("2d", { alpha: false });
    this.start();
  }

  private handleResize() {
    // Ensure canvas matches display size for sharp rendering
    const dpr = this.isLowPowerMode ? 1 : (window.devicePixelRatio || 1);
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
    if (this.isRunning) return;
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
    window.removeEventListener('mousemove', this.handleMouseMove);
    
    if (this.audioContext) {
        this.audioContext.close();
    }
    if (this.audioSource) {
        this.audioSource.disconnect();
    }
  }

  async enableAudio() {
    if (this.audioContext) return;

    try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = 256;
        this.audioData = new Uint8Array(this.analyzer.frequencyBinCount);

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioSource = this.audioContext.createMediaStreamSource(stream);
        this.audioSource.connect(this.analyzer);
        console.log("Audio input enabled for Mindscape");
    } catch (e) {
        console.warn("Failed to enable audio input for Mindscape", e);
    }
  }
  
  triggerWarp() {
    console.log("Warp triggered");
    // Visual effect: Speed up time significantly
    const warpLoop = () => {
        if (!this.isRunning) return;
        this.time += 0.1; // Much faster than 0.016
        requestAnimationFrame(warpLoop);
    };
    // We don't actually need a separate loop, just modify the time increment in the main loop
    // But we need a flag.
    this.isWarping = true;
  }
  
  private isWarping: boolean = false;

  private loop(timestamp: number = 0) {
    if (!this.isRunning) return;

    // Frame limiting for Low Power Mode (30fps)
    if (this.isLowPowerMode) {
        const elapsed = timestamp - this.lastFrameTime;
        if (elapsed < 33) { // ~30fps
             this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
             return;
        }
    }
    this.lastFrameTime = timestamp;

    const delta = this.isWarping ? 0.2 : 0.016;
    this.time += delta;

    // Process Audio
    if (this.analyzer && this.audioData) {
        this.analyzer.getByteFrequencyData(this.audioData);
        // Calculate average intensity (0-1)
        let sum = 0;
        // Focus on bass/mids (first half of bins)
        const bins = this.audioData.length / 2;
        for (let i = 0; i < bins; i++) {
            sum += this.audioData[i];
        }
        const avg = sum / bins / 255.0;
        // Smooth decay
        this.audioIntensity = Math.max(avg, this.audioIntensity * 0.9);
    }

    if (this.isWebGPU && this.renderer) {
      this.renderer.render(this.time, this.mouse, this.audioIntensity);
    } else {
      this.renderCanvas2D();
    }

    this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  private renderWebGPU() {
    // Moved to renderer.render()
  }

  private renderCanvas2D() {
    const ctx = this.context as CanvasRenderingContext2D;
    if (!ctx) return;

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
        const f1 = 10.0;
        const f2 = 8.0;
        const f3 = 13.0;
        
        // Audio Reactivity: Modify Time and Frequencies
        const t = this.time + this.audioIntensity * 5.0; // Speed up with audio
        
        const interference = Math.sin(u * f1 + t) + 
                             Math.sin(v * f2 - t) + 
                             Math.sin((u + v) * f3);
        
        // Normalize (-3 to 3 -> 0 to 1)
        let intensity = (interference + 3.0) / 6.0;
        
        // Add Audio Pulse
        intensity += this.audioIntensity * 0.3; // Boost brightness on beat
        
        // Exponential curve for Void aesthetic
        intensity = Math.pow(intensity, 3.0);
        
        const charIndex = signalToCharIndex(intensity, GLYPH_SET.length);
        const char = GLYPH_SET[charIndex];

        if (char !== ' ') {
            // Grayscale / White mapping
            const l = 0.05 + intensity * (0.99 - 0.05);
            // Use l for r,g,b (grayscale)
            ctx.fillStyle = `oklch(${l} 0 0)`; 
            ctx.fillText(char, x * CELL_WIDTH, y * CELL_HEIGHT);
        }
      }
    }
  }
}

