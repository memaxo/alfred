import { beforeAll, describe, expect, it, mock } from "bun:test";

// Install shared stubs used by router tests (db + agent) to keep this test
// isolated from real Postgres / OpenAI.
import "./utils/mock-db-client";
import "./utils/agent-mock";

// Mock dependencies
process.env.OPENAI_API_KEY = "mock-key";

// Mock AI Generate
mock.module("../src/ai/generate", () => ({
  generateText: async () => ({ text: "I hear you" }),
  persistResult: async () => "replay-123",
}));

// Mock Runtime Loop to verify calls
const mockLoop = mock(async () => ({
  effects: [],
  state: {
    _: "thinking",
    physiology: { energy: 1, boredom: 0, frustration: 0 },
  },
}));

let runAssistantForVoice: (typeof import("../src/voice/assistant"))["runAssistantForVoice"];

beforeAll(async () => {
  const runtimeAbs = new URL("../../runtime/src/index.ts", import.meta.url)
    .pathname;
  const realRuntime = await import(runtimeAbs);
  mock.module("@alfred/runtime", () => ({
    ...realRuntime,
    runCognitiveLoop: mockLoop,
  }));

  ({ runAssistantForVoice } = await import("../src/voice/assistant"));
});

describe("Voice -> Cognitive Integration", () => {
  it("emits input and complete events to the cognitive loop", async () => {
    const ctx = {
      set: () => {},
    };
    const input = {
      text: "Hello cognitive world",
      userId: "user-123",
    };

    mockLoop.mockResolvedValueOnce({
      effects: [{ type: "generate_response", input: "Hello cognitive world" }],
      state: { _: "thinking" },
    });
    mockLoop.mockResolvedValueOnce({
      effects: [],
      state: { _: "reflecting" },
    });

    await runAssistantForVoice(ctx as any, input);

    // Verify loop was called twice:
    // 1. 'input' event
    // 2. 'complete' event (outcome)
    expect(mockLoop).toHaveBeenCalledTimes(2);

    const firstCall = mockLoop.mock.calls[0];
    expect(firstCall[2]._).toBe("input");
    expect(firstCall[2].content).toBe("Hello cognitive world");

    const secondCall = mockLoop.mock.calls[1];
    expect(secondCall[2]._).toBe("complete");
    expect(secondCall[2].outcome._).toBe("success");
  });
});
