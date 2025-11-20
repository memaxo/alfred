import { afterAll, afterEach, describe, expect, it, mock, vi } from "bun:test";
import { MAX_HISTORY_MESSAGES } from "@alfred/type/history";

const streamTextMock = vi.fn(() => ({
  fullStream: (async function* () {
    return;
  })(),
}));

const validateUIMessagesMock = vi.fn(async ({ messages }) => messages);
const pruneMessagesMock = vi.fn(({ messages }) => messages);

mock.module("ai", () => ({
  streamText: streamTextMock,
  convertToModelMessages: (messages: unknown) => messages,
  validateUIMessages: validateUIMessagesMock,
  pruneMessages: pruneMessagesMock,
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
  runtimeAiSdkDurationSeconds: { startTimer: vi.fn().mockReturnValue(() => {}) },
}));

mock.module("../src/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { AISDKAdapter } = await import("../src/adapters/ai");

describe("AISDKAdapter preference prompts", () => {
  afterEach(() => {
    streamTextMock.mockClear();
    buildPreferenceSystemPromptMock.mockClear();
    validateUIMessagesMock.mockClear();
    pruneMessagesMock.mockClear();
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

  it("clamps and prunes messages before streaming", async () => {
    const adapter = new AISDKAdapter();
    const messages = Array.from(
      { length: MAX_HISTORY_MESSAGES + 10 },
      (_, index) => ({
        id: `msg-${index}`,
        role: index % 2 === 0 ? "user" : "assistant",
        parts: [{ type: "text", text: `m-${index}` }],
      })
    );

    pruneMessagesMock.mockImplementation(({ messages }) =>
      messages.slice(-5)
    );

    const iterator = adapter.stream({ model: "test", messages });
    for await (const _ of iterator) {
      // no events
    }

    const validatedArg = validateUIMessagesMock.mock.calls[0]?.[0]?.messages;
    expect(validatedArg).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(validatedArg?.[0]?.id).toBe(`msg-10`);

    expect(pruneMessagesMock).toHaveBeenCalledWith({
      messages: validatedArg,
      reasoning: "before-last-message",
      toolCalls: "before-last-2-messages",
      emptyMessages: "remove",
    });

    const streamedMessages = streamTextMock.mock.calls[0]?.[0]?.messages;
    expect(streamedMessages).toEqual(validatedArg.slice(-5));
  });
});
