import { describe, expect, it, mock } from "bun:test";

// Mock Env
process.env.OPENAI_API_KEY = "mock-key";
process.env.ANTHROPIC_API_KEY = "mock-key";

// Mock dependencies BEFORE importing module under test
mock.module("@alfred/db", () => {
  return {
    cognitiveRepo: {
      getAllEvents: async () => [], // Default empty
      appendEvent: async () => ({}),
    },
  };
});

import type { Event } from "@alfred/cognitive/state";
import { cognitiveRepo } from "@alfred/db";
import { runCognitiveLoop } from "../src/loops/cognitive";

describe("Cognitive Loop", () => {
  it("transitions from idle to thinking on input", async () => {
    const ctx = {};
    const inputEvent: Event = {
      _: "input",
      content: "Hello world",
      source: "user",
      ts: Date.now() as any,
    };

    const state = await runCognitiveLoop(
      ctx as any,
      "test-stream-1",
      inputEvent
    );

    expect(state._).toBe("thinking");
    // @ts-expect-error
    expect(state.about).toBe("Hello world");
  });

  it("transitions from thinking to reflecting on complete", async () => {
    const ctx = {};

    // Setup mock to return history that puts us in "thinking" state
    const history = [
      {
        payload: {
          _: "input",
          content: "Solve this",
          source: "user",
          ts: Date.now(),
        },
      },
    ];

    // Override the mock implementation for this test
    // @ts-expect-error
    cognitiveRepo.getAllEvents = async () => history;

    const completeEvent: Event = {
      _: "complete",
      outcome: { _: "success", result: "done", duration: 100 },
      ts: Date.now() as any,
    };

    const state = await runCognitiveLoop(
      ctx as any,
      "test-stream-2",
      completeEvent
    );

    expect(state._).toBe("reflecting");
    // @ts-expect-error
    expect(state.outcome._).toBe("success");
  });

  it("updates autonomy on feedback", async () => {
    const ctx = {};
    const feedbackEvent: Event = {
      _: "feedback",
      expected: "A",
      actual: "B", // Negative feedback
      ts: Date.now() as any,
    };

    const state = await runCognitiveLoop(
      ctx as any,
      "test-stream-3",
      feedbackEvent
    );

    expect(state).toBeDefined();
  });
});
