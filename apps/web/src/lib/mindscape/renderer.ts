import computeShader from "./compute.wgsl?raw";
import { createFontAtlas, type FontAtlas } from "./font-atlas";
import fragmentShader from "./fragment.wgsl?raw";

export class MindscapeRenderer {
  device: GPUDevice;
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;

  pipeline: GPUComputePipeline;
  renderPipeline: GPURenderPipeline;

  bindGroup: GPUBindGroup;
  renderBindGroup: GPUBindGroup | null = null;

  gridBuffer: GPUBuffer;
  uniformBuffer: GPUBuffer;

  fontAtlas: FontAtlas;

  width = 0;
  height = 0;

  constructor(
    device: GPUDevice,
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext
  ) {
    this.device = device;
    this.canvas = canvas;
    this.context = context;

    this.width = canvas.width;
    this.height = canvas.height;

    // 1. Font Atlas
    this.fontAtlas = createFontAtlas(device);

    // 2. Buffers
    // Grid Buffer: width * height * sizeof(Cell)
    // Cell is u32 (4 bytes).
    // Max resolution support?
    // Let's assume max 4k for buffer creation or resize dynamically.
    // Resizing buffers is expensive.
    // We'll start with current size and resize if needed.
    const cellCount = this.calculateGridSize();
    this.gridBuffer = device.createBuffer({
      size: cellCount * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX, // Vertex? No, storage for compute, storage/read for render.
    });

    // Uniforms: Time(f32), Res(vec2<f32>), Mouse(vec2<f32>) -> 6 floats = 24 bytes.
    // Padding to 16 bytes alignment.
    // Struct: { time, resolution, mouse }
    // f32, vec2, vec2.
    // Layout:
    // 0: time (4)
    // 4: padding (4) - alignment for vec2?
    // 8: res.x (4)
    // 12: res.y (4)
    // 16: mouse.x (4)
    // 20: mouse.y (4)
    // Total 24. Round to 32 for safety or just use it.
    this.uniformBuffer = device.createBuffer({
      size: 64, // Up from 32 to 64 bytes (16 floats)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 3. Pipelines
    const computeModule = device.createShaderModule({ code: computeShader });
    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: computeModule, entryPoint: "main" },
    });

    const renderModule = device.createShaderModule({ code: fragmentShader });

    // We need a pipeline layout for render to match bind groups
    // But 'auto' works if we stick to simple.
    this.renderPipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: renderModule,
        entryPoint: "vs_main",
      },
      fragment: {
        module: renderModule,
        entryPoint: "fs_main",
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

    // 4. Bind Groups
    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.gridBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    });

    this.createRenderBindGroup();
    this.configureContext();
  }

  private calculateGridSize(): number {
    // Cell size 10x20
    // Grid W = ceil(width / 10)
    // Grid H = ceil(height / 20)
    // Just using max safe size for buffer for now or dynamic?
    // Let's match current width/height.
    const gw = Math.ceil(this.width / 10);
    const gh = Math.ceil(this.height / 20);
    return gw * gh;
  }

  private configureContext() {
    this.context.configure({
      device: this.device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: "premultiplied",
    });
  }

  private createRenderBindGroup() {
    const sampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });

    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.gridBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
        { binding: 2, resource: sampler },
        {
          binding: 3,
          resource: (this.fontAtlas.texture as GPUTexture).createView(),
        },
      ],
    });
  }

  resize(width: number, height: number) {
    if (this.width === width && this.height === height) {
      return;
    }

    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;

    // Recreate buffers if needed
    const newSize = this.calculateGridSize();
    if (newSize * 4 > this.gridBuffer.size) {
      this.gridBuffer.destroy();
      this.gridBuffer = this.device.createBuffer({
        size: newSize * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX, // Actually read-only storage in frag
      });

      // Recreate bind groups
      this.bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gridBuffer } },
          { binding: 1, resource: { buffer: this.uniformBuffer } },
        ],
      });
      this.createRenderBindGroup();
    }

    this.configureContext();
  }

  render(
    time: number,
    mouse: Float32Array,
    audioLow: number,
    audioMid: number,
    f1: number,
    f2: number,
    f3: number,
    tint_h: number,
    tint_c: number,
    flow_speed: number
  ) {
    // Update Uniforms
    // Struct: time, audioLow, audioMid, pad, res(2), mouse(2), f1, f2, f3, tint_h, tint_c, flow_speed, pad(2)
    // Layout (std140):
    // 0: time
    // 4: audioLow
    // 8: audioMid
    // 12: pad
    // 16: res.x
    // 20: res.y
    // 24: mouse.x
    // 28: mouse.y
    // 32: f1
    // 36: f2
    // 40: f3
    // 44: tint_h
    // 48: tint_c
    // 52: flow_speed
    // 56: pad
    // 60: pad

    const uniformData = new Float32Array(16);
    uniformData[0] = time;
    uniformData[1] = audioLow;
    uniformData[2] = audioMid;

    uniformData[4] = this.width;
    uniformData[5] = this.height;

    uniformData[6] = mouse[0];
    uniformData[7] = mouse[1];

    uniformData[8] = f1;
    uniformData[9] = f2;
    uniformData[10] = f3;
    uniformData[11] = tint_h;
    uniformData[12] = tint_c;
    uniformData[13] = flow_speed;

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    const commandEncoder = this.device.createCommandEncoder();

    // 1. Compute Pass
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);

    // Dispatch
    // Workgroup size (16, 16)
    // Grid size
    const gw = Math.ceil(this.width / 10);
    const gh = Math.ceil(this.height / 20);
    passEncoder.dispatchWorkgroups(Math.ceil(gw / 16), Math.ceil(gh / 16));
    passEncoder.end();

    // 2. Render Pass
    const textureView = this.context.getCurrentTexture().createView();
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.05, g: 0.0, b: 0.0, a: 1.0 }, // Void color background
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    };

    const renderPassEncoder =
      commandEncoder.beginRenderPass(renderPassDescriptor);
    renderPassEncoder.setPipeline(this.renderPipeline);
    if (this.renderBindGroup) {
      renderPassEncoder.setBindGroup(0, this.renderBindGroup);
      // Draw 3 vertices (Full screen triangle)
      renderPassEncoder.draw(3);
    }
    renderPassEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}
