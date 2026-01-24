import type { UIMessage } from "@alfred/type/stream";

import { afterAll, describe, expect, it, mock, vi } from "bun:test";
import { createRequire } from "node:module";

const createConversationMock = vi.fn().mockResolvedValue({ id: "conv-1" });
const createMessageMock = vi.fn().mockResolvedValue(undefined);
mock.module("@alfred/db/repo/conversation", () => ({
  createConversation: createConversationMock,
  createMessage: createMessageMock,
}));

mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: async () => null,
    },
  },
}));

mock.module("@alfred/agent", () => ({
  getModelId: () => "mock-model",
  buildTools: () => ({}),
  buildAssistantTools: () => ({}),
  getOpenAI: () => ({ chat: () => ({}) }),
  wrapLegacyToolToAISDK: () => ({}),
}));

mock.module("@alfred/agent/preference/prompt", () => ({
  buildPreferenceSystemPrompt: vi.fn().mockResolvedValue(""),
}));

mock.module("@alfred/api/preference/refresh", () => ({
  triggerPreferenceRefresh: vi.fn(),
}));

mock.module("@alfred/api/metrics", () => ({
  historyContextSelectionDurationSeconds: { startTimer: vi.fn(() => vi.fn()) },
  historyContextTierDropsTotal: { inc: vi.fn() },
  historyContextTokensTotal: { inc: vi.fn() },
  preferenceHistoryPrunedTotal: { inc: vi.fn() },
  preferencePromptFailuresTotal: { inc: vi.fn() },
  preferencePromptInjectionsTotal: { inc: vi.fn() },
  sseConnectionRateLimitHitsTotal: { labels: () => ({ inc: vi.fn() }) },
  sseConnectionsCurrent: { labels: () => ({ set: vi.fn() }) },
  sseFirstChunkLatencySeconds: { labels: () => ({ observe: vi.fn() }) },
}));

mock.module("@alfred/history", () => ({
  buildHistoryContext: vi.fn(),
  getHistoryBudgetDefaults: () => ({}),
  historyContextSelectionDurationSeconds: {
    startTimer: vi.fn(() => vi.fn()),
  },
  historyContextTierDropsTotal: { inc: vi.fn() },
  historyContextTokensTotal: { inc: vi.fn() },
}));

mock.module("@alfred/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const streamTextMock = vi.fn();
const require = createRequire(import.meta.url);
const realAi = require("ai") as typeof import("ai");
mock.module("ai", () => ({
  ...realAi,
  consumeStream: vi.fn(),
  generateId: () => "msg-generated",
  streamText: streamTextMock,
}));

const { handleStreamRequest } = await import("../stream-handler");

describe("handleStreamRequest auth", () => {
  it("returns 401 when session is missing", async () => {
    const request = new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            id: "msg-1",
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

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "session_required" });
    expect(createConversationMock).not.toHaveBeenCalled();
    expect(createMessageMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

afterAll(() => {
  mock.restore();
});
