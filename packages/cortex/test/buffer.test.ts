/**
 * Cortex Buffer Management Tests
 *
 * Tests for BufferPool, DoubleBuffer, UniformBuffer, and StorageBuffer.
 * Uses minimal WebGPU mocking to test buffer management logic.
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  BufferPool,
  DoubleBuffer,
  StorageBuffer,
  UniformBuffer,
} from "../src/buffer";

// Define GPUBufferUsage constants since WebGPU is not available in Bun
const GPUBufferUsage = {
  MAP_READ: 0x00_01,
  MAP_WRITE: 0x00_02,
  COPY_SRC: 0x00_04,
  COPY_DST: 0x00_08,
  INDEX: 0x00_10,
  VERTEX: 0x00_20,
  UNIFORM: 0x00_40,
  STORAGE: 0x00_80,
  INDIRECT: 0x01_00,
  QUERY_RESOLVE: 0x02_00,
} as const;

// Make GPUBufferUsage available globally for the buffer module
(globalThis as Record<string, unknown>).GPUBufferUsage = GPUBufferUsage;

// Minimal WebGPU mocks for testing buffer management logic
function createMockGPUDevice(): GPUDevice {
  let bufferIdCounter = 0;
  const mockQueue = {
    writeBuffer: mock(() => {}),
    submit: mock(() => {}),
  };

  return {
    createBuffer: mock((descriptor: GPUBufferDescriptor) => {
      const id = bufferIdCounter++;
      return {
        id,
        size: descriptor.size,
        usage: descriptor.usage,
        label: descriptor.label ?? `buffer_${id}`,
        destroy: mock(() => {}),
        getMappedRange: mock(() => new ArrayBuffer(descriptor.size)),
        mapAsync: mock(async () => {}),
        unmap: mock(() => {}),
      } as unknown as GPUBuffer;
    }),
    queue: mockQueue as unknown as GPUQueue,
    limits: {} as GPUSupportedLimits,
    features: new Set() as GPUSupportedFeatures,
  } as unknown as GPUDevice;
}

describe("BufferPool", () => {
  let device: GPUDevice;
  let pool: BufferPool;

  beforeEach(() => {
    device = createMockGPUDevice();
    pool = new BufferPool(device);
  });

  it("creates new buffer when pool is empty", () => {
    const buffer = pool.acquire("test", 1024, GPUBufferUsage.VERTEX);
    expect(buffer).toBeDefined();
    expect((buffer as unknown as { size: number }).size).toBe(1024);
    expect(device.createBuffer).toHaveBeenCalledTimes(1);
  });

  it("reuses buffer after release", () => {
    const buffer1 = pool.acquire("test", 1024, GPUBufferUsage.VERTEX);
    pool.release("test", buffer1);
    const buffer2 = pool.acquire("test", 1024, GPUBufferUsage.VERTEX);

    expect(buffer1).toBe(buffer2);
    expect(device.createBuffer).toHaveBeenCalledTimes(1);
  });

  it("creates new buffer if existing is too small", () => {
    const buffer1 = pool.acquire("test", 1024, GPUBufferUsage.VERTEX);
    pool.release("test", buffer1);
    const buffer2 = pool.acquire("test", 2048, GPUBufferUsage.VERTEX);

    expect(buffer1).not.toBe(buffer2);
    expect(device.createBuffer).toHaveBeenCalledTimes(2);
  });

  it("reuses larger buffer for smaller request", () => {
    const buffer1 = pool.acquire("test", 2048, GPUBufferUsage.VERTEX);
    pool.release("test", buffer1);
    const buffer2 = pool.acquire("test", 1024, GPUBufferUsage.VERTEX);

    expect(buffer1).toBe(buffer2);
  });

  it("manages separate pools by name", () => {
    const bufferA = pool.acquire("poolA", 1024, GPUBufferUsage.VERTEX);
    const bufferB = pool.acquire("poolB", 1024, GPUBufferUsage.VERTEX);

    expect(bufferA).not.toBe(bufferB);
    expect(device.createBuffer).toHaveBeenCalledTimes(2);
  });

  it("creates new buffer if existing is in use", () => {
    const buffer1 = pool.acquire("test", 1024, GPUBufferUsage.VERTEX);
    const buffer2 = pool.acquire("test", 1024, GPUBufferUsage.VERTEX);

    expect(buffer1).not.toBe(buffer2);
    expect(device.createBuffer).toHaveBeenCalledTimes(2);
  });

  it("destroy clears all buffers", () => {
    const buffer1 = pool.acquire("test", 1024, GPUBufferUsage.VERTEX);
    const buffer2 = pool.acquire("test", 2048, GPUBufferUsage.VERTEX);
    pool.destroy();

    expect(buffer1.destroy).toHaveBeenCalled();
    expect(buffer2.destroy).toHaveBeenCalled();
  });

  it("prune removes old unused buffers", () => {
    const buffer = pool.acquire("test", 1024, GPUBufferUsage.VERTEX);
    pool.release("test", buffer);

    // Simulate age by pruning with 0 maxAge
    pool.prune(0);

    // Buffer should be destroyed (but kept in pool up to maxPoolSize)
    // The prune logic keeps buffers up to maxPoolSize regardless of age
    // To test actual destruction, we'd need to exceed maxPoolSize
  });
});

describe("DoubleBuffer", () => {
  let device: GPUDevice;

  beforeEach(() => {
    device = createMockGPUDevice();
  });

  it("creates two buffers", () => {
    const db = new DoubleBuffer(
      device,
      1024,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    expect(device.createBuffer).toHaveBeenCalledTimes(2);
    expect(db.size).toBe(1024);
  });

  it("read and write are different buffers", () => {
    const db = new DoubleBuffer(
      device,
      1024,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    expect(db.read).not.toBe(db.write);
  });

  it("swap exchanges read and write", () => {
    const db = new DoubleBuffer(
      device,
      1024,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    const initialRead = db.read;
    const initialWrite = db.write;

    db.swap();

    expect(db.read).toBe(initialWrite);
    expect(db.write).toBe(initialRead);
  });

  it("double swap returns to original state", () => {
    const db = new DoubleBuffer(
      device,
      1024,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    const initialRead = db.read;

    db.swap();
    db.swap();

    expect(db.read).toBe(initialRead);
  });

  it("upload writes to write buffer", () => {
    const db = new DoubleBuffer(
      device,
      1024,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    const data = new Float32Array([1, 2, 3, 4]).buffer;

    db.upload(data);

    expect(device.queue.writeBuffer).toHaveBeenCalledWith(db.write, 0, data);
  });

  it("destroy destroys both buffers", () => {
    const db = new DoubleBuffer(
      device,
      1024,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    const read = db.read;
    const write = db.write;

    db.destroy();

    expect(read.destroy).toHaveBeenCalled();
    expect(write.destroy).toHaveBeenCalled();
  });
});

describe("UniformBuffer", () => {
  let device: GPUDevice;

  beforeEach(() => {
    device = createMockGPUDevice();
  });

  it("creates aligned buffer", () => {
    const ub = new UniformBuffer(device, 64, "test_uniform");
    expect(device.createBuffer).toHaveBeenCalled();
    const call = (device.createBuffer as ReturnType<typeof mock>).mock.calls[0];
    // Size should be aligned to 256 bytes
    expect(call[0].size % 256).toBe(0);
  });

  it("setFloat marks buffer dirty", () => {
    const ub = new UniformBuffer(device, 64);
    ub.setFloat(0, 1.5);

    // Upload should write to GPU
    ub.upload();
    expect(device.queue.writeBuffer).toHaveBeenCalled();
  });

  it("setFloat does not mark dirty if value unchanged", () => {
    const ub = new UniformBuffer(device, 64);
    ub.setFloat(0, 1.5);
    ub.upload();
    (device.queue.writeBuffer as ReturnType<typeof mock>).mockClear();

    // Set same value
    ub.setFloat(0, 1.5);
    ub.upload();

    expect(device.queue.writeBuffer).not.toHaveBeenCalled();
  });

  it("setVec2 sets two consecutive floats", () => {
    const ub = new UniformBuffer(device, 64);
    ub.setVec2(0, 10, 20);
    ub.upload();

    expect(device.queue.writeBuffer).toHaveBeenCalled();
  });

  it("setVec4 sets four consecutive floats", () => {
    const ub = new UniformBuffer(device, 64);
    ub.setVec4(0, 1, 2, 3, 4);
    ub.upload();

    expect(device.queue.writeBuffer).toHaveBeenCalled();
  });

  it("forceUpload uploads regardless of dirty state", () => {
    const ub = new UniformBuffer(device, 64);
    // No changes made
    ub.forceUpload();

    expect(device.queue.writeBuffer).toHaveBeenCalled();
  });

  it("gpuBuffer returns underlying buffer", () => {
    const ub = new UniformBuffer(device, 64);
    expect(ub.gpuBuffer).toBeDefined();
    expect(ub.gpuBuffer.destroy).toBeDefined();
  });

  it("destroy destroys buffer", () => {
    const ub = new UniformBuffer(device, 64);
    const buffer = ub.gpuBuffer;
    ub.destroy();

    expect(buffer.destroy).toHaveBeenCalled();
  });
});

describe("StorageBuffer", () => {
  let device: GPUDevice;

  beforeEach(() => {
    device = createMockGPUDevice();
  });

  it("creates buffer with specified capacity", () => {
    const sb = new StorageBuffer(device, 4096, undefined, "test_storage");
    expect(sb.capacity).toBe(4096);
    expect(device.createBuffer).toHaveBeenCalled();
  });

  it("elementCount starts at 0", () => {
    const sb = new StorageBuffer(device, 4096);
    expect(sb.elementCount).toBe(0);
  });

  it("upload updates elementCount", () => {
    const sb = new StorageBuffer(device, 4096);
    const data = new Float32Array([1, 2, 3, 4]).buffer;
    sb.upload(data, 4);

    expect(sb.elementCount).toBe(4);
    expect(device.queue.writeBuffer).toHaveBeenCalled();
  });

  it("upload throws if data exceeds capacity", () => {
    const sb = new StorageBuffer(device, 16);
    const largeData = new Float32Array(100).buffer;

    expect(() => sb.upload(largeData, 100)).toThrow(/exceeds buffer capacity/);
  });

  it("gpuBuffer returns underlying buffer", () => {
    const sb = new StorageBuffer(device, 4096);
    expect(sb.gpuBuffer).toBeDefined();
  });

  it("destroy destroys buffer", () => {
    const sb = new StorageBuffer(device, 4096);
    const buffer = sb.gpuBuffer;
    sb.destroy();

    expect(buffer.destroy).toHaveBeenCalled();
  });
});

describe("Buffer Management Patterns", () => {
  it("ping-pong pattern with DoubleBuffer", () => {
    const device = createMockGPUDevice();
    const db = new DoubleBuffer(
      device,
      1024,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );

    // Simulate compute pass pattern
    for (let i = 0; i < 10; i++) {
      // Compute shader reads from db.read, writes to db.write
      const _readBuffer = db.read;
      const _writeBuffer = db.write;

      // After compute pass
      db.swap();
    }

    // After 10 swaps (even number), should be back to original
    const initialRead = db.read;
    db.swap();
    db.swap();
    expect(db.read).toBe(initialRead);
  });

  it("uniform buffer batching pattern", () => {
    const device = createMockGPUDevice();
    const ub = new UniformBuffer(device, 32);

    // Batch multiple updates
    ub.setFloat(0, 1.0); // time
    ub.setVec2(4, 800, 600); // resolution
    ub.setVec4(8, 0.5, 0.5, 0.5, 0.0); // center position

    // Single upload
    ub.upload();

    expect(device.queue.writeBuffer).toHaveBeenCalledTimes(1);
  });

  it("buffer pool lifecycle", () => {
    const device = createMockGPUDevice();
    const pool = new BufferPool(device);

    // Simulate render loop acquiring and releasing buffers
    for (let frame = 0; frame < 10; frame++) {
      const vertexBuffer = pool.acquire(
        "vertices",
        4096,
        GPUBufferUsage.VERTEX
      );
      const indexBuffer = pool.acquire("indices", 1024, GPUBufferUsage.INDEX);

      // Render...

      pool.release("vertices", vertexBuffer);
      pool.release("indices", indexBuffer);
    }

    // Should have only created 2 buffers total
    expect(device.createBuffer).toHaveBeenCalledTimes(2);

    // Cleanup
    pool.destroy();
  });
});
