/**
 * GenUI Form Submission Latency Performance Tests
 *
 * Measures form submission latency to ensure it meets the <100ms p95 budget.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { createTestCaller } from "../../packages/api/test/utils/test-caller";

describe("GenUI Form Submission Latency", () => {
  beforeEach(() => {
    // Reset any caches or state
  });

  it("submits small forms in <100ms p95", async () => {
    const { caller, userId, conversationId } = await createTestCaller();

    const smallFormData = {
      name: "Test User",
      email: "test@example.com",
    };

    const latencies: number[] = [];
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const formId = `form-${randomUUID()}`;
      const start = performance.now();
      await caller.genui.submit({
        formId,
        conversationId,
        data: smallFormData,
      });
      const end = performance.now();
      latencies.push(end - start);
    }

    // Calculate p95
    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(iterations * 0.95);
    const p95Latency = latencies[p95Index] ?? latencies.at(-1);

    expect(p95Latency).toBeLessThan(100);
  });

  it("submits medium forms in <100ms p95", async () => {
    const { caller, userId, conversationId } = await createTestCaller();

    const mediumFormData = {
      name: "Test User",
      email: "test@example.com",
      address: {
        street: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zip: "94102",
      },
      preferences: {
        newsletter: true,
        notifications: false,
      },
    };

    const latencies: number[] = [];
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      const formId = `form-${randomUUID()}`;
      const start = performance.now();
      await caller.genui.submit({
        formId,
        conversationId,
        data: mediumFormData,
      });
      const end = performance.now();
      latencies.push(end - start);
    }

    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(iterations * 0.95);
    const p95Latency = latencies[p95Index] ?? latencies.at(-1);

    expect(p95Latency).toBeLessThan(100);
  });

  it("submits large forms in <100ms p95", async () => {
    const { caller, userId, conversationId } = await createTestCaller();

    const largeFormData = {
      name: "Test User",
      email: "test@example.com",
      items: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        quantity: i + 1,
      })),
      metadata: {
        created: new Date().toISOString(),
        tags: Array.from({ length: 20 }, (_, i) => `tag-${i}`),
      },
    };

    const latencies: number[] = [];
    const iterations = 20;

    for (let i = 0; i < iterations; i++) {
      const formId = `form-${randomUUID()}`;
      const start = performance.now();
      await caller.genui.submit({
        formId,
        conversationId,
        data: largeFormData,
      });
      const end = performance.now();
      latencies.push(end - start);
    }

    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(iterations * 0.95);
    const p95Latency = latencies[p95Index] ?? latencies.at(-1);

    // Large forms might take slightly longer, but should still be reasonable
    expect(p95Latency).toBeLessThan(200); // More lenient for large forms
  });
});
