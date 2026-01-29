import type { UIMessage } from "@alfred/type/stream";

import { afterAll, describe, expect, it, mock, vi } from "bun:test";
import { createRequire } from "node:module";

mock.module("@alfred/api/utils/sse-connections", () => ({
  createConnection: () => ({ allowed: true, connectionId: "conn-1" }),
  getConnectionCount: () => 0,
  removeConnection: vi.fn(),
  updateConnectionActivity: vi.fn(),
}));

mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({ user: { id: "user-1" } }),
    },
  },
}));

mock.module("@alfred/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

mock.module("@alfred/db/repo/conversation", () => ({
  createConversation: vi.fn().mockResolvedValue({ id: "conv-1" }),
  createMessage: vi.fn().mockResolvedValue(null),
  deleteMessagesAfter: vi.fn().mockResolvedValue(),
}));

mock.module("@alfred/agent/preference/prompt", () => ({
  buildPreferenceSystemPrompt: vi.fn().mockResolvedValue(""),
}));

mock.module("@alfred/agent/selector", () => ({
  getModelForRole: vi.fn().mockResolvedValue({
    model: { provider: "test", name: "mock-model" },
    modelKey: "openai/mock-model",
  }),
}));

const closeSpy = vi.fn(async () => {});
mock.module("@alfred/agent/mcp", () => ({
  loadMcpTools: vi.fn().mockResolvedValue({
    tools: { ext__ping: { description: "x", execute: vi.fn() } },
    close: closeSpy,
  }),
}));

mock.module("@alfred/history", () => ({
  buildHistoryContext: vi.fn(async ({ messages }) => ({
    uiMessages: messages,
    modelMessages: messages,
    droppedMessages: 0,
    keptTokens: 1,
    droppedTokens: 0,
    selection: { dropped: [], tierByMessage: new WeakMap() },
  })),
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

const streamTextMock = vi.fn();
const require = createRequire(import.meta.url);
const realAi = require("ai") as typeof import("ai");
mock.module("ai", () => ({
  ...realAi,
  consumeStream: vi.fn(),
  generateId: () => "msg-generated",
  streamText: streamTextMock.mockImplementation(({ onFinish }) => ({
    toUIMessageStreamResponse: () => {
      void onFinish?.({} as any);
      return new Response("ok", { status: 200 });
    },
  })),
}));

const { handleStreamRequest } = await import("../stream-handler");

describe("handleStreamRequest MCP tool merge", () => {
  it("merges MCP tools into the streamText toolset and closes on finish", async () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "user",
      parts: [{ type: "text", text: "Hello" }],
    };

    const request = new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [message] }),
    });

    const response = await handleStreamRequest(
      request,
      () =>
        ({ model: { provider: "test", name: "mock-model" }, tools: {} }) as any,
      "assistant"
    );

    expect(response.status).toBe(200);
    expect(streamTextMock).toHaveBeenCalled();
    const args = streamTextMock.mock.calls[0]?.[0] as any;
    expect(Object.keys(args.tools ?? {})).toContain("ext__ping");
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});

afterAll(() => {
  mock.restore();
});
