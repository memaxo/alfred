import { afterEach, describe, expect, it, mock, vi } from "bun:test";
import { z } from "zod";
import type { UIMessage } from "@alfred/type/stream";

type HistoryTier = "anchor" | "high" | "medium" | "low";

mock.module("@alfred/type/stream.zod", () => ({
  uiMessageSchema: z.object({
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.object({ type: z.literal("text"), text: z.string() })),
  }),
}));

const createConversationMock = vi.fn().mockResolvedValue({ id: "conv-1" });
const createMessageMock = vi.fn().mockResolvedValue(undefined);
mock.module("@alfred/db/repo/conversation", () => ({
  createConversation: createConversationMock,
  createMessage: createMessageMock,
}));

mock.module("@alfred/agent", () => ({
  getModelId: () => "mock-model",
  buildTools: () => ({}),
  buildAssistantTools: () => ({}),
  getOpenAI: () => ({ chat: () => ({}) }),
  wrapLegacyToolToAISDK: () => ({}),
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
mock.module("@alfred/api/utils/logger", () => ({
  logger: {
    info: loggerInfoMock,
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const buildHistoryContextMock = vi.fn(async ({ messages }) => {
  const droppedMessage: UIMessage = {
    id: "assistant-old",
    role: "assistant",
    parts: [{ type: "text", text: "old" }],
  };
  const tierByMessage = new WeakMap<UIMessage, HistoryTier>();
  tierByMessage.set(droppedMessage, "low");
  return {
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
  };
});

mock.module("@alfred/history", () => ({
  buildHistoryContext: buildHistoryContextMock,
  getHistoryBudgetDefaults: () => ({})
}));

const finishPromiseRef: { current: Promise<void> | null } = { current: null };

mock.module("ai", () => ({
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
const historyTierDropSpy = vi.spyOn(metrics.historyContextTierDropsTotal, "inc");
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
      () => ({ model: { provider: "test", name: "mock-model" } } as any),
      "assistant"
    );

    expect(response.status).toBe(200);
    await finishPromiseRef.current;

    expect(buildHistoryContextMock).toHaveBeenCalledTimes(1);
    const callArgs = buildHistoryContextMock.mock.calls[0]?.[0];
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.source).toBe("assistant");

    expect(historyTokensIncSpy).toHaveBeenNthCalledWith(
      1,
      { source: "assistant", model: "mock-model", action: "kept" },
      50
    );
    expect(historyTokensIncSpy).toHaveBeenNthCalledWith(
      2,
      { source: "assistant", model: "mock-model", action: "dropped" },
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

  afterEach(() => {
    historyTokensIncSpy.mockClear();
    historyTierDropSpy.mockClear();
    preferenceHistoryPrunedSpy.mockClear();
  });
});
