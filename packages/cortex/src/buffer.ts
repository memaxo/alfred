/**
 * GPU Buffer Management
 *
 * Double-buffered buffer pool for efficient GPU memory management.
 * Implements ping-pong buffering for particle updates.
 */

import type { PooledBuffer } from "./types";

/**
 * Buffer pool for GPU resource management
 */
export class BufferPool {
  private readonly device: GPUDevice;
  private readonly pools: Map<string, PooledBuffer[]> = new Map();
  private readonly inUse: Map<string, Set<GPUBuffer>> = new Map();
  private readonly maxPoolSize = 8;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Acquire a buffer of at least the specified size
   */
  acquire(name: string, size: number, usage: GPUBufferUsageFlags): GPUBuffer {
    const pool = this.pools.get(name) ?? [];
    const used = this.inUse.get(name) ?? new Set();

    // Find existing buffer of sufficient size
    for (let i = 0; i < pool.length; i++) {
      const entry = pool[i];
      if (entry && entry.size >= size && !used.has(entry.buffer)) {
        entry.lastUsed = Date.now();
        used.add(entry.buffer);
        this.inUse.set(name, used);
        return entry.buffer;
      }
    }

    // Create new buffer
    const buffer = this.device.createBuffer({
      size,
      usage,
      label: `${name}_${pool.length}`,
    });

    const entry: PooledBuffer = {
      buffer,
      size,
      lastUsed: Date.now(),
    };

    pool.push(entry);
    this.pools.set(name, pool);
    used.add(buffer);
    this.inUse.set(name, used);

    return buffer;
  }

  /**
   * Release a buffer back to the pool
   */
  release(name: string, buffer: GPUBuffer): void {
    const used = this.inUse.get(name);
    if (used) {
      used.delete(buffer);
    }
  }

  /**
   * Prune unused buffers older than maxAge
   */
  prune(maxAge = 30_000): void {
    const now = Date.now();

    for (const [name, pool] of this.pools) {
      const used = this.inUse.get(name) ?? new Set();
      const kept: PooledBuffer[] = [];

      for (const entry of pool) {
        if (used.has(entry.buffer)) {
          kept.push(entry);
        } else if (now - entry.lastUsed < maxAge) {
          kept.push(entry);
        } else if (kept.length < this.maxPoolSize) {
          kept.push(entry);
        } else {
          entry.buffer.destroy();
        }
      }

      this.pools.set(name, kept);
    }
  }

  /**
   * Destroy all buffers
   */
  destroy(): void {
    for (const pool of this.pools.values()) {
      for (const entry of pool) {
        entry.buffer.destroy();
      }
    }
    this.pools.clear();
    this.inUse.clear();
  }
}

/**
 * Double buffer for ping-pong compute updates
 */
export class DoubleBuffer {
  private readonly device: GPUDevice;
  private readonly buffers: [GPUBuffer, GPUBuffer];
  private currentIndex = 0;
  readonly size: number;

  constructor(device: GPUDevice, size: number, usage: GPUBufferUsageFlags) {
    this.device = device;
    this.size = size;

    this.buffers = [
      device.createBuffer({ size, usage, label: "double_buffer_0" }),
      device.createBuffer({ size, usage, label: "double_buffer_1" }),
    ];
  }

  /** Get current read buffer */
  get read(): GPUBuffer {
    return this.buffers[this.currentIndex] as GPUBuffer;
  }

  /** Get current write buffer */
  get write(): GPUBuffer {
    return this.buffers[1 - this.currentIndex] as GPUBuffer;
  }

  /** Swap read and write buffers */
  swap(): void {
    this.currentIndex = 1 - this.currentIndex;
  }

  /** Write data to the current write buffer */
  upload(data: ArrayBuffer, offset = 0): void {
    this.device.queue.writeBuffer(this.write, offset, data);
  }

  /** Destroy both buffers */
  destroy(): void {
    this.buffers[0].destroy();
    this.buffers[1].destroy();
  }
}

/**
 * Uniform buffer manager
 *
 * Handles alignment and updates for shader uniforms.
 */
export class UniformBuffer {
  private readonly device: GPUDevice;
  private readonly buffer: GPUBuffer;
  private readonly data: Float32Array;
  private dirty = false;

  constructor(device: GPUDevice, sizeInFloats: number, label?: string) {
    this.device = device;

    // Align to 256 bytes (WebGPU requirement for uniform buffers)
    const alignedSize = Math.ceil((sizeInFloats * 4) / 256) * 256;
    this.data = new Float32Array(alignedSize / 4);

    this.buffer = device.createBuffer({
      size: alignedSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: label ?? "uniform_buffer",
    });
  }

  /** Get the underlying GPU buffer */
  get gpuBuffer(): GPUBuffer {
    return this.buffer;
  }

  /** Set a float value */
  setFloat(index: number, value: number): void {
    if (this.data[index] !== value) {
      this.data[index] = value;
      this.dirty = true;
    }
  }

  /** Set a vec2 value */
  setVec2(index: number, x: number, y: number): void {
    if (this.data[index] !== x || this.data[index + 1] !== y) {
      this.data[index] = x;
      this.data[index + 1] = y;
      this.dirty = true;
    }
  }

  /** Set a vec4 value */
  setVec4(index: number, x: number, y: number, z: number, w: number): void {
    this.data[index] = x;
    this.data[index + 1] = y;
    this.data[index + 2] = z;
    this.data[index + 3] = w;
    this.dirty = true;
  }

  /** Upload changes to GPU if dirty */
  upload(): void {
    if (this.dirty) {
      this.device.queue.writeBuffer(this.buffer, 0, this.data.buffer);
      this.dirty = false;
    }
  }

  /** Force upload regardless of dirty state */
  forceUpload(): void {
    this.device.queue.writeBuffer(this.buffer, 0, this.data.buffer);
    this.dirty = false;
  }

  /** Destroy the buffer */
  destroy(): void {
    this.buffer.destroy();
  }
}

/**
 * Storage buffer for large data (particles, nodes, edges)
 */
export class StorageBuffer {
  private readonly device: GPUDevice;
  private readonly buffer: GPUBuffer;
  readonly capacity: number;
  private count = 0;

  constructor(
    device: GPUDevice,
    capacity: number,
    usage: GPUBufferUsageFlags = GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_DST,
    label?: string
  ) {
    this.device = device;
    this.capacity = capacity;

    this.buffer = device.createBuffer({
      size: capacity,
      usage,
      label: label ?? "storage_buffer",
    });
  }

  /** Get the underlying GPU buffer */
  get gpuBuffer(): GPUBuffer {
    return this.buffer;
  }

  /** Get current element count */
  get elementCount(): number {
    return this.count;
  }

  /** Upload data to the buffer */
  upload(data: ArrayBuffer, elementCount: number): void {
    if (data.byteLength > this.capacity) {
      throw new Error(
        `Data size ${data.byteLength} exceeds buffer capacity ${this.capacity}`
      );
    }
    this.device.queue.writeBuffer(this.buffer, 0, data);
    this.count = elementCount;
  }

  /** Destroy the buffer */
  destroy(): void {
    this.buffer.destroy();
  }
}
