import { describe, expect, it } from "bun:test";
import type { UIMessage } from "@alfred/type/stream";
import {
  HISTORY_MAX_MESSAGES,
  pruneMessagesForStream,
} from "../stream-handler";

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
    const overLimit = HISTORY_MAX_MESSAGES + 15;
    const messages = Array.from({ length: overLimit }, (_, index) =>
      createTextMessage(index)
    );
    const { uiMessages, modelMessages, dropped } =
      pruneMessagesForStream(messages);
    expect(uiMessages).toHaveLength(HISTORY_MAX_MESSAGES);
    expect(modelMessages.length).toBeGreaterThan(0);
    expect(modelMessages.length).toBeLessThanOrEqual(HISTORY_MAX_MESSAGES);
    expect(uiMessages[0]?.id).toBe(
      `msg-${overLimit - HISTORY_MAX_MESSAGES}`
    );
    expect(dropped).toBe(overLimit - HISTORY_MAX_MESSAGES);
  });

  it("retains the latest tool-call and tool-result parts", () => {
    const base = Array.from({ length: HISTORY_MAX_MESSAGES + 5 }, (_, index) =>
      createTextMessage(index)
    );
    const messages: UIMessage[] = [...base, createToolMessage("tool-call"), createToolMessage("tool-result")];

    const { modelMessages } = pruneMessagesForStream(messages);
    const last = modelMessages.at(-1);
    expect(last).toBeTruthy();
    if (!last) return;
    const content = Array.isArray((last as { content?: unknown }).content)
      ? ((last as { content: Array<{ type?: string }> }).content)
      : [];
    expect(content.some((part) => part.type === "tool-result")).toBe(true);
  });
});
