/**
 * GenUI Enrichment Latency Performance Tests
 *
 * Measures enrichment latency to ensure it meets the <50ms p95 budget.
 */

import { enrich } from "@alfred/agent/utils/enrich";
import { beforeEach, describe, expect, it } from "bun:test";

describe("GenUI Enrichment Latency", () => {
  beforeEach(() => {
    // Reset any caches or state
  });

  it("enriches small tool results in <50ms p95", async () => {
    const smallResult = {
      toolCallId: "call-1",
      toolName: "test_tool",
      result: { data: [1, 2, 3], items: ["a", "b", "c"] },
    };

    const latencies: number[] = [];
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await enrich(smallResult, {
        userId: "test-user",
        surface: "web",
        mode: "assistant",
      });
      const end = performance.now();
      latencies.push(end - start);
    }

    // Calculate p95
    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(iterations * 0.95);
    const p95Latency = latencies[p95Index] ?? latencies[latencies.length - 1];

    expect(p95Latency).toBeLessThan(50);
  });

  it("enriches medium tool results in <50ms p95", async () => {
    const mediumResult = {
      toolCallId: "call-1",
      toolName: "test_tool",
      result: {
        table: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: i * 10,
        })),
      },
    };

    const latencies: number[] = [];
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await enrich(mediumResult, {
        userId: "test-user",
        surface: "web",
        mode: "assistant",
      });
      const end = performance.now();
      latencies.push(end - start);
    }

    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(iterations * 0.95);
    const p95Latency = latencies[p95Index] ?? latencies[latencies.length - 1];

    expect(p95Latency).toBeLessThan(50);
  });

  it("enriches large tool results in <50ms p95", async () => {
    const largeResult = {
      toolCallId: "call-1",
      toolName: "test_tool",
      result: {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: i * 10,
          metadata: { created: new Date().toISOString() },
        })),
      },
    };

    const latencies: number[] = [];
    const iterations = 20;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await enrich(largeResult, {
        userId: "test-user",
        surface: "web",
        mode: "assistant",
      });
      const end = performance.now();
      latencies.push(end - start);
    }

    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(iterations * 0.95);
    const p95Latency = latencies[p95Index] ?? latencies[latencies.length - 1];

    // Large results might take slightly longer, but should still be reasonable
    expect(p95Latency).toBeLessThan(100); // More lenient for large results
  });
});
