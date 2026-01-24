import { describe, expect, it } from "bun:test";

import type { UIMessage } from "../src/stream";

import { limitUiMessages, MAX_HISTORY_MESSAGES } from "../src/history";

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
        toolName: "fs.ls",
        input: { path: "." },
        output: type === "tool-result" ? { files: 3 } : undefined,
      } as UIMessage["parts"][number],
    ],
  };
}

describe("limitUiMessages", () => {
  it("returns a shallow copy when history is below the limit", () => {
    const messages = Array.from({ length: 10 }, (_, index) =>
      createTextMessage(index)
    );
    const limited = limitUiMessages(messages);
    expect(limited).toHaveLength(messages.length);
    expect(limited).not.toBe(messages);
  });

  it("retains the latest tool-call/tool-result pair even if it falls outside the clamp window", () => {
    const extra = 12;
    const textMessages = Array.from(
      { length: MAX_HISTORY_MESSAGES + extra },
      (_, index) => createTextMessage(index + 1000)
    );
    const toolCall = createToolMessage("tool-call", "old");
    const toolResult = createToolMessage("tool-result", "old");
    const messages = [toolCall, toolResult, ...textMessages];

    const limited = limitUiMessages(messages);

    expect(limited).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(limited[0]?.id).toBe(toolCall.id);
    expect(limited[1]?.id).toBe(toolResult.id);
  });

  it("retains a lone tool-result message outside the window", () => {
    const base = Array.from({ length: MAX_HISTORY_MESSAGES + 5 }, (_, index) =>
      createTextMessage(index + 2000)
    );
    const toolResult = createToolMessage("tool-result", "solo");
    const messages = [toolResult, ...base];

    const limited = limitUiMessages(messages);

    expect(limited[0]?.id).toBe(toolResult.id);
    expect(limited).toHaveLength(MAX_HISTORY_MESSAGES);
  });
});
