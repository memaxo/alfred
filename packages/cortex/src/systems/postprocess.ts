/**
 * Post-Processing System
 *
 * Handles bloom extraction, Gaussian blur, chromatic aberration,
 * and final compositing.
 */

import type { RenderSystem } from "../types";

import { UniformBuffer } from "../buffer";
// Import shader source
import bloomShaderSource from "../shaders/bloom.wgsl?raw";

/** Bloom configuration */
export interface BloomConfig {
  threshold: number;
  intensity: number;
  blurRadius: number;
}

/** Default bloom config */
export const DEFAULT_BLOOM_CONFIG: BloomConfig = {
  threshold: 0.8,
  intensity: 0.5,
  blurRadius: 2,
};

/**
 * Post-Processing System
 */
export class PostProcessSystem implements RenderSystem {
  readonly name = "postprocess";

  private device: GPUDevice | null = null;
  private readonly config: BloomConfig;

  private uniformBuffer: UniformBuffer | null = null;
  private bloomParamsBuffer: UniformBuffer | null = null;

  private extractPipeline: GPURenderPipeline | null = null;
  private blurHPipeline: GPURenderPipeline | null = null;
  private blurVPipeline: GPURenderPipeline | null = null;
  private compositePipeline: GPURenderPipeline | null = null;
  private combinedPipeline: GPURenderPipeline | null = null;

  private sampler: GPUSampler | null = null;

  // Intermediate textures
  private bloomTexture0: GPUTexture | null = null;
  private bloomTexture1: GPUTexture | null = null;

  constructor(config: Partial<BloomConfig> = {}) {
    this.config = { ...DEFAULT_BLOOM_CONFIG, ...config };
  }

  async init(device: GPUDevice): Promise<void> {
    this.device = device;

    // Create shader module
    const shaderModule = device.createShaderModule({
      label: "bloom_shader",
      code: bloomShaderSource,
    });

    // Check for compilation errors
    const compilationInfo = await shaderModule.getCompilationInfo();
    for (const message of compilationInfo.messages) {
      if (message.type === "error") {}
    }

    // Create uniform buffer
    this.uniformBuffer = new UniformBuffer(device, 16, "postprocess_uniforms");

    // Create bloom params buffer
    this.bloomParamsBuffer = new UniformBuffer(device, 4, "bloom_params");
    this.updateBloomParams();

    // Create sampler
    this.sampler = device.createSampler({
      label: "linear_sampler",
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    // Create pipelines
    const format = navigator.gpu.getPreferredCanvasFormat();

    this.extractPipeline = device.createRenderPipeline({
      label: "bloom_extract",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_fullscreen",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_bloom_extract",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });

    this.blurHPipeline = device.createRenderPipeline({
      label: "blur_horizontal",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_fullscreen",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_blur_horizontal",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });

    this.blurVPipeline = device.createRenderPipeline({
      label: "blur_vertical",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_fullscreen",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_blur_vertical",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });

    this.compositePipeline = device.createRenderPipeline({
      label: "composite",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_fullscreen",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_composite",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });

    const _aberrationPipeline = device.createRenderPipeline({
      label: "chromatic_aberration",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_fullscreen",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_chromatic_aberration",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });

    this.combinedPipeline = device.createRenderPipeline({
      label: "combined_postprocess",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_fullscreen",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_post_process",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });
  }

  private updateBloomParams(): void {
    if (!this.bloomParamsBuffer) {
      return;
    }

    this.bloomParamsBuffer.setFloat(0, this.config.threshold);
    this.bloomParamsBuffer.setFloat(1, this.config.intensity);
    this.bloomParamsBuffer.setFloat(2, this.config.blurRadius);
    this.bloomParamsBuffer.setFloat(3, 0); // Padding
    this.bloomParamsBuffer.upload();
  }

  /** Resize intermediate textures */
  resize(width: number, height: number): void {
    if (!this.device) {
      return;
    }

    const _resolution = { x: width, y: height };

    // Destroy old textures
    this.bloomTexture0?.destroy();
    this.bloomTexture1?.destroy();

    const format = navigator.gpu.getPreferredCanvasFormat();

    // Create bloom textures at quarter resolution
    const bloomWidth = Math.max(1, Math.floor(width / 4));
    const bloomHeight = Math.max(1, Math.floor(height / 4));

    this.bloomTexture0 = this.device.createTexture({
      label: "bloom_texture_0",
      size: { width: bloomWidth, height: bloomHeight },
      format,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.bloomTexture1 = this.device.createTexture({
      label: "bloom_texture_1",
      size: { width: bloomWidth, height: bloomHeight },
      format,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
  }

  /** Update bloom configuration */
  setConfig(config: Partial<BloomConfig>): void {
    Object.assign(this.config, config);
    this.updateBloomParams();
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

  render(_encoder: GPUCommandEncoder, _target: GPUTextureView): void {
    // Post-processing is handled by main engine with specific targets
  }

  /** Get bloom texture for external use */
  getBloomTexture(): GPUTexture | null {
    return this.bloomTexture1;
  }

  /** Get extract pipeline */
  getExtractPipeline(): GPURenderPipeline | null {
    return this.extractPipeline;
  }

  /** Get horizontal blur pipeline */
  getBlurHPipeline(): GPURenderPipeline | null {
    return this.blurHPipeline;
  }

  /** Get vertical blur pipeline */
  getBlurVPipeline(): GPURenderPipeline | null {
    return this.blurVPipeline;
  }

  /** Get composite pipeline */
  getCompositePipeline(): GPURenderPipeline | null {
    return this.compositePipeline;
  }

  /** Get combined post-process pipeline */
  getCombinedPipeline(): GPURenderPipeline | null {
    return this.combinedPipeline;
  }

  /** Get sampler */
  getSampler(): GPUSampler | null {
    return this.sampler;
  }

  destroy(): void {
    this.uniformBuffer?.destroy();
    this.bloomParamsBuffer?.destroy();
    this.bloomTexture0?.destroy();
    this.bloomTexture1?.destroy();
  }
}
