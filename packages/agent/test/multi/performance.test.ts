import type { AgentId } from "@alfred/agent/orchestrator/multi/spawn";
import type { ContextBundle } from "@alfred/type/plan";

import { decomposeTask } from "@alfred/agent/orchestrator/multi/decompose";
import {
  createTrackerContext,
  updateTrackerWithContext,
} from "@alfred/agent/orchestrator/multi/tracker";
import { describe, expect, it } from "bun:test";
import { performance } from "node:perf_hooks";

// budget: plan-generation

const makeBundle = (count: number): ContextBundle => ({
  maxTokens: 2000,
  estimatedTokens: 200,
  files: Array.from({ length: count }, (_, idx) => ({
    path: `packages/agent/src/file-${idx}.ts`,
    startLine: 1,
    endLine: 50,
    tokens: 10,
    content: undefined,
  })),
});

describe("multi-agent performance budgets", () => {
  it("decomposes medium workloads within budget", () => {
    const iterations = 50;
    const bundle = makeBundle(40);
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) {
      decomposeTask(`Requirement ${i}`, {
        requirement: `Requirement ${i}`,
        bundle,
      });
    }
    const avg = (performance.now() - start) / iterations;
    expect(avg).toBeLessThan(5); // <5ms per decomposition
  });

  it("updates tracker context in under 1ms per event", () => {
    const events = 1000;
    let ctx = createTrackerContext([]);
    const start = performance.now();
    for (let i = 0; i < events; i += 1) {
      ctx = updateTrackerWithContext(ctx, {
        type: "agent/command",
        agentId: "agent-perf" as AgentId,
        command: `bun test ${i}`,
        status: "running",
        ts: Date.now(),
      });
    }
    const avg = (performance.now() - start) / events;
    expect(avg).toBeLessThan(1); // <1ms per update
  });
});
