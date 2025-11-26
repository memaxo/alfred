import { describe, expect, it, mock } from "bun:test";
import { runAssistantForVoice } from "../src/voice/assistant";

// Mock dependencies
process.env.OPENAI_API_KEY = "mock-key";

// Mock Repo
const mockEvents: any[] = [];
mock.module("@alfred/db", () => ({
  cognitiveRepo: {
    getAllEvents: async () => mockEvents,
    appendEvent: async (streamId: string, type: string, payload: any) => {
      mockEvents.push({ streamId, type, payload });
      return {} as any;
    },
  },
  conversationRepo: {
    getConversationHistory: async () => ({ messages: [] }),
  },
  userRepo: {
    getPreferences: async () => [],
  },
}));

// Mock AI Generate
mock.module("../src/ai/generate", () => ({
  generateText: async () => ({ text: "I hear you" }),
  persistResult: async () => "replay-123",
}));

// Mock Runtime Loop to verify calls
const mockLoop = mock(async () => ({
  state: { _: "thinking", physiology: { energy: 1, boredom: 0, frustration: 0 } },
  effects: [],
}));
mock.module("@alfred/runtime", () => ({
  runCognitiveLoop: mockLoop,
}));

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
      state: { _: "thinking" },
      effects: [{ type: "generate_response", input: "Hello cognitive world" }],
    });
    mockLoop.mockResolvedValueOnce({
      state: { _: "reflecting" },
      effects: [],
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
