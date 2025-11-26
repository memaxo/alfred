import { afterAll, describe, expect, it, mock, vi } from "bun:test";
import type { Hypergraph } from "@alfred/knowledge/hypergraph";

const persistCalls: Array<{ resource: string; size: number }> = [];

mock.module("@alfred/agent/assistant/hypergraph-bridge", () => ({
  persistHypergraphToDb: vi.fn(async (graph: Hypergraph, resource: string) => {
    const size = graph && typeof graph.size === "function" ? graph.size() : 0;
    persistCalls.push({ resource, size });
  }),
}));

import { LearningEngine } from "../src/engines/learning";

describe("LearningEngine → RuntimeKnowledgeBridge integration", () => {
  it("applies supervised insights and calls persistHypergraphToDb with per-run resource", async () => {
    persistCalls.length = 0;

    const engine = new LearningEngine();

    engine.recordOutcome({
      input: "actual output",
      output: "wrong result",
      expected: "expected result",
      error: 1,
      context: { reason: "unit-test-supervision" },
      ts: new Date().toISOString(),
    });

    const updates = await engine.processOutcomes();
    expect(updates.length).toBeGreaterThan(0);

    const runId = `runtime-test-${Date.now()}`;
    await engine.persistUpdatesBatch(updates, runId);

    expect(persistCalls.length).toBe(1);
    const call = persistCalls[0];
    if (!call) {
      throw new Error("persistCalls[0] is null");
    }
    expect(call.resource).toBe(`runtime:${runId}`);
    expect(call.size).toBeGreaterThan(0);
  });

  afterAll(() => {
    mock.restore();
  });
});
