import { afterAll, afterEach, describe, expect, it, mock, vi } from "bun:test";

const streamTextMock = vi.fn(() => ({
  fullStream: (async function* () {
    return;
  })(),
}));

const validateUIMessagesMock = vi.fn(async ({ messages }) => messages);

mock.module("ai", () => ({
  streamText: streamTextMock,
  convertToModelMessages: (messages: unknown) => messages,
  validateUIMessages: validateUIMessagesMock,
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
});
