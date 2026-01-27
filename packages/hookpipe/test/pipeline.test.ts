import type { PipelineEvent } from "@alfred/pipeline";
import type { HookContext, HookEvent, HookRegistry } from "@alfred/type";

import { describe, expect, it } from "bun:test";

import { HooksObserver } from "../src/pipeline";

function createCtx(): HookContext {
  return {
    sessionId: "s1",
    workflowId: "wf-base",
    autonomy: 0.5,
    cognitive: {
      state: "idle",
      autonomy: 0.5,
      physiology: { energy: 1, boredom: 0, frustration: 0 },
    },
    alfredVersion: "test",
    projectDir: process.cwd(),
    emit: async () => {},
    signal: new AbortController().signal,
    log: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  };
}

function createRegistry(emitted: HookEvent[]): HookRegistry {
  return {
    on: () => () => {},
    emit: async (event) => {
      emitted.push(event as HookEvent);
      return {} as any;
    },
    loadConfig: () => {},
    registeredEvents: () => [],
  };
}

describe("hookpipe pipeline mapping", () => {
  it("maps pipeline stage/review/learn/budget/context events to workflow hook events", async () => {
    const emitted: HookEvent[] = [];
    const obs = new HooksObserver({
      registry: createRegistry(emitted),
      ctx: createCtx(),
    });

    const events: PipelineEvent[] = [
      {
        type: "pipeline:start",
        runId: "run-1",
        requirement: "req",
        timestamp: 1,
      },
      { type: "stage:enter", stage: "plan", timestamp: 2 },
      { type: "stage:progress", stage: "plan", message: "x", timestamp: 3 },
      { type: "stage:exit", stage: "plan", durationMs: 10, timestamp: 4 },
      {
        type: "review:check",
        check: { name: "typecheck", passed: true },
        timestamp: 5,
      },
      {
        type: "learn:insight",
        insight: { type: "pattern", content: "c", confidence: 1 },
        timestamp: 6,
      },
      { type: "context:set", key: "k", value: "v", timestamp: 7 },
      { type: "context:cache-hit", cacheKey: "ck", timestamp: 8 },
      {
        type: "budget:warning",
        costUsd: 1,
        budgetUsd: 10,
        percentUsed: 0.1,
        timestamp: 9,
      },
      { type: "budget:exceeded", costUsd: 11, budgetUsd: 10, timestamp: 10 },
    ];

    for (const e of events) {
      obs.onEvent(e);
    }
    await obs.flush();

    const types = emitted.map((e) => e.type);
    expect(types).toEqual([
      "workflow:start",
      "workflow:stage:enter",
      "workflow:stage:progress",
      "workflow:stage:exit",
      "workflow:review:check",
      "workflow:learn:insight",
      "workflow:context:set",
      "workflow:context:cache-hit",
      "workflow:budget:warning",
      "workflow:budget:exceeded",
    ]);

    const stageEnter = emitted.find((e) => e.type === "workflow:stage:enter") as
      | Extract<HookEvent, { type: "workflow:stage:enter" }>
      | undefined;
    expect(stageEnter?.workflowId).toBe("run-1");
    expect(stageEnter?.stage).toBe("plan");

    const budgetExceeded = emitted.find(
      (e) => e.type === "workflow:budget:exceeded"
    ) as Extract<HookEvent, { type: "workflow:budget:exceeded" }> | undefined;
    expect(budgetExceeded?.workflowId).toBe("run-1");
    expect(budgetExceeded?.costUsd).toBe(11);
  });
});
