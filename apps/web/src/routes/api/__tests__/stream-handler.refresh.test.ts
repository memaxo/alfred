import { describe, expect, it, mock, vi } from "bun:test";
import { z } from "zod";
import type { UIMessage } from "@alfred/type/stream";

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

const loggerErrorMock = vi.fn();
mock.module("@alfred/api/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerErrorMock,
  },
}));

const finishPromiseRef: { current: Promise<void> | null } = { current: null };

mock.module("ai", () => ({
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
      () => ({ model: { provider: "test", name: "mock-model" } } as any),
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
  });
});
