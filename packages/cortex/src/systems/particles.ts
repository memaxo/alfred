/**
 * Gravitational Particle System
 *
 * GPU-accelerated particles that orbit and spiral toward the central orb.
 * Uses double-buffering for ping-pong compute updates.
 */

import { DoubleBuffer, UniformBuffer } from "../buffer";
// Import shader source
import particleShaderSource from "../shaders/particles.wgsl?raw";
import type { RenderSystem, Vec2 } from "../types";

/** Particle system configuration */
export type ParticleSystemConfig = {
  maxParticles: number;
  spawnRadius: number;
  orbCenter: Vec2;
};

/** Bytes per particle (must match WGSL struct) */
const PARTICLE_STRIDE = 32; // 2 vec2f + 2 f32 + 2 f32 pad = 32 bytes

/**
 * Gravitational Particle System
 */
export class ParticleSystem implements RenderSystem {
  readonly name = "particles";

  private device: GPUDevice | null = null;
  private readonly config: ParticleSystemConfig;

  private particleBuffer: DoubleBuffer | null = null;
  private uniformBuffer: UniformBuffer | null = null;

  private computePipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  private computeBindGroups: [GPUBindGroup, GPUBindGroup] | null = null;

  private particleCount: number;

  constructor(config: ParticleSystemConfig) {
    this.config = config;
    this.particleCount = config.maxParticles;
  }

  async init(device: GPUDevice): Promise<void> {
    this.device = device;

    // Create shader module
    const shaderModule = device.createShaderModule({
      label: "particle_shader",
      code: particleShaderSource,
    });

    // Check for compilation errors
    const compilationInfo = await shaderModule.getCompilationInfo();
    for (const message of compilationInfo.messages) {
      if (message.type === "error") {
      }
    }

    // Create uniform buffer
    this.uniformBuffer = new UniformBuffer(device, 16, "particle_uniforms");

    // Create particle double buffer
    const bufferSize = this.particleCount * PARTICLE_STRIDE;
    this.particleBuffer = new DoubleBuffer(
      device,
      bufferSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
    );

    // Initialize particles
    this.initializeParticles();

    // Create compute pipeline
    this.computePipeline = device.createComputePipeline({
      label: "particle_compute",
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "update_particles",
      },
    });

    // Create render pipeline
    this.renderPipeline = device.createRenderPipeline({
      label: "particle_render",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_particle",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_particle",
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    // Create bind groups for ping-pong
    this.createBindGroups();
  }

  private createBindGroups(): void {
    if (
      !(
        this.device &&
        this.computePipeline &&
        this.renderPipeline &&
        this.uniformBuffer &&
        this.particleBuffer
      )
    ) {
      return;
    }

    const computeLayout = this.computePipeline.getBindGroupLayout(0);
    const renderLayout = this.renderPipeline.getBindGroupLayout(0);

    // Ping-pong bind groups for compute
    this.computeBindGroups = [
      this.device.createBindGroup({
        label: "particle_compute_bg_0",
        layout: computeLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer.gpuBuffer } },
          { binding: 1, resource: { buffer: this.particleBuffer.read } },
          { binding: 2, resource: { buffer: this.particleBuffer.write } },
        ],
      }),
      this.device.createBindGroup({
        label: "particle_compute_bg_1",
        layout: computeLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer.gpuBuffer } },
          { binding: 1, resource: { buffer: this.particleBuffer.write } },
          { binding: 2, resource: { buffer: this.particleBuffer.read } },
        ],
      }),
    ];

    // Render bind group (reads from current read buffer)
    const _renderBindGroup = this.device.createBindGroup({
      label: "particle_render_bg",
      layout: renderLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer.gpuBuffer } },
        { binding: 1, resource: { buffer: this.particleBuffer.read } },
      ],
    });
  }

  private initializeParticles(): void {
    if (!(this.device && this.particleBuffer)) {
      return;
    }

    const data = new Float32Array(this.particleCount * 8); // 8 floats per particle

    for (let i = 0; i < this.particleCount; i++) {
      const offset = i * 8;
      const angle = Math.random() * Math.PI * 2;
      const radius = this.config.spawnRadius + Math.random() * 200;

      // Position
      data[offset + 0] = this.config.orbCenter.x + Math.cos(angle) * radius;
      data[offset + 1] = this.config.orbCenter.y + Math.sin(angle) * radius;

      // Velocity (tangent to orbit)
      const speed = 50 + Math.random() * 100;
      data[offset + 2] = -Math.sin(angle) * speed;
      data[offset + 3] = Math.cos(angle) * speed;

      // Life
      data[offset + 4] = 0.5 + Math.random() * 1.0;

      // Size
      data[offset + 5] = 1 + Math.random() * 2;

      // Padding
      data[offset + 6] = 0;
      data[offset + 7] = 0;
    }

    // Upload to both buffers
    this.particleBuffer.upload(data.buffer);
    this.particleBuffer.swap();
    this.particleBuffer.upload(data.buffer);
    this.particleBuffer.swap();
  }

  update(_dt: number, uniforms: Float32Array): void {
    if (!this.uniformBuffer) {
      return;
    }

    // Copy relevant uniforms
    for (let i = 0; i < Math.min(uniforms.length, 16); i++) {
      this.uniformBuffer.setFloat(i, uniforms[i]);
    }
    this.uniformBuffer.upload();
  }

  render(encoder: GPUCommandEncoder, _target: GPUTextureView): void {
    if (
      !(
        this.device &&
        this.computePipeline &&
        this.renderPipeline &&
        this.computeBindGroups &&
        this.particleBuffer
      )
    ) {
      return;
    }

    // Compute pass - update particles
    const computePass = encoder.beginComputePass({
      label: "particle_compute_pass",
    });
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroups[0]);
    computePass.dispatchWorkgroups(Math.ceil(this.particleCount / 256));
    computePass.end();

    // Swap buffers for next frame
    this.particleBuffer.swap();

    // Recreate bind groups with swapped buffers
    this.createBindGroups();

    // Render pass - draw particles
    // Note: This integrates with the main render pass, so we don't create a new one here
    // The engine will call render() during the appropriate pass
  }

  /** Set particle count (triggers reallocation) */
  setParticleCount(count: number): void {
    if (count === this.particleCount || !this.device) {
      return;
    }

    this.particleCount = count;

    // Recreate buffers
    this.particleBuffer?.destroy();

    const bufferSize = count * PARTICLE_STRIDE;
    this.particleBuffer = new DoubleBuffer(
      this.device,
      bufferSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
    );

    this.initializeParticles();
    this.createBindGroups();
  }

  /** Update orb center position */
  setOrbCenter(center: Vec2): void {
    this.config.orbCenter = center;
  }

  destroy(): void {
    this.particleBuffer?.destroy();
    this.uniformBuffer?.destroy();
  }
}
