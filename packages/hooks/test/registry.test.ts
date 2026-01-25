import type { HookContext, WorkflowStartEvent } from "@alfred/type";

import { describe, expect, it } from "bun:test";

import { createHookRegistry } from "../src/registry";

function createCtx(overrides: Partial<HookContext> = {}): HookContext {
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
    emit: async () => {},
    signal: new AbortController().signal,
    log: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    ...overrides,
  };
}

describe("hooks registry", () => {
  it("runs hooks in order and carries transformations", async () => {
    const reg = createHookRegistry();
    const event: WorkflowStartEvent = {
      type: "workflow:start",
      workflowId: "wf",
      taskSummary: "a",
    };

    reg.on("workflow:start", (e) => ({ ...e, taskSummary: "b" }));
    reg.on("workflow:start", () => ({ userMessage: "u2" }));

    const out = await reg.emit(event, createCtx());
    expect(out.userMessage).toBe("u2");
    expect(out.transformed?.taskSummary).toBe("b");
  });

  it("stops on deny", async () => {
    const reg = createHookRegistry();
    const event: WorkflowStartEvent = {
      type: "workflow:start",
      workflowId: "wf",
      taskSummary: "a",
    };

    let ran = false;
    reg.on("workflow:start", () => ({ decision: "deny", reason: "no" }));
    reg.on("workflow:start", () => {
      ran = true;
      return {};
    });

    const out = await reg.emit(event, createCtx());
    expect(out.decision).toBe("deny");
    expect(ran).toBe(false);
  });

  it("emits budget exceeded event", async () => {
    const events: unknown[] = [];
    const nowVals = [0, 100];
    const reg = createHookRegistry({
      now: () => nowVals.shift() ?? 0,
      budgets: [{ category: "workflow", budgetMs: 1, rationale: "test" }],
    });

    reg.on("workflow:start", () => ({}));
    await reg.emit(
      { type: "workflow:start", workflowId: "wf", taskSummary: "a" },
      createCtx({
        emit: async (e) => {
          events.push(e);
        },
      })
    );

    expect(events).toEqual([
      {
        type: "hook:budget:exceeded",
        hookEvent: "workflow:start",
        durationMs: 100,
        budgetMs: 1,
      },
      {
        type: "hook:executed",
        hookEvent: "workflow:start",
        durationMs: 100,
        budgetMs: 1,
        ok: true,
        decision: undefined,
        hook: { kind: "handler" },
      },
    ]);
  });

  it("fails closed by default for agent:shell:before", async () => {
    const reg = createHookRegistry();
    reg.on("agent:shell:before", () => {
      throw new Error("boom");
    });

    const out = await reg.emit(
      { type: "agent:shell:before", command: "rm -rf /", cwd: "/" },
      createCtx()
    );

    expect(out.decision).toBe("deny");
    expect(out.reason).toContain("hook_failed:boom");
  });
});
