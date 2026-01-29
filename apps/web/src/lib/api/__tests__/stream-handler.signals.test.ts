import type { UIMessage } from "@alfred/type/stream";

import { afterAll, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { createRequire } from "node:module";

mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({ user: { id: "user-1" } }),
    },
  },
}));

mock.module("@alfred/agent/mcp", () => ({
  loadMcpTools: vi.fn().mockResolvedValue({
    tools: {},
    close: async () => {},
  }),
}));

const getModelForRoleMock = vi.fn().mockResolvedValue({
  model: { provider: "test", name: "mock-model" },
  modelKey: "openai/mock-model",
});
const getClassificationModelMock = vi.fn().mockResolvedValue({
  model: { provider: "test", name: "mock-classify" },
  modelKey: "cerebras/gpt-oss-120b",
});
mock.module("@alfred/agent/selector", () => ({
  getModelForRole: getModelForRoleMock,
  getClassificationModel: getClassificationModelMock,
}));

const judgeSignalsMock = vi.fn().mockResolvedValue({
  friction: [
    {
      type: "rephrasing_cascade",
      severity: "high",
      timing: "lagging",
      confidence: 0.9,
      stepNumber: 1,
      description: "User rephrased multiple times.",
      citations: ["user restated goal repeatedly"],
      detectedAt: Date.now(),
      metadata: {},
    },
  ],
  delight: [],
  interventions: [
    {
      action: "clarify",
      timing: "immediate",
      message: "Ask a clarifying question about the goal.",
      confidence: 0.8,
      decidedAt: Date.now(),
      metadata: {},
    },
  ],
});
mock.module("@alfred/agent/signals/judge", () => ({
  judgeSignals: judgeSignalsMock,
}));

mock.module("@alfred/metrics", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  signalsJudgeLatencySeconds: { startTimer: vi.fn(() => vi.fn()) },
  signalsDetectedTotal: { inc: vi.fn() },
  signalsInterventionsTotal: { inc: vi.fn() },
}));

mock.module("@alfred/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

mock.module("@alfred/history", () => ({
  buildHistoryContext: vi.fn(
    async ({ messages }: { messages: UIMessage[] }) => ({
      uiMessages: messages,
      modelMessages: messages,
      droppedMessages: 0,
      keptTokens: 0,
      droppedTokens: 0,
      selection: {
        kept: messages,
        dropped: [],
        tiers: new Map(),
        tierByMessage: new WeakMap(),
        keptTokens: 0,
        droppedTokens: 0,
        budget: {
          modelId: "mock-model",
          maxContextTokens: 1000,
          historyBudgetTokens: 900,
          systemTokens: 0,
          headroomTokens: 100,
        },
      },
    })
  ),
  calculateBudget: () => ({
    effectiveContextTokens: 4096,
    historyRatio: 0.7,
    systemReserveTokens: 512,
    headroomTokens: 256,
    toolingReserveTokens: 256,
  }),
  getOrCreateTracker: () => ({ record: vi.fn() }),
  getHistoryBudgetDefaults: () => ({}),
  historyContextSelectionDurationSeconds: {
    startTimer: vi.fn(() => vi.fn()),
  },
  historyContextTierDropsTotal: { inc: vi.fn() },
  historyContextTokensTotal: { inc: vi.fn() },
}));

mock.module("@alfred/agent/preference/prompt", () => ({
  buildPreferenceSystemPrompt: vi.fn().mockResolvedValue("pref"),
}));

const require = createRequire(import.meta.url);
const realAi = require("ai") as typeof import("ai");

let injectedMessages: unknown[] | undefined;
const preparePromiseRef: { current: Promise<void> | null } = { current: null };

mock.module("ai", () => ({
  ...realAi,
  // Ensure AI error exports exist even if upstream changes.
  InvalidPromptError:
    (realAi as any).InvalidPromptError ??
    class InvalidPromptError extends Error {
      static isInstance(error: unknown): boolean {
        return error instanceof InvalidPromptError;
      }
    },
  consumeStream: vi.fn(),
  generateId: () => "msg-generated",
  streamText: vi.fn().mockImplementation((opts: any) => {
    return {
      toUIMessageStreamResponse: () => {
        // Force one prepareStep execution to validate injection.
        injectedMessages = undefined;
        preparePromiseRef.current = (async () => {
          if (typeof opts.prepareStep === "function") {
            const res = await opts.prepareStep({
              messages: opts.messages,
              stepNumber: 1,
            });
            injectedMessages = res?.messages;
          }
        })();
        return new Response("ok");
      },
    };
  }),
}));

describe("handleStreamRequest signals injection", () => {
  const envRef: { current: string | undefined } = { current: undefined };
  beforeAll(() => {
    envRef.current = process.env.ALFRED_SIGNALS;
    process.env.ALFRED_SIGNALS = "1";
  });
  afterAll(() => {
    process.env.ALFRED_SIGNALS = envRef.current;
  });

  it("injects judge intervention via prepareStep", async () => {
    const { handleStreamRequest } = await import("../stream-handler");

    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "do the thing" }],
          },
        ],
        maxCostUsd: 1,
      }),
    });

    await handleStreamRequest(
      request,
      () => ({
        model: { provider: "test", name: "mock-model" },
        tools: {},
        stopWhen: vi.fn(),
        prepareStep: async ({ messages }: any) => ({ messages }),
      }),
      "chat"
    );

    await preparePromiseRef.current;

    expect(judgeSignalsMock).toHaveBeenCalled();
    expect(Array.isArray(injectedMessages)).toBe(true);
    const last = (injectedMessages as any[]).at(-1);
    expect(last?.role).toBe("system");
  });
});
