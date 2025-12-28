/**
 * Living Edge System
 *
 * Renders connections between nodes as flowing particle streams
 * along bezier curves.
 */

import { StorageBuffer, UniformBuffer } from "../buffer";
import { computeEdgeControlPoints } from "../math/bezier";
// Import shader source
import edgeShaderSource from "../shaders/edges.wgsl?raw";
import type { EdgeData, RenderSystem, Vec2 } from "../types";

/** Particles per edge */
const PARTICLES_PER_EDGE = 200;

/** Edge buffer stride (must match WGSL struct) */
const EDGE_STRIDE = 64; // 4 vec2f + 4 f32 = 48 bytes, padded to 64

/** Particle buffer stride */
const PARTICLE_STRIDE = 32; // f32 t, speed, offset, size + vec2f world_pos + vec2f pad

/**
 * Living Edge Render System
 */
export class EdgeSystem implements RenderSystem {
  readonly name = "edges";

  private device: GPUDevice | null = null;
  private orbCenter: Vec2 = { x: 0, y: 0 };

  private edgeBuffer: StorageBuffer | null = null;
  private particleBuffer: StorageBuffer | null = null;
  private uniformBuffer: UniformBuffer | null = null;

  private computePipeline: GPUComputePipeline | null = null;
  private initPipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  private linePipeline: GPURenderPipeline | null = null;

  private computeBindGroup: GPUBindGroup | null = null;

  private edges: EdgeData[] = [];
  private readonly maxEdges: number;
  private needsInit = true;

  constructor(maxEdges = 100) {
    this.maxEdges = maxEdges;
  }

  async init(device: GPUDevice): Promise<void> {
    this.device = device;

    // Create shader module
    const shaderModule = device.createShaderModule({
      label: "edge_shader",
      code: edgeShaderSource,
    });

    // Check for compilation errors
    const compilationInfo = await shaderModule.getCompilationInfo();
    for (const message of compilationInfo.messages) {
      if (message.type === "error") {
      }
    }

    // Create uniform buffer
    this.uniformBuffer = new UniformBuffer(device, 16, "edge_uniforms");

    // Create edge storage buffer
    this.edgeBuffer = new StorageBuffer(
      device,
      this.maxEdges * EDGE_STRIDE,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      "edge_buffer"
    );

    // Create particle storage buffer
    const maxParticles = this.maxEdges * PARTICLES_PER_EDGE;
    this.particleBuffer = new StorageBuffer(
      device,
      maxParticles * PARTICLE_STRIDE,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      "edge_particle_buffer"
    );

    // Create compute pipelines
    this.computePipeline = device.createComputePipeline({
      label: "edge_compute",
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "update_edge_particles",
      },
    });

    this.initPipeline = device.createComputePipeline({
      label: "edge_init",
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "init_edge_particles",
      },
    });

    // Create particle render pipeline
    this.renderPipeline = device.createRenderPipeline({
      label: "edge_particle_render",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_edge_particle",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_edge_particle",
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

    // Create line render pipeline
    this.linePipeline = device.createRenderPipeline({
      label: "edge_line_render",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_edge_line",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_edge_line",
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
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

    this.createBindGroups();
  }

  private createBindGroups(): void {
    if (
      !(
        this.device &&
        this.computePipeline &&
        this.renderPipeline &&
        this.uniformBuffer &&
        this.edgeBuffer &&
        this.particleBuffer
      )
    ) {
      return;
    }

    const computeLayout = this.computePipeline.getBindGroupLayout(0);
    const renderLayout = this.renderPipeline.getBindGroupLayout(0);

    this.computeBindGroup = this.device.createBindGroup({
      label: "edge_compute_bg",
      layout: computeLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer.gpuBuffer } },
        { binding: 1, resource: { buffer: this.edgeBuffer.gpuBuffer } },
        { binding: 2, resource: { buffer: this.particleBuffer.gpuBuffer } },
      ],
    });

    // Render bind group creation (unused but kept for future)
    const _renderBindGroup = this.device.createBindGroup({
      label: "edge_render_bg",
      layout: renderLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer.gpuBuffer } },
        { binding: 1, resource: { buffer: this.edgeBuffer.gpuBuffer } },
        { binding: 2, resource: { buffer: this.particleBuffer.gpuBuffer } },
      ],
    });

    // Line bind group uses same layout for now
    if (this.linePipeline) {
      const lineLayout = this.linePipeline.getBindGroupLayout(0);
      const _lineBindGroup = this.device.createBindGroup({
        label: "edge_line_bg",
        layout: lineLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer.gpuBuffer } },
          { binding: 1, resource: { buffer: this.edgeBuffer.gpuBuffer } },
        ],
      });
    }
  }

  /** Set edges to render */
  setEdges(edges: EdgeData[]): void {
    this.edges = edges;
    this.uploadEdges();
    this.needsInit = true;
  }

  /** Update orb center (used for edge curvature) */
  setOrbCenter(center: Vec2): void {
    this.orbCenter = center;
    // Recompute control points
    this.uploadEdges();
  }

  private uploadEdges(): void {
    if (!(this.device && this.edgeBuffer)) {
      return;
    }

    const data = new Float32Array(this.maxEdges * 16); // 16 floats per edge

    for (let i = 0; i < Math.min(this.edges.length, this.maxEdges); i++) {
      const edge = this.edges[i];
      const offset = i * 16;

      // Compute bezier control points
      const { p0, p1, p2, p3 } = computeEdgeControlPoints(
        edge.p0,
        edge.p3,
        this.orbCenter,
        0.3
      );

      data[offset + 0] = p0.x;
      data[offset + 1] = p0.y;
      data[offset + 2] = p1.x;
      data[offset + 3] = p1.y;
      data[offset + 4] = p2.x;
      data[offset + 5] = p2.y;
      data[offset + 6] = p3.x;
      data[offset + 7] = p3.y;
      data[offset + 8] = edge.active;
      data[offset + 9] = edge.color.r;
      data[offset + 10] = edge.color.g;
      data[offset + 11] = edge.color.b;
      // Padding
      data[offset + 12] = 0;
      data[offset + 13] = 0;
      data[offset + 14] = 0;
      data[offset + 15] = 0;
    }

    this.edgeBuffer.upload(data.buffer, this.edges.length);
  }

  update(_dt: number, uniforms: Float32Array): void {
    if (!this.uniformBuffer) {
      return;
    }

    for (let i = 0; i < Math.min(uniforms.length, 16); i++) {
      this.uniformBuffer.setFloat(i, uniforms[i]);
    }
    this.uniformBuffer.upload();
  }

  render(encoder: GPUCommandEncoder, _target: GPUTextureView): void {
    if (!(this.computeBindGroup && this.initPipeline && this.computePipeline)) {
      return;
    }

    const particleCount = this.edges.length * PARTICLES_PER_EDGE;

    // Initialize particles if needed
    if (this.needsInit && this.edges.length > 0) {
      const initPass = encoder.beginComputePass({ label: "edge_init_pass" });
      initPass.setPipeline(this.initPipeline);
      initPass.setBindGroup(0, this.computeBindGroup);
      initPass.dispatchWorkgroups(Math.ceil(particleCount / 64));
      initPass.end();
      this.needsInit = false;
    }

    // Update particles
    if (this.edges.length > 0) {
      const computePass = encoder.beginComputePass({
        label: "edge_compute_pass",
      });
      computePass.setPipeline(this.computePipeline);
      computePass.setBindGroup(0, this.computeBindGroup);
      computePass.dispatchWorkgroups(Math.ceil(particleCount / 64));
      computePass.end();
    }
  }

  /** Get edge count */
  getEdgeCount(): number {
    return this.edges.length;
  }

  destroy(): void {
    this.edgeBuffer?.destroy();
    this.particleBuffer?.destroy();
    this.uniformBuffer?.destroy();
  }
}
