/**
 * Embedding Queue Tests
 * Tests for request queuing, batching, and backpressure
 */

import { describe, expect, mock, test } from "bun:test";
import { EmbedQueue } from "../src/queue";

// Shared mock callback creator
function createMockCallback() {
  return mock(async (texts: string[]) =>
    texts.map((_, i) => new Array(1024).fill(i * 0.01))
  );
}

describe("EmbedQueue", () => {
  test("processes single request", async () => {
    const cb = createMockCallback();
    const q = new EmbedQueue(cb, { batchDelayMs: 0 });

    const result = await q.enqueue(["hello", "world"]);

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1024);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(["hello", "world"]);
  });

  test("batches multiple concurrent requests", async () => {
    const cb = createMockCallback();
    const q = new EmbedQueue(cb, {
      batchDelayMs: 50,
      maxBatchSize: 10,
    });

    const results = await Promise.all([
      q.enqueue(["text1"]),
      q.enqueue(["text2"]),
      q.enqueue(["text3"]),
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]).toHaveLength(1);
    expect(cb.mock.calls.length).toBeLessThanOrEqual(3);
  });

  test("respects maxBatchSize", async () => {
    const cb = createMockCallback();
    const q = new EmbedQueue(cb, {
      batchDelayMs: 0,
      maxBatchSize: 2,
    });

    await Promise.all([
      q.enqueue(["a"]),
      q.enqueue(["b"]),
      q.enqueue(["c"]),
      q.enqueue(["d"]),
    ]);

    expect(cb.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("respects maxTextsPerBatch", async () => {
    const cb = createMockCallback();
    const q = new EmbedQueue(cb, {
      batchDelayMs: 0,
      maxTextsPerBatch: 3,
      maxBatchSize: 10,
    });

    await Promise.all([q.enqueue(["a", "b"]), q.enqueue(["c", "d"])]);

    expect(cb.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  test("rejects when queue is full", async () => {
    const q = new EmbedQueue(
      async () => {
        await new Promise((r) => setTimeout(r, 100));
        return [[0]];
      },
      { maxQueueSize: 2, batchDelayMs: 1000 }
    );

    q.enqueue(["a"]).catch(() => {});
    q.enqueue(["b"]).catch(() => {});

    await expect(q.enqueue(["c"])).rejects.toThrow("Queue full");
    q.clear();
  });

  test("tracks queue statistics", async () => {
    const q = new EmbedQueue(createMockCallback(), { batchDelayMs: 0 });

    await q.enqueue(["a"]);
    await q.enqueue(["b"]);

    const stats = q.getStats();
    expect(stats.totalQueued).toBe(2);
    expect(stats.totalProcessed).toBe(2);
    expect(stats.totalDropped).toBe(0);
  });

  test("hasCapacity returns correct value", () => {
    const q = new EmbedQueue(createMockCallback(), { maxQueueSize: 5 });
    expect(q.hasCapacity()).toBe(true);
    expect(q.length).toBe(0);
  });

  test("handles processing errors", async () => {
    const q = new EmbedQueue(
      () => {
        throw new Error("fail");
      },
      { batchDelayMs: 0 }
    );

    let caught = false;
    try {
      await q.enqueue(["x"]);
    } catch {
      caught = true;
    }
    expect(caught).toBe(true);
  });
});
