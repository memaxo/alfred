import { afterAll, afterEach, describe, expect, it, mock, vi } from "bun:test";

const streamTextMock = vi.fn(() => ({
  fullStream: (async function* () {
    yield { type: "text-delta", id: "text-1", delta: "hello" };
    yield { type: "finish", finishReason: "stop" };
  })(),
}));

const validateUIMessagesMock = vi.fn(async ({ messages }) => messages);

mock.module("ai", () => ({
  streamText: streamTextMock,
  validateUIMessages: validateUIMessagesMock,
  stepCountIs: () => () => false,
}));

const buildHistoryContextMock = vi.fn(
  async ({ messages }: { messages: unknown[] }) => ({
    uiMessages: messages,
    modelMessages: messages,
    droppedMessages: 0,
    keptTokens: 100,
    droppedTokens: 0,
    selection: {
      kept: messages as any,
      dropped: [],
      tiers: new Map(),
      tierByMessage: new WeakMap(),
      keptTokens: 100,
      droppedTokens: 0,
      budget: {
        modelId: "test",
        maxContextTokens: 1000,
        historyBudgetTokens: 900,
        systemTokens: 0,
        headroomTokens: 100,
      },
    },
  })
);

mock.module("@alfred/history", () => ({
  buildHistoryContext: buildHistoryContextMock,
  getHistoryBudgetDefaults: () => ({}),
}));

const buildPreferenceSystemPromptMock = vi
  .fn()
  .mockResolvedValue("Preference Prompt");

mock.module("@alfred/agent/preference/prompt", () => ({
  buildPreferenceSystemPrompt: buildPreferenceSystemPromptMock,
}));

mock.module("../src/metrics", () => ({
  runtimeAiEventsTotal: { inc: vi.fn() },
  runtimeAiSdkCallsTotal: { inc: vi.fn() },
  runtimeAiSdkDurationSeconds: {
    startTimer: vi.fn().mockReturnValue(() => {}),
  },
  runtimeHistorySelectionDurationSeconds: {
    startTimer: vi.fn().mockReturnValue(() => {}),
  },
  runtimeHistoryTokensTotal: { inc: vi.fn() },
  runtimeHistoryTierDropsTotal: { inc: vi.fn() },
}));

// Use shared test utilities - import BEFORE any other imports
import { installLoggerMock } from "@alfred/test-kit/logger";

// Install shared mocks
installLoggerMock();

const { AISDKAdapter } = await import("../src/adapters/ai");

describe("AISDKAdapter preference prompts", () => {
  afterEach(() => {
    streamTextMock.mockClear();
    buildPreferenceSystemPromptMock.mockClear();
    validateUIMessagesMock.mockClear();
    buildHistoryContextMock.mockClear();
  });

  afterAll(() => {
    mock.restore();
  });

  it("injects preference prompt when userId provided", async () => {
    const adapter = new AISDKAdapter({ userId: "user-1" });
    const iterator = adapter.stream({ model: "test", messages: [] });

    for await (const _ of iterator) {
      // no events
    }

    expect(buildPreferenceSystemPromptMock).toHaveBeenCalledWith("user-1", {
      conversationType: "workflow",
      toolNames: undefined,
    });

    expect(validateUIMessagesMock).toHaveBeenCalledWith({
      messages: [],
      tools: undefined,
    });
    expect(validateUIMessagesMock).toHaveBeenCalledWith({
      messages: [],
      tools: undefined,
    });
    const args = streamTextMock.mock.calls[0]?.[0];
    expect(args.system).toContain("Preference Prompt");
  });

  it("merges existing system prompt with preference prompt", async () => {
    const adapter = new AISDKAdapter({ userId: "user-2" });
    const iterator = adapter.stream({
      model: "test",
      messages: [],
      system: "Base Prompt",
    });

    for await (const _ of iterator) {
      // drain iterator
    }

    const args = streamTextMock.mock.calls[0]?.[0];
    expect(args.system).toBe("Base Prompt\n\nPreference Prompt");
  });

  it("propagates validation errors before streaming", async () => {
    const adapter = new AISDKAdapter();
    validateUIMessagesMock.mockRejectedValueOnce(new Error("invalid"));

    const iterator = adapter.stream({ model: "test", messages: [] });

    await expect(
      (async () => {
        for await (const _ of iterator) {
          // no events
        }
      })()
    ).rejects.toThrow("invalid");

    expect(streamTextMock).not.toHaveBeenCalled();
    expect(validateUIMessagesMock).toHaveBeenCalled();
  });

  it("builds history context before streaming", async () => {
    const adapter = new AISDKAdapter();
    const messages = Array.from({ length: 5 }, (_, index) => ({
      id: `msg-${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      parts: [{ type: "text", text: `m-${index}` }],
    }));

    buildHistoryContextMock.mockResolvedValueOnce({
      uiMessages: messages.slice(-2),
      modelMessages: messages.slice(-2),
      droppedMessages: 3,
      keptTokens: 120,
      droppedTokens: 45,
      selection: {
        kept: messages.slice(-2),
        dropped: messages.slice(0, 3),
        tiers: new Map(),
        tierByMessage: new WeakMap(),
        keptTokens: 120,
        droppedTokens: 45,
        budget: {
          modelId: "test",
          maxContextTokens: 1000,
          historyBudgetTokens: 900,
          systemTokens: 0,
          headroomTokens: 100,
        },
      },
    });

    const iterator = adapter.stream({ model: "test", messages });
    for await (const _ of iterator) {
      // no events
    }

    expect(validateUIMessagesMock).toHaveBeenCalledWith({
      messages,
      tools: undefined,
    });
    expect(buildHistoryContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages,
        source: "runtime-ai-adapter",
      })
    );
    const streamedMessages = streamTextMock.mock.calls[0]?.[0]?.messages;
    expect(streamedMessages).toEqual(messages.slice(-2));
  });
});
