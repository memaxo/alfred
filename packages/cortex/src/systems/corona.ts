/**
 * Corona Fiber System
 *
 * Renders logarithmic spiral fibers emanating from the orb.
 * Uses GPU compute for fiber animation and instanced rendering for display.
 */

import type { OrbConfig, RenderSystem, Vec2 } from "../types";

import { StorageBuffer, UniformBuffer } from "../buffer";
// Import shader source
import coronaShaderSource from "../shaders/corona.wgsl?raw";

/** Corona system configuration */
export interface CoronaSystemConfig {
  fiberCount: number;
  segmentsPerFiber: number;
  innerRadius: number;
  outerRadius: number;
  orbCenter: Vec2;
}

/** Default corona configuration */
export const DEFAULT_CORONA_CONFIG: CoronaSystemConfig = {
  fiberCount: 2000,
  segmentsPerFiber: 50,
  innerRadius: 150,
  outerRadius: 400,
  orbCenter: { x: 0, y: 0 },
};

/** Bytes per fiber segment (must match WGSL struct) */
const SEGMENT_STRIDE = 16; // vec2f position + f32 alpha + f32 width = 16 bytes

/**
 * Corona Fiber Render System
 */
export class CoronaSystem implements RenderSystem {
  readonly name = "corona";

  private device: GPUDevice | null = null;
  private readonly config: CoronaSystemConfig;

  private fiberBuffer: StorageBuffer | null = null;
  private uniformBuffer: UniformBuffer | null = null;

  private computePipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  private computeBindGroup: GPUBindGroup | null = null;
  private renderBindGroup: GPUBindGroup | null = null;

  private totalSegments: number;
  private instanceCount: number;

  constructor(config: Partial<CoronaSystemConfig> = {}) {
    this.config = { ...DEFAULT_CORONA_CONFIG, ...config };
    this.totalSegments = this.config.fiberCount * this.config.segmentsPerFiber;
    // Instance count = segments that form quads (segments - 1 per fiber)
    this.instanceCount =
      this.config.fiberCount * (this.config.segmentsPerFiber - 1);
  }

  async init(device: GPUDevice): Promise<void> {
    this.device = device;

    // Create shader module
    const shaderModule = device.createShaderModule({
      label: "corona_shader",
      code: coronaShaderSource,
    });

    // Check for compilation errors
    const compilationInfo = await shaderModule.getCompilationInfo();
    for (const message of compilationInfo.messages) {
      if (message.type === "error") {}
    }

    // Create uniform buffer
    this.uniformBuffer = new UniformBuffer(device, 16, "corona_uniforms");

    // Create fiber storage buffer
    const bufferSize = this.totalSegments * SEGMENT_STRIDE;
    this.fiberBuffer = new StorageBuffer(
      device,
      bufferSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      "fiber_buffer"
    );

    // Create compute pipeline
    this.computePipeline = device.createComputePipeline({
      label: "corona_compute",
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "update_fibers",
      },
    });

    // Create render pipeline
    this.renderPipeline = device.createRenderPipeline({
      label: "corona_render",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_fiber",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_fiber",
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

    // Create bind groups
    this.createBindGroups();
  }

  private createBindGroups(): void {
    if (
      !(
        this.device &&
        this.computePipeline &&
        this.renderPipeline &&
        this.uniformBuffer &&
        this.fiberBuffer
      )
    ) {
      return;
    }

    const computeLayout = this.computePipeline.getBindGroupLayout(0);
    const renderLayout = this.renderPipeline.getBindGroupLayout(0);

    this.computeBindGroup = this.device.createBindGroup({
      label: "corona_compute_bg",
      layout: computeLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer.gpuBuffer } },
        { binding: 1, resource: { buffer: this.fiberBuffer.gpuBuffer } },
      ],
    });

    this.renderBindGroup = this.device.createBindGroup({
      label: "corona_render_bg",
      layout: renderLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer.gpuBuffer } },
        { binding: 1, resource: { buffer: this.fiberBuffer.gpuBuffer } },
      ],
    });
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
        this.computePipeline &&
        this.renderPipeline &&
        this.computeBindGroup &&
        this.renderBindGroup
      )
    ) {
      return;
    }

    // Compute pass - update fiber positions
    const computePass = encoder.beginComputePass({
      label: "corona_compute_pass",
    });
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(this.totalSegments / 256));
    computePass.end();

    // Render pass - draw fibers
    // Note: This integrates with the main render pass
  }

  /** Update orb configuration */
  setOrbConfig(config: OrbConfig): void {
    this.config.orbCenter = config.center;
    this.config.innerRadius = config.innerRadius;
    this.config.outerRadius = config.outerRadius;
  }

  /** Set fiber count (triggers reallocation) */
  setFiberCount(count: number): void {
    if (count === this.config.fiberCount || !this.device) {
      return;
    }

    this.config.fiberCount = count;
    this.totalSegments = count * this.config.segmentsPerFiber;
    this.instanceCount = count * (this.config.segmentsPerFiber - 1);

    // Recreate buffer
    this.fiberBuffer?.destroy();

    const bufferSize = this.totalSegments * SEGMENT_STRIDE;
    this.fiberBuffer = new StorageBuffer(
      this.device,
      bufferSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      "fiber_buffer"
    );

    this.createBindGroups();
  }

  /** Get total segments for external use */
  getTotalSegments(): number {
    return this.totalSegments;
  }

  /** Get instance count for rendering */
  getInstanceCount(): number {
    return this.instanceCount;
  }

  destroy(): void {
    this.fiberBuffer?.destroy();
    this.uniformBuffer?.destroy();
  }
}
