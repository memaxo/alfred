import type {
  HookContext,
  HooksJsonConfig,
  WorkflowStartEvent,
} from "@alfred/type";

import { describe, expect, it, mock } from "bun:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const realAi = require("ai") as typeof import("ai");

// Mock AI SDK generateObject BEFORE importing hooks registry/executor.
mock.module("ai", () => ({
  ...realAi,
  generateObject: async () => ({
    object: {
      userMessage: "prompt:workflow:start",
      decision: "allow",
    },
  }),
}));

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
    llm: {
      // The mocked generateObject ignores the model.
      model: {} as any,
      modelKey: "test-model",
    },
    log: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    ...overrides,
  };
}

describe("prompt hooks", () => {
  it("executes prompt hooks from hooks.json using generateObject", async () => {
    const reg = createHookRegistry();

    const config: HooksJsonConfig = {
      version: 1,
      hooks: {
        "workflow:start": [
          {
            type: "prompt",
            prompt:
              "If this is workflow:start, respond with allow and a userMessage.",
          },
        ],
      },
    };

    reg.loadConfig(config);

    const event: WorkflowStartEvent = {
      type: "workflow:start",
      workflowId: "wf",
      taskSummary: "a",
    };

    const out = await reg.emit(event, createCtx());
    expect(out.userMessage).toBe("prompt:workflow:start");
    expect(out.decision).toBe("allow");
  });
});
