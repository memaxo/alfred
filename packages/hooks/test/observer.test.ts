import type { HookContext, HookEvent, HookRegistry } from "@alfred/type";

import { describe, expect, it } from "bun:test";

import { HooksObserver } from "../../hookpipe/src/pipeline";

function createCtx(): HookContext {
  return {
    sessionId: "s1",
    workflowId: "w1",
    autonomy: 0.5,
    cognitive: {
      state: "idle",
      autonomy: 0.5,
      physiology: { energy: 1, boredom: 0, frustration: 0 },
    },
    alfredVersion: "dev",
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

describe("hooks observer", () => {
  it("maps pipeline lifecycle events to workflow hooks", async () => {
    const seen: HookEvent[] = [];

    const registry: HookRegistry = {
      on() {
        return () => {};
      },
      async emit(event) {
        seen.push(event);
        return {};
      },
      loadConfig() {},
      registeredEvents() {
        return [];
      },
    };

    const observer = new HooksObserver({ registry, ctx: createCtx() });

    observer.onEvent({
      type: "pipeline:start",
      runId: "run_1",
      requirement: "req",
      timestamp: 0,
    });

    observer.onEvent({
      type: "pipeline:suspend",
      reason: "biometric_required",
      timestamp: 1,
    });

    observer.onEvent({
      type: "pipeline:resume",
      fromStage: "plan",
      timestamp: 2,
    });

    observer.onEvent({
      type: "agent:spawn",
      agentId: "a1",
      taskId: "t1",
      timestamp: 3,
    });

    observer.onEvent({
      type: "agent:stuck",
      agentId: "a1",
      reason: "loop_detected",
      timestamp: 4,
    });

    observer.onEvent({
      type: "agent:escalate-request",
      agentId: "a1",
      reason: "needs_clarification",
      details: "please confirm",
      severity: "warning",
      timestamp: 5,
    });

    await observer.flush();

    expect(seen).toHaveLength(6);
    expect(seen[0]).toMatchObject({
      type: "workflow:start",
      workflowId: "run_1",
      taskSummary: "req",
    });
    expect(seen[1]).toMatchObject({
      type: "workflow:suspend",
      workflowId: "run_1",
      reason: "biometric_required",
    });
    expect(seen[2]).toMatchObject({
      type: "workflow:resume",
      workflowId: "run_1",
      bioTicketValid: true,
    });

    expect(seen[3]).toMatchObject({
      type: "agent:spawn",
      agentId: "a1",
      agentType: "pipeline",
      prompt: "t1",
      model: "unknown",
    });

    expect(seen[4]).toMatchObject({
      type: "agent:stuck",
      reason: "loop_detected",
      loopCount: 1,
      entropyScore: 0,
    });

    expect(seen[5]).toMatchObject({
      type: "agent:escalate",
      reason: "needs_clarification",
      details: "please confirm",
      suggestions: [],
      severity: "medium",
    });
  });
});
