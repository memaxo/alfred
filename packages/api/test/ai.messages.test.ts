import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { UIMessage } from "@alfred/type/stream";
import { aiStub, metricsStub } from "./utils/mock-metrics";

type HistoryTier = "anchor" | "high" | "medium" | "low";

import { TRPCError } from "@trpc/server";

const validateUIMessagesMock = aiStub.validateUIMessages;

const buildHistoryContextMock = vi.fn(
  async ({ messages }: { messages: UIMessage[] }) => ({
    uiMessages: messages.slice(-3),
    modelMessages: messages.slice(-3),
    droppedMessages: messages.length - 3,
    keptTokens: 300,
    droppedTokens: 45,
    selection: {
      kept: messages.slice(-3),
      dropped: messages.slice(0, -3),
      tiers: new Map(),
      tierByMessage: new WeakMap<
        UIMessage,
        "low" | "medium" | "high" | "anchor"
      >(),
      keptTokens: 300,
      droppedTokens: 45,
      budget: {
        modelId: "unit-test-model",
        maxContextTokens: 1000,
        historyBudgetTokens: 900,
        systemTokens: 0,
        headroomTokens: 100,
      },
    },
  })
);

const historyAbs = new URL("../../history/src/index.ts", import.meta.url)
  .pathname;
const realHistory = await import(historyAbs);
mock.module("@alfred/history", () => ({
  ...realHistory,
  buildHistoryContext: buildHistoryContextMock,
  getHistoryBudgetDefaults: () => ({}),
}));

const loggerInfoMock = vi.fn();
mock.module("@alfred/logger", () => ({
  logger: {
    info: loggerInfoMock,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const metricMocks = {
  ...metricsStub,
  historyContextTokensTotal: { inc: vi.fn() },
  historyContextTierDropsTotal: { inc: vi.fn() },
  historyContextSelectionDurationSeconds: {
    startTimer: vi.fn().mockReturnValue(() => {}),
  },
};

mock.module("../src/metrics", () => metricMocks);

const { prepareModelMessagesForGenerate } = await import("../src/ai/messages");

beforeEach(() => {
  validateUIMessagesMock
    .mockClear()
    .mockImplementation(
      async ({ messages }: { messages: UIMessage[] }) => messages
    );
  buildHistoryContextMock
    .mockClear()
    .mockImplementation(async ({ messages }) => ({
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
        budget: {
          modelId: "unit-test-model",
          maxContextTokens: 1000,
          historyBudgetTokens: 900,
          systemTokens: 0,
          headroomTokens: 100,
        },
      },
    }));
  loggerInfoMock.mockClear();
  metricMocks.historyContextTokensTotal.inc.mockClear();
  metricMocks.historyContextTierDropsTotal.inc.mockClear();
  metricMocks.historyContextSelectionDurationSeconds.startTimer.mockClear();
  metricMocks.historyContextSelectionDurationSeconds.startTimer.mockReturnValue(
    () => {}
  );
});

describe("prepareModelMessagesForGenerate", () => {
  function createTextMessage(id: number): UIMessage {
    return {
      id: `msg-${id}`,
      role: id % 2 === 0 ? "user" : "assistant",
      parts: [{ type: "text", text: `message-${id}` }],
    };
  }

  it("builds history context and logs drops", async () => {
    const rawMessages = Array.from({ length: 8 }, (_, index) =>
      createTextMessage(index)
    );
    const tierByMessage = new WeakMap<UIMessage, HistoryTier>();
    const dropped = rawMessages.slice(0, 5);
    for (const msg of dropped) {
      tierByMessage.set(msg, "low");
    }
    buildHistoryContextMock.mockResolvedValueOnce({
      uiMessages: rawMessages.slice(-3),
      modelMessages: rawMessages.slice(-3),
      droppedMessages: 5,
      keptTokens: 120,
      droppedTokens: 45,
      selection: {
        kept: rawMessages.slice(-3),
        dropped,
        tiers: new Map(dropped.map((msg) => [msg.id, "low" as HistoryTier])),
        tierByMessage,
        keptTokens: 120,
        droppedTokens: 45,
        budget: {
          modelId: "unit-test-model",
          maxContextTokens: 1000,
          historyBudgetTokens: 900,
          systemTokens: 0,
          headroomTokens: 100,
        },
      },
    });

    const result = await prepareModelMessagesForGenerate({
      rawMessages,
      tools: { helper: { description: "noop" } },
      source: "assistant",
      model: "unit-test-model",
      system: "System prompt",
    });

    expect(validateUIMessagesMock).toHaveBeenCalledTimes(1);
    expect(buildHistoryContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: rawMessages,
        modelId: "unit-test-model",
        system: "System prompt",
        source: "assistant",
      })
    );
    expect(result).toEqual(rawMessages.slice(-3));
    expect(metricMocks.historyContextTokensTotal.inc).toHaveBeenNthCalledWith(
      1,
      { source: "assistant", model: "unit-test-model", action: "kept" },
      120
    );
    expect(metricMocks.historyContextTokensTotal.inc).toHaveBeenNthCalledWith(
      2,
      { source: "assistant", model: "unit-test-model", action: "dropped" },
      45
    );
    expect(metricMocks.historyContextTierDropsTotal.inc).toHaveBeenCalledWith({
      source: "assistant",
      tier: "low",
    });
    expect(loggerInfoMock).toHaveBeenCalledWith(
      "assistant_history_pruned_generate",
      expect.objectContaining({
        dropped: 5,
        keptTokens: 120,
        droppedTokens: 45,
      })
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

    expect(buildHistoryContextMock).not.toHaveBeenCalled();
  });
});
