import type { UIMessage } from "@alfred/type/stream";

import { describe, expect, it } from "bun:test";

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
    // Use messages with clear anchor pattern:
    // - assistant-old: NOT an anchor, should be pruned with tiny budget
    // - assistant-bridge: anchor (immediately before last user)
    // - user-question: anchor (last user message)
    const messages: UIMessage[] = [
      textMessage(
        "assistant-old",
        "assistant",
        "This is a much longer context message that should definitely exceed the tiny token budget we are providing for this test case. It contains lots of additional text to ensure it takes up many tokens when the estimator processes it."
      ),
      textMessage("assistant-bridge", "assistant", "remember this context"),
      textMessage("user-question", "user", "what now?"),
    ];

    const ctx = await buildHistoryContext({
      messages,
      modelId: "openai/gpt-4o-mini",
      budget: {
        // Extremely tiny budget to ensure non-anchor messages are pruned
        // With ratio 0.01 and max 10 tokens: historyWindow = floor(10 * 0.01) = 0
        maxContextTokens: 10,
        historyRatio: 0.01,
        minSystemReserveTokens: 0,
        minHeadroomTokens: 0,
        reservedToolingTokens: 0,
      },
    });

    // With zero budget, only anchors should be kept
    // Anchors are: last user message + assistant immediately before it
    const keptIds = ctx.uiMessages.map((msg) => msg.id);

    // The anchors MUST be kept regardless of budget
    // This is the core invariant we're testing
    expect(keptIds).toContain("assistant-bridge");
    expect(keptIds).toContain("user-question");

    // The result should have reasonable structure
    expect(ctx.selection.budget.historyBudgetTokens).toBeGreaterThanOrEqual(0);
    expect(ctx.keptTokens).toBeGreaterThan(0);
  });

  it("preserves the latest tool chain as an anchor", async () => {
    interface ToolCallPart {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
    interface ToolResultPart {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      output: unknown;
    }

    const toolCall: UIMessage = {
      id: "tool-call",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "search",
          input: { query: "hello" },
        } satisfies ToolCallPart,
      ] as unknown as UIMessage["parts"],
    };
    const toolResult: UIMessage = {
      id: "tool-result",
      role: "assistant",
      parts: [
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "search",
          output: { ok: true },
        } satisfies ToolResultPart,
      ] as unknown as UIMessage["parts"],
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
    const { dropped } = ctx.selection;
    if (dropped.length > 0) {
      const tier = ctx.selection.tierByMessage.get(dropped[0]);
      expect(tier).toBeDefined();
    }
  });
});
