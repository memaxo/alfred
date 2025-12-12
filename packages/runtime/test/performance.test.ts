/**
 * Performance Tests for Runtime
 *
 * Validates that runtime components meet performance budgets.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import type { KnowledgeFact, KnowledgeUpdate } from "@alfred/type/knowledge";
import type { KnowledgeConfidence } from "@alfred/type/knowledge";
import { assertBudget, withBudget } from "@alfred/test-kit";
import { ContextBuilder } from "../src/context";
import { LearningEngine } from "../src/engines/learning";

const toConfidence = (value: number) => value as KnowledgeConfidence;

describe("Performance: Context Builder", () => {
  let builder: ContextBuilder;

  beforeEach(() => {
    builder = new ContextBuilder();
  });

  it("context build meets uncached budget (<5s)", async () => {
    const result = await withBudget("context-uncached", 5000, async () =>
      builder.build({
        requirement: "test requirement",
        workspace: "/test",
      })
    );
    expect(result.withinBudget).toBe(true);
  });

  it("context build meets cached budget (<50ms)", async () => {
    // Warm cache
    await builder.build({
      requirement: "test requirement",
      workspace: "/test",
    });

    // Should be <50ms from cache
    const result = await withBudget("context-cached", 50, async () =>
      builder.build({
        requirement: "test requirement",
        workspace: "/test",
      })
    );
    expect(result.withinBudget).toBe(true);
  });

  it("cache eviction does not cause performance degradation", async () => {
    const maxCapacity = builder.getMaxCapacity();

    // Fill cache to capacity
    for (let i = 0; i < maxCapacity; i++) {
      await builder.build({
        requirement: `requirement ${i}`,
        workspace: "/test",
      });
    }

    // Next build should trigger eviction but still be fast
    const result = await withBudget("context-eviction", 5000, async () =>
      builder.build({
        requirement: "eviction trigger",
        workspace: "/test",
      })
    );
    expect(result.withinBudget).toBe(true);

    expect(builder.getCacheSize()).toBe(maxCapacity);
  });
});

describe("Performance: Learning Engine", () => {
  let engine: LearningEngine;

  beforeEach(() => {
    engine = new LearningEngine();
  });

  it("outcome recording is fast (<1ms per outcome)", async () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      engine.recordOutcome({
        input: `test ${i}`,
        output: `result ${i}`,
        expected: `expected ${i}`,
        error: 0,
        context: { index: i },
        ts: new Date().toISOString(),
      });
    }
    assertBudget("outcome-record-100", performance.now() - start, 100);
  });

  it("batch persistence meets budget (<1s per 100 updates)", async () => {
    const updates: KnowledgeUpdate[] = [];
    for (let i = 0; i < 100; i++) {
      const fact: KnowledgeFact = {
        id: `fact-${i}`,
        content: `value-${i}`,
        confidence: toConfidence(0.9),
        source: "test",
        timestamp: new Date().toISOString(),
      };
      updates.push({
        node: fact,
      });
    }

    const result = await withBudget("batch-persist-100", 1000, async () =>
      engine.persistUpdatesBatch(updates, "test-run-id")
    );
    expect(result.withinBudget).toBe(true);
  });

  it("large batch processing meets budget (<5s per 1000 updates)", async () => {
    const updates: KnowledgeUpdate[] = [];
    for (let i = 0; i < 1000; i++) {
      const fact: KnowledgeFact = {
        id: `insight-${i}`,
        content: `learning-${i}`,
        confidence: toConfidence(0.8),
        source: "test",
        timestamp: new Date().toISOString(),
      };
      updates.push({
        node: fact,
      });
    }

    const result = await withBudget("batch-persist-1000", 5000, async () =>
      engine.persistUpdatesBatch(updates, "test-run-id")
    );
    expect(result.withinBudget).toBe(true);
  });

  it("outcome eviction at capacity is fast (<1ms)", async () => {
    const maxCapacity = engine.getMaxCapacity();

    // Fill to capacity
    for (let i = 0; i < maxCapacity; i++) {
      engine.recordOutcome({
        input: `test ${i}`,
        output: `result ${i}`,
        expected: `expected ${i}`,
        error: 0,
        context: {},
        ts: new Date().toISOString(),
      });
    }

    // Recording past capacity should trigger eviction
    const start = performance.now();
    engine.recordOutcome({
      input: "eviction trigger",
      output: "result",
      expected: "expected",
      error: 0,
      context: {},
      ts: new Date().toISOString(),
    });
    assertBudget("outcome-eviction", performance.now() - start, 1);

    expect(engine.getOutcomeCount()).toBe(maxCapacity);
  });
});

describe("Performance: Budget Enforcement", () => {
  it("validates context build time is measured", async () => {
    const builder = new ContextBuilder();

    const start = performance.now();
    await builder.build({
      requirement: "test",
      workspace: "/test",
    });
    const duration = performance.now() - start;

    // Should complete in reasonable time (generous for CI)
    expect(duration).toBeLessThan(10_000); // 10 seconds
  });

  it("validates batch write time is measured", async () => {
    const engine = new LearningEngine();
    const fact: KnowledgeFact = {
      id: "fact-duration",
      content: "duration-test",
      confidence: toConfidence(0.9),
      source: "test",
      timestamp: new Date().toISOString(),
    };
    const updates: KnowledgeUpdate[] = [{ node: fact }];

    const start = performance.now();
    await engine.persistUpdatesBatch(updates, "test-run");
    const duration = performance.now() - start;

    // Should complete quickly (generous for CI)
    expect(duration).toBeLessThan(100); // 100ms
  });
});
