/**
 * Atmosphere Render System
 *
 * Creates atmospheric effects including radial fog, fiber textures,
 * and ocean-like caustics around the central orb.
 */

import type { RenderSystem } from "../types";

import { UniformBuffer } from "../buffer";
// Import shader source
import atmosphereShaderSource from "../shaders/atmosphere.wgsl?raw";

/**
 * Atmosphere Render System
 */
export class AtmosphereSystem implements RenderSystem {
  readonly name = "atmosphere";

  private device: GPUDevice | null = null;

  private uniformBuffer: UniformBuffer | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  private depthPipeline: GPURenderPipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;

  async init(device: GPUDevice): Promise<void> {
    this.device = device;

    // Create shader module
    const shaderModule = device.createShaderModule({
      label: "atmosphere_shader",
      code: atmosphereShaderSource,
    });

    // Check for compilation errors
    const compilationInfo = await shaderModule.getCompilationInfo();
    for (const message of compilationInfo.messages) {
      if (message.type === "error") {}
    }

    // Create uniform buffer
    this.uniformBuffer = new UniformBuffer(device, 16, "atmosphere_uniforms");

    // Create main atmosphere pipeline
    this.renderPipeline = device.createRenderPipeline({
      label: "atmosphere_render",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_atmosphere",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_atmosphere",
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
                dstFactor: "one-minus-src-alpha",
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

    // Create depth-based atmosphere pipeline
    this.depthPipeline = device.createRenderPipeline({
      label: "atmosphere_depth_render",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_atmosphere",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_atmosphere_depth",
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
                dstFactor: "one-minus-src-alpha",
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

    this.createBindGroup();
  }

  private createBindGroup(): void {
    if (!(this.device && this.renderPipeline && this.uniformBuffer)) {
      return;
    }

    const layout = this.renderPipeline.getBindGroupLayout(0);

    this.bindGroup = this.device.createBindGroup({
      label: "atmosphere_bg",
      layout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer.gpuBuffer } },
      ],
    });
  }

  update(_dt: number, uniforms: Float32Array): void {
    if (!this.uniformBuffer) {
      return;
    }

    for (let i = 0; i < Math.min(uniforms.length, 16); i++) {
      this.uniformBuffer.setFloat(i, uniforms[i] ?? 0);
    }
    this.uniformBuffer.upload();
  }

  render(_encoder: GPUCommandEncoder, _target: GPUTextureView): void {
    // Rendering is handled by main engine
  }

  /** Get render pipeline */
  getRenderPipeline(): GPURenderPipeline | null {
    return this.renderPipeline;
  }

  /** Get depth pipeline */
  getDepthPipeline(): GPURenderPipeline | null {
    return this.depthPipeline;
  }

  /** Get bind group */
  getBindGroup(): GPUBindGroup | null {
    return this.bindGroup;
  }

  destroy(): void {
    this.uniformBuffer?.destroy();
  }
}
