/**
 * Cortex Engine
 *
 * Main WebGPU rendering engine for ALFRED Mindscape.
 * Manages render systems, frame graph, and 4D coordinate transforms.
 */

import type { Camera, GlobalUniforms, OrbConfig, RenderSystem } from "./types";

import { BufferPool, UniformBuffer } from "./buffer";
import {
  createCamera,
  createTemporalState,
  type TemporalState,
} from "./coordinate";
import { LODManager } from "./lod";

/**
 * Engine configuration
 */
export interface CortexConfig {
  /** Canvas element to render to */
  canvas: HTMLCanvasElement;
  /** Enable post-processing effects */
  postProcessing?: boolean;
  /** Custom LOD manager */
  lodManager?: LODManager;
}

/**
 * Engine state
 */
export type EngineState = "uninitialized" | "initializing" | "ready" | "error";

/**
 * Cortex Engine - WebGPU rendering engine for ALFRED Mindscape
 */
export class CortexEngine {
  private readonly canvas: HTMLCanvasElement;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = "bgra8unorm";

  private readonly systems: Map<string, RenderSystem> = new Map();
  private bufferPool: BufferPool | null = null;
  private uniformBuffer: UniformBuffer | null = null;

  private readonly lodManager: LODManager;
  private readonly camera: Camera;
  private readonly temporal: TemporalState;

  private lastFrameTime = 0;
  private running = false;
  private state: EngineState = "uninitialized";
  private error: Error | null = null;

  // Render targets
  private sceneTexture: GPUTexture | null = null;
  private bloomTexture: GPUTexture | null = null;
  private depthTexture: GPUTexture | null = null;

  // Global uniforms data
  private readonly uniforms: GlobalUniforms = {
    time: 0,
    deltaTime: 0,
    resolution: { x: 0, y: 0 },
    mouse: { x: 0, y: 0 },
    orbCenter: { x: 0, y: 0 },
    orbState: 0,
    audioLow: 0,
    audioMid: 0,
    zoom: 1,
  };

  constructor(config: CortexConfig) {
    this.canvas = config.canvas;
    this.lodManager = config.lodManager ?? new LODManager();
    this.camera = createCamera({ x: 0, y: 0 });
    this.temporal = createTemporalState();
  }

  /**
   * Initialize WebGPU and create resources
   */
  async init(): Promise<boolean> {
    if (this.state === "ready") {
      return true;
    }
    if (this.state === "initializing") {
      return false;
    }

    this.state = "initializing";

    try {
      // Check WebGPU support
      if (!navigator.gpu) {
        throw new Error("WebGPU not supported");
      }

      // Request adapter
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });

      if (!adapter) {
        throw new Error("Failed to get WebGPU adapter");
      }

      // Request device
      this.device = await adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {
          maxStorageBufferBindingSize:
            adapter.limits.maxStorageBufferBindingSize,
          maxComputeWorkgroupsPerDimension:
            adapter.limits.maxComputeWorkgroupsPerDimension,
        },
      });

      // Configure canvas
      this.context = this.canvas.getContext("webgpu");
      if (!this.context) {
        throw new Error("Failed to get WebGPU context");
      }

      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: "premultiplied",
      });

      // Create buffer pool
      this.bufferPool = new BufferPool(this.device);

      // Create uniform buffer (64 floats = 256 bytes aligned)
      this.uniformBuffer = new UniformBuffer(
        this.device,
        64,
        "global_uniforms"
      );

      // Create render targets
      this.createRenderTargets();

      // Initialize all systems
      for (const system of this.systems.values()) {
        await system.init(this.device);
      }

      this.state = "ready";
      return true;
    } catch (error) {
      this.error = error instanceof Error ? error : new Error(String(error));
      this.state = "error";
      return false;
    }
  }

  /**
   * Create render target textures
   */
  private createRenderTargets(): void {
    if (!this.device) {
      return;
    }

    const { width } = this.canvas;
    const { height } = this.canvas;

    // Destroy old textures
    this.sceneTexture?.destroy();
    this.bloomTexture?.destroy();
    this.depthTexture?.destroy();

    // Scene color texture
    this.sceneTexture = this.device.createTexture({
      size: { width, height },
      format: this.format,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC,
      label: "scene_texture",
    });

    // Bloom texture (quarter resolution)
    this.bloomTexture = this.device.createTexture({
      size: {
        width: Math.max(1, width >> 2),
        height: Math.max(1, height >> 2),
      },
      format: this.format,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      label: "bloom_texture",
    });

    // Depth texture
    this.depthTexture = this.device.createTexture({
      size: { width, height },
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      label: "depth_texture",
    });

    // Update resolution uniform
    this.uniforms.resolution = { x: width, y: height };
  }

  /**
   * Register a render system
   */
  registerSystem(system: RenderSystem): void {
    this.systems.set(system.name, system);

    if (this.device && this.state === "ready") {
      system.init(this.device).catch((_err) => {});
    }
  }

  /**
   * Get a registered system
   */
  getSystem<T extends RenderSystem>(name: string): T | undefined {
    return this.systems.get(name) as T | undefined;
  }

  /**
   * Update global uniforms
   */
  setUniforms(updates: Partial<GlobalUniforms>): void {
    Object.assign(this.uniforms, updates);
  }

  /**
   * Update orb configuration
   */
  setOrbConfig(config: OrbConfig): void {
    this.uniforms.orbCenter = config.center;
    this.uniforms.orbState =
      config.state === "dormant"
        ? 0
        : config.state === "idle"
          ? 1
          : config.state === "listening"
            ? 2
            : config.state === "active"
              ? 3
              : 4;
  }

  /**
   * Update camera
   */
  setCamera(updates: Partial<Camera>): void {
    Object.assign(this.camera, updates);
    this.uniforms.zoom = this.camera.zoom;
    this.lodManager.setZoom(this.camera.zoom);
  }

  /**
   * Update audio levels for visualization
   */
  setAudioLevels(low: number, mid: number): void {
    this.uniforms.audioLow = low;
    this.uniforms.audioMid = mid;
  }

  /**
   * Update mouse position
   */
  setMousePosition(x: number, y: number): void {
    this.uniforms.mouse = { x, y };
  }

  /**
   * Handle resize
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;

    if (this.device) {
      this.createRenderTargets();
    }

    this.camera.center = { x: width / 2, y: height / 2 };
  }

  /**
   * Upload uniforms to GPU
   */
  private uploadUniforms(): void {
    if (!this.uniformBuffer) {
      return;
    }

    const u = this.uniforms;

    // Layout matches WGSL struct (aligned)
    this.uniformBuffer.setFloat(0, u.time);
    this.uniformBuffer.setFloat(1, u.deltaTime);
    this.uniformBuffer.setVec2(2, u.resolution.x, u.resolution.y);
    this.uniformBuffer.setVec2(4, u.mouse.x, u.mouse.y);
    this.uniformBuffer.setVec2(6, u.orbCenter.x, u.orbCenter.y);
    this.uniformBuffer.setFloat(8, u.orbState);
    this.uniformBuffer.setFloat(9, u.audioLow);
    this.uniformBuffer.setFloat(10, u.audioMid);
    this.uniformBuffer.setFloat(11, u.zoom);

    this.uniformBuffer.upload();
  }

  /**
   * Render a single frame
   */
  private render(time: number): void {
    if (!(this.device && this.context) || this.state !== "ready") {
      return;
    }

    // Calculate delta time
    const dt = this.lastFrameTime > 0 ? (time - this.lastFrameTime) / 1000 : 0;
    this.lastFrameTime = time;

    // Update uniforms
    this.uniforms.time = time / 1000;
    this.uniforms.deltaTime = dt;
    this.uploadUniforms();

    // Update all systems
    const uniformData = new Float32Array([
      this.uniforms.time,
      this.uniforms.deltaTime,
      this.uniforms.resolution.x,
      this.uniforms.resolution.y,
      this.uniforms.mouse.x,
      this.uniforms.mouse.y,
      this.uniforms.orbCenter.x,
      this.uniforms.orbCenter.y,
      this.uniforms.orbState,
      this.uniforms.audioLow,
      this.uniforms.audioMid,
      this.uniforms.zoom,
    ]);

    for (const system of this.systems.values()) {
      system.update(dt, uniformData);
    }

    // Get current swap chain texture
    const swapChainTexture = this.context.getCurrentTexture();
    const swapChainView = swapChainTexture.createView();

    // Create command encoder
    const encoder = this.device.createCommandEncoder({
      label: "frame_encoder",
    });

    // Execute frame graph
    // For now, just clear to void color
    const clearPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: swapChainView,
          clearValue: { r: 0.05, g: 0.05, b: 0.05, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    // Render all systems
    for (const system of this.systems.values()) {
      system.render(encoder, swapChainView);
    }

    clearPass.end();

    // Submit commands
    this.device.queue.submit([encoder.finish()]);

    // Continue render loop
    if (this.running) {
      requestAnimationFrame((t) => this.render(t));
    }
  }

  /**
   * Start the render loop
   */
  start(): void {
    if (this.running) {
      return;
    }
    if (this.state !== "ready") {
      return;
    }

    this.running = true;
    this.lastFrameTime = 0;
    requestAnimationFrame((t) => this.render(t));
  }

  /**
   * Stop the render loop
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Get engine state
   */
  getState(): EngineState {
    return this.state;
  }

  /**
   * Get last error
   */
  getError(): Error | null {
    return this.error;
  }

  /**
   * Get the GPU device
   */
  getDevice(): GPUDevice | null {
    return this.device;
  }

  /**
   * Get the buffer pool
   */
  getBufferPool(): BufferPool | null {
    return this.bufferPool;
  }

  /**
   * Get the uniform buffer
   */
  getUniformBuffer(): UniformBuffer | null {
    return this.uniformBuffer;
  }

  /**
   * Get LOD manager
   */
  getLODManager(): LODManager {
    return this.lodManager;
  }

  /**
   * Get camera
   */
  getCamera(): Camera {
    return this.camera;
  }

  /**
   * Get temporal state
   */
  getTemporal(): TemporalState {
    return this.temporal;
  }

  /**
   * Destroy engine and free resources
   */
  destroy(): void {
    this.stop();

    for (const system of this.systems.values()) {
      system.destroy();
    }
    this.systems.clear();

    this.sceneTexture?.destroy();
    this.bloomTexture?.destroy();
    this.depthTexture?.destroy();

    this.uniformBuffer?.destroy();
    this.bufferPool?.destroy();

    this.device?.destroy();

    this.state = "uninitialized";
  }
}

/**
 * Check if WebGPU is supported
 */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/**
 * Detect rendering capability
 */
export async function detectRenderingCapability(): Promise<
  "webgpu" | "webgl" | "canvas2d"
> {
  if (typeof navigator === "undefined") {
    return "canvas2d";
  }

  if ("gpu" in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        return "webgpu";
      }
    } catch {
      // WebGPU not available
    }
  }

  const canvas = document.createElement("canvas");
  if (canvas.getContext("webgl2")) {
    return "webgl";
  }

  return "canvas2d";
}
