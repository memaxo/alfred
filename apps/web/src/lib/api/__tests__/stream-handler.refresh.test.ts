import { afterAll, afterEach, describe, expect, it, mock, vi } from "bun:test";
import { createRequire } from "node:module";
import type { UIMessage } from "@alfred/type/stream";
import { z } from "zod";

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

const triggerPreferenceRefreshMock = vi.fn();
mock.module("@alfred/api/preference/refresh", () => ({
  triggerPreferenceRefresh: triggerPreferenceRefreshMock,
}));

const historyContextMock = vi.fn(async ({ messages }) => ({
  uiMessages: messages,
  modelMessages: messages,
  droppedMessages: 0,
  keptTokens: 100,
  droppedTokens: 0,
  selection: {
    kept: messages,
    dropped: [],
    tiers: new Map(),
    tierByMessage: new WeakMap(),
    keptTokens: 100,
    droppedTokens: 0,
    budget: {
      modelId: "openai/mock-model",
      maxContextTokens: 1000,
      historyBudgetTokens: 900,
      systemTokens: 0,
      headroomTokens: 100,
    },
  },
}));
mock.module("@alfred/history", () => ({
  buildHistoryContext: historyContextMock,
  getHistoryBudgetDefaults: () => ({}),
  historyContextSelectionDurationSeconds: {
    startTimer: vi.fn(() => vi.fn()),
  },
  historyContextTierDropsTotal: { inc: vi.fn() },
  historyContextTokensTotal: { inc: vi.fn() },
}));

const loggerErrorMock = vi.fn();
mock.module("@alfred/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerErrorMock,
    debug: vi.fn(),
  },
}));

const finishPromiseRef: { current: Promise<void> | null } = { current: null };
const require = createRequire(import.meta.url);
const realAi = require("ai") as typeof import("ai");

mock.module("ai", () => ({
  ...realAi,
  consumeStream: vi.fn(),
  generateId: () => "msg-generated",
  convertToModelMessages: (messages: UIMessage[]) =>
    messages as unknown as UIMessage[],
  pruneMessages: ({ messages }: { messages: UIMessage[] }) =>
    messages as unknown as UIMessage[],
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
const preferenceInjectionSpy = vi.spyOn(
  metrics.preferencePromptInjectionsTotal,
  "inc"
);
const preferenceFailureSpy = vi.spyOn(
  metrics.preferencePromptFailuresTotal,
  "inc"
);

describe("handleStreamRequest preference refresh integration", () => {
  it("triggers preference refresh after persisting initial and streamed messages", async () => {
    triggerPreferenceRefreshMock.mockReset();
    createConversationMock.mockClear();
    createMessageMock.mockClear();

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

    expect(triggerPreferenceRefreshMock).toHaveBeenCalledWith("user-1", {
      reason: "assistant_history_seed",
    });
    expect(triggerPreferenceRefreshMock).toHaveBeenCalledWith("user-1", {
      reason: "assistant_stream_complete",
    });
    expect(triggerPreferenceRefreshMock).toHaveBeenCalledTimes(2);
    expect(preferenceInjectionSpy).toHaveBeenCalledWith({
      source: "assistant",
    });
    expect(preferenceFailureSpy).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  preferenceInjectionSpy.mockClear();
  preferenceFailureSpy.mockClear();
});

afterAll(() => {
  mock.restore();
});
