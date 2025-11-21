import { describe, expect, it } from "bun:test";
import type { UIMessage } from "@alfred/type/stream";
import { buildHistoryContext } from "../src";

function textMessage(
  id: string,
  role: UIMessage["role"],
  text: string
): UIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  };
}

describe("buildHistoryContext", () => {
  it("keeps latest user and assistant anchor even with tiny budgets", async () => {
    const messages: UIMessage[] = [
      textMessage("assistant-old", "assistant", "long context"),
      textMessage("assistant-bridge", "assistant", "remember"),
      textMessage("user-question", "user", "what now?"),
    ];

    const ctx = await buildHistoryContext({
      messages,
      modelId: "openai/gpt-4o-mini",
      budget: {
        maxContextTokens: 100,
        historyRatio: 0.05,
        minSystemReserveTokens: 0,
        minHeadroomTokens: 0,
        reservedToolingTokens: 0,
      },
    });

    expect(ctx.uiMessages.map((msg) => msg.id)).toEqual([
      "assistant-bridge",
      "user-question",
    ]);
    expect(ctx.selection.budget.historyBudgetTokens).toBeLessThanOrEqual(5);
  });

  it("preserves the latest tool chain as an anchor", async () => {
    const toolCall: UIMessage = {
      id: "tool-call",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "fs.stat",
          input: { path: "." },
        } as UIMessage["parts"][number],
      ],
    };
    const toolResult: UIMessage = {
      id: "tool-result",
      role: "assistant",
      parts: [
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "fs.stat",
          output: { size: 1 },
        } as UIMessage["parts"][number],
      ],
    };
    const filler = Array.from({ length: 20 }, (_, index) =>
      textMessage(
        `filler-${index}`,
        index % 2 === 0 ? "assistant" : "user",
        "noise"
      )
    );
    const messages = [...filler, toolCall, toolResult];

    const ctx = await buildHistoryContext({
      messages,
      modelId: "openai/gpt-4o-mini",
      budget: {
        maxContextTokens: 200,
        historyRatio: 0.05,
        minSystemReserveTokens: 0,
        minHeadroomTokens: 0,
        reservedToolingTokens: 0,
      },
    });

    const keptIds = ctx.uiMessages.map((msg) => msg.id);
    expect(keptIds).toContain("tool-call");
    expect(keptIds).toContain("tool-result");
  });

  it("tracks tiers and token deltas", async () => {
    const messages = Array.from({ length: 6 }, (_, index) =>
      textMessage(
        `msg-${index}`,
        index % 2 === 0 ? "user" : "assistant",
        `m-${index}`
      )
    );

    const ctx = await buildHistoryContext({
      messages,
      modelId: "openai/gpt-4o-mini",
      budget: {
        maxContextTokens: 120,
        historyRatio: 0.2,
        minSystemReserveTokens: 0,
        minHeadroomTokens: 0,
        reservedToolingTokens: 0,
      },
    });

    expect(ctx.keptTokens).toBeGreaterThan(0);
    expect(ctx.droppedTokens).toBeGreaterThanOrEqual(0);
    expect(ctx.selection.tierByMessage instanceof WeakMap).toBe(true);
    const dropped = ctx.selection.dropped;
    if (dropped.length > 0) {
      const tier = ctx.selection.tierByMessage.get(dropped[0]);
      expect(tier).toBeDefined();
    }
  });
});
