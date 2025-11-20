import { describe, expect, it, mock } from "bun:test";
import { MAX_HISTORY_MESSAGES } from "@alfred/type/history";
import type { UIMessage } from "@alfred/type/stream";

mock.module("@alfred/agent", () => ({
  getModelId: () => "mock-model",
}));

const { pruneMessagesForStream } = await import("../stream-handler");

function createTextMessage(id: number): UIMessage {
  return {
    id: `msg-${id}`,
    role: id % 2 === 0 ? "user" : "assistant",
    parts: [{ type: "text", text: `message-${id}` }],
  };
}

function createToolMessage(type: "tool-call" | "tool-result"): UIMessage {
  return {
    id: `${type}-latest`,
    role: "assistant",
    parts: [
      {
        type,
        toolCallId: "call-123",
        toolName: "fs.ls",
        input: { path: "." },
        output: type === "tool-result" ? { files: 4 } : undefined,
      } as UIMessage["parts"][number],
    ],
  };
}

describe("pruneMessagesForStream", () => {
  it("returns original messages when below the limit", () => {
    const messages = Array.from({ length: 10 }, (_, index) =>
      createTextMessage(index)
    );
    const { uiMessages, modelMessages, dropped } =
      pruneMessagesForStream(messages);
    expect(dropped).toBe(0);
    expect(uiMessages).toHaveLength(messages.length);
    expect(modelMessages).toHaveLength(messages.length);
  });

  it("drops the oldest messages when above the limit", () => {
    const overLimit = MAX_HISTORY_MESSAGES + 15;
    const messages = Array.from({ length: overLimit }, (_, index) =>
      createTextMessage(index)
    );
    const { uiMessages, modelMessages, dropped } =
      pruneMessagesForStream(messages);
    expect(uiMessages).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(modelMessages.length).toBeGreaterThan(0);
    expect(modelMessages.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES);
    expect(uiMessages[0]?.id).toBe(
      `msg-${overLimit - MAX_HISTORY_MESSAGES}`
    );
    expect(dropped).toBe(overLimit - MAX_HISTORY_MESSAGES);
  });

  it("retains the latest tool-call and tool-result parts", () => {
    const base = Array.from({ length: MAX_HISTORY_MESSAGES + 5 }, (_, index) =>
      createTextMessage(index)
    );
    const messages: UIMessage[] = [...base, createToolMessage("tool-call"), createToolMessage("tool-result")];

    const { uiMessages } = pruneMessagesForStream(messages);
    const latest = uiMessages.at(-1);
    expect(latest?.parts[0]?.type).toBe("tool-result");
  });
});
