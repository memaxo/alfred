import { describe, expect, it, mock, vi } from "bun:test";
import type { UIMessage } from "@alfred/type/stream";
import { z } from "zod";

mock.module("@alfred/type/stream.zod", () => ({
  uiMessageSchema: z.object({
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.object({ type: z.literal("text"), text: z.string() })),
  }),
}));

mock.module("@alfred/db/repo/conversation", () => ({
  createConversation: vi.fn().mockResolvedValue({ id: "conv-1" }),
  createMessage: vi.fn().mockResolvedValue(undefined),
}));

mock.module("@alfred/agent", () => ({
  getModelId: () => "mock-model",
  assistantAgent: {
    stream: vi.fn().mockImplementation(async () => ({
      toUIMessageStreamResponse: ({ onFinish }: any) => {
        onFinish?.({ isAborted: false, messages: [] });
        return new Response("ok", { status: 200 });
      },
    })),
  },
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

mock.module("@alfred/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

mock.module("@alfred/history", () => ({
  buildHistoryContext: vi.fn(async ({ messages }) => ({
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
      budget: {},
    },
  })),
  getHistoryBudgetDefaults: () => ({}),
}));

mock.module("ai", () => ({
  consumeStream: vi.fn(),
  generateId: () => "msg-generated",
  // No need to mock streamText since we mock the agent.stream method
}));

// Import handler after mocks
const { handleAgentStreamRequest } = await import("../../agent-stream-handler");
const { assistantAgent } = await import("@alfred/agent");

describe("handleAgentStreamRequest integration", () => {
  it("should process request via ToolLoopAgent", async () => {
    const request = new Request("http://localhost/api/assistant-agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            id: "user-1",
            role: "user",
            parts: [{ type: "text", text: "Hello Agent" }],
          },
        ] satisfies UIMessage[],
      }),
    });

    const response = await handleAgentStreamRequest(
      request,
      assistantAgent,
      "assistant"
    );

    expect(response.status).toBe(200);
    expect(assistantAgent.stream).toHaveBeenCalledTimes(1);

    // Verify that history context messages were passed to agent
    const callArgs = (assistantAgent.stream as any).mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0].parts[0].text).toBe("Hello Agent");
  });
});
