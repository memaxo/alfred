import type { UIMessage } from "@alfred/type/stream";

import { afterAll, afterEach, describe, expect, it, mock, vi } from "bun:test";
import { createRequire } from "node:module";

type HistoryTier = "anchor" | "high" | "medium" | "low";

const createConversationMock = vi.fn().mockResolvedValue({ id: "conv-1" });
const createMessageMock = vi.fn().mockResolvedValue();
mock.module("@alfred/db/repo/conversation", () => ({
  createConversation: createConversationMock,
  createMessage: createMessageMock,
}));

const getModelForRoleMock = vi.fn().mockResolvedValue({
  model: { provider: "test", name: "mock-model" },
  modelKey: "openai/mock-model",
});
mock.module("@alfred/agent/selector", () => ({
  getModelForRole: getModelForRoleMock,
}));

mock.module("@alfred/agent/mcp", () => ({
  loadMcpTools: vi.fn().mockResolvedValue({
    tools: {},
    close: async () => {},
  }),
}));

mock.module("@alfred/agent/preference/prompt", () => ({
  buildPreferenceSystemPrompt: vi.fn().mockResolvedValue("pref"),
}));

mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({ user: { id: "user-1" } }),
    },
  },
}));

const loggerInfoMock = vi.fn();
mock.module("@alfred/logger", () => ({
  logger: {
    info: loggerInfoMock,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const buildHistoryContextMock = vi.fn(({ messages }) => {
  const droppedMessage: UIMessage = {
    id: "assistant-old",
    role: "assistant",
    parts: [{ type: "text", text: "old" }],
  };
  const tierByMessage = new WeakMap<UIMessage, HistoryTier>();
  tierByMessage.set(droppedMessage, "low");
  return Promise.resolve({
    uiMessages: messages.slice(-1),
    modelMessages: messages.slice(-1),
    droppedMessages: 1,
    keptTokens: 50,
    droppedTokens: 25,
    selection: {
      kept: messages.slice(-1),
      dropped: [droppedMessage],
      tiers: new Map([[droppedMessage.id, "low"]]),
      tierByMessage,
      keptTokens: 50,
      droppedTokens: 25,
      budget: {
        modelId: "mock-model",
        maxContextTokens: 1000,
        historyBudgetTokens: 900,
        systemTokens: 0,
        headroomTokens: 100,
      },
    },
  });
});

mock.module("@alfred/history", () => ({
  buildHistoryContext: buildHistoryContextMock,
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

const finishPromiseRef: { current: Promise<void> | null } = { current: null };
const require = createRequire(import.meta.url);
const realAi = require("ai") as typeof import("ai");

mock.module("ai", () => ({
  ...realAi,
  consumeStream: vi.fn(),
  generateId: () => "msg-generated",
  streamText: vi.fn().mockImplementation(() => ({
    toUIMessageStreamResponse: ({
      onFinish,
    }: {
      onFinish?: (args: {
        isAborted: boolean;
        messages?: UIMessage[];
      }) => Promise<void> | void;
    }) => {
      finishPromiseRef.current =
        onFinish?.({
          isAborted: false,
          messages: [
            {
              id: "assistant-1",
              role: "assistant",
              parts: [{ type: "text", text: "response" }],
            },
          ],
        }) ?? Promise.resolve();
      return new Response("ok", { status: 200 });
    },
  })),
}));

const { handleStreamRequest } = await import("../stream-handler");
const metrics = await import("@alfred/api/metrics");
const historyTokensIncSpy = vi.spyOn(metrics.historyContextTokensTotal, "inc");
const historyTierDropSpy = vi.spyOn(
  metrics.historyContextTierDropsTotal,
  "inc"
);
const preferenceHistoryPrunedSpy = vi.spyOn(
  metrics.preferenceHistoryPrunedTotal,
  "inc"
);

describe("handleStreamRequest history integration", () => {
  it("routes messages through buildHistoryContext and records metrics", async () => {
    buildHistoryContextMock.mockClear();

    const request = new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            id: "user-1",
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
          },
          {
            id: "assistant-old",
            role: "assistant",
            parts: [{ type: "text", text: "Older" }],
          },
        ] satisfies UIMessage[],
      }),
    });

    const response = await handleStreamRequest(
      request,
      () => ({ model: { provider: "test", name: "mock-model" } }) as any,
      "assistant"
    );

    expect(response.status).toBe(200);
    await finishPromiseRef.current;

    expect(buildHistoryContextMock).toHaveBeenCalledTimes(1);
    const callArgs = buildHistoryContextMock.mock.calls[0]?.[0];
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.source).toBe("assistant");
    expect(callArgs.modelId).toBe("openai/mock-model");

    expect(historyTokensIncSpy).toHaveBeenNthCalledWith(
      1,
      { source: "assistant", model: "openai/mock-model", action: "kept" },
      50
    );
    expect(historyTokensIncSpy).toHaveBeenNthCalledWith(
      2,
      { source: "assistant", model: "openai/mock-model", action: "dropped" },
      25
    );
    expect(historyTierDropSpy).toHaveBeenCalledWith({
      source: "assistant",
      tier: "low",
    });
    expect(preferenceHistoryPrunedSpy).toHaveBeenCalledWith(
      { source: "assistant" },
      1
    );
  });

  it("picks the active model per request (supports immediate flips)", async () => {
    getModelForRoleMock.mockResolvedValueOnce({
      model: { provider: "test", name: "model-1" },
      modelKey: "openai/model-1",
    });
    getModelForRoleMock.mockResolvedValueOnce({
      model: { provider: "test", name: "model-2" },
      modelKey: "openai/model-2",
    });

    const makeRequest = () =>
      new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              id: "user-1",
              role: "user",
              parts: [{ type: "text", text: "Hello" }],
            },
          ] satisfies UIMessage[],
        }),
      });

    buildHistoryContextMock.mockClear();

    const response1 = await handleStreamRequest(
      makeRequest(),
      () => ({ model: { provider: "test", name: "mock-model" } }) as any,
      "assistant"
    );
    expect(response1.headers.get("x-model")).toBe("openai/model-1");
    await finishPromiseRef.current;

    const response2 = await handleStreamRequest(
      makeRequest(),
      () => ({ model: { provider: "test", name: "mock-model" } }) as any,
      "assistant"
    );
    expect(response2.headers.get("x-model")).toBe("openai/model-2");
    await finishPromiseRef.current;

    expect(buildHistoryContextMock).toHaveBeenCalledTimes(2);
    expect(buildHistoryContextMock.mock.calls[0]?.[0]?.modelId).toBe(
      "openai/model-1"
    );
    expect(buildHistoryContextMock.mock.calls[1]?.[0]?.modelId).toBe(
      "openai/model-2"
    );
  });

  afterEach(() => {
    historyTokensIncSpy.mockClear();
    historyTierDropSpy.mockClear();
    preferenceHistoryPrunedSpy.mockClear();
  });
});

afterAll(() => {
  mock.restore();
});
