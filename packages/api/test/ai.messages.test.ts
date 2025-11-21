import { afterAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { MAX_HISTORY_MESSAGES } from "@alfred/type/history";
import type { UIMessage } from "@alfred/type/stream";
import { TRPCError } from "@trpc/server";

const validateUIMessagesMock = vi.fn(
  async ({ messages }: { messages: UIMessage[] }) => messages
);
const convertToModelMessagesMock = vi.fn((messages: UIMessage[]) => messages);
const pruneMessagesMock = vi.fn(({ messages }: { messages: UIMessage[] }) =>
  messages.slice(-5)
);

mock.module("ai", () => ({
  validateUIMessages: validateUIMessagesMock,
  convertToModelMessages: convertToModelMessagesMock,
  pruneMessages: pruneMessagesMock,
}));

const loggerInfoMock = vi.fn();
mock.module("../src/utils/logger", () => ({
  logger: {
    info: loggerInfoMock,
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { prepareModelMessagesForGenerate } = await import("../src/ai/messages");

beforeEach(() => {
  validateUIMessagesMock.mockClear().mockImplementation(
    async ({ messages }: { messages: UIMessage[] }) => messages
  );
  convertToModelMessagesMock.mockClear().mockImplementation(
    (messages: UIMessage[]) => messages
  );
  pruneMessagesMock.mockClear().mockImplementation(({ messages }) =>
    messages.slice(-5)
  );
  loggerInfoMock.mockClear();
});

afterAll(() => {
  mock.restore();
});

describe("prepareModelMessagesForGenerate", () => {
  function createTextMessage(id: number): UIMessage {
    return {
      id: `msg-${id}`,
      role: id % 2 === 0 ? "user" : "assistant",
      parts: [{ type: "text", text: `message-${id}` }],
    };
  }

  function createToolMessage(
    type: "tool-call" | "tool-result",
    suffix: string
  ): UIMessage {
    return {
      id: `${type}-${suffix}`,
      role: "assistant",
      parts: [
        {
          type,
          toolCallId: `call-${suffix}`,
          toolName: "fs.stat",
          input: { path: "." },
          output: type === "tool-result" ? { size: 42 } : undefined,
        } as UIMessage["parts"][number],
      ],
    };
  }

  it("clamps histories while retaining the newest tool chain and returns pruned model messages", async () => {
    const filler = Array.from(
      { length: MAX_HISTORY_MESSAGES + 8 },
      (_, index) => createTextMessage(index + 100)
    );
    const toolCall = createToolMessage("tool-call", "old");
    const toolResult = createToolMessage("tool-result", "old");
    const rawMessages = [toolCall, toolResult, ...filler];

    const result = await prepareModelMessagesForGenerate({
      rawMessages,
      tools: { helper: { description: "noop" } },
      source: "assistant",
    });

    expect(validateUIMessagesMock).toHaveBeenCalledTimes(1);
    const validatedArg = validateUIMessagesMock.mock.calls[0]?.[0]?.messages;
    expect(validatedArg).toHaveLength(rawMessages.length);

    const convertInput = convertToModelMessagesMock.mock.calls[0]?.[0];
    expect(convertInput).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(convertInput[0]?.id).toBe(toolCall.id);
    expect(convertInput[1]?.id).toBe(toolResult.id);
    expect(pruneMessagesMock).toHaveBeenCalledWith({
      messages: convertInput,
      reasoning: "before-last-message",
      toolCalls: "before-last-2-messages",
      emptyMessages: "remove",
    });
    expect(result).toEqual(pruneMessagesMock.mock.results[0]?.value);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      "assistant_history_pruned_generate",
      expect.objectContaining({ dropped: filler.length + 2 - MAX_HISTORY_MESSAGES })
    );
  });

  it("throws TRPCError when validation fails", async () => {
    validateUIMessagesMock.mockRejectedValueOnce(new Error("invalid"));

    await expect(
      prepareModelMessagesForGenerate({
        rawMessages: [{ id: "bad" } as UIMessage],
        source: "assistant",
      })
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
