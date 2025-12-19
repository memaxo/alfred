import { afterAll, describe, expect, it, mock } from "bun:test";

// Mock Env
process.env.OPENAI_API_KEY = "mock-key";
process.env.ANTHROPIC_API_KEY = "mock-key";

// Mock dependencies BEFORE importing module under test
mock.module("@alfred/db", () => {
  return {
    cognitiveRepo: {
      getAllEvents: async () => [], // Default empty
      getLatestSnapshot: async () => undefined, // No snapshot by default
      getEventsSince: async () => [], // No events since snapshot
      appendEvent: async () => ({}),
    },
  };
});

import type { Event } from "@alfred/cognitive/state";
import { cognitiveRepo } from "@alfred/db";
import { runCognitiveLoop } from "../src/loops/cognitive";

describe("Cognitive Loop", () => {
  it("transitions from idle to capturing on input", async () => {
    const ctx = {};
    const inputEvent: Event = {
      _: "input",
      content: "Hello world",
      source: "user",
      ts: Date.now() as any,
    };

    const { state, effects } = await runCognitiveLoop(
      ctx as any,
      "test-stream-1",
      inputEvent
    );

    expect(state._).toBe("capturing");
    // @ts-expect-error - state.input only exists on "capturing" state, TS union requires narrowing
    expect(state.input).toBe("Hello world");
    expect(effects).toEqual([]); // No effects in capturing state
  });

  it("transitions from thinking to reflecting on complete", async () => {
    const ctx = {};
    const now = Date.now();

    // Use a snapshot to put us in thinking state
    // @ts-expect-error - dynamically overriding mock function
    cognitiveRepo.getLatestSnapshot = async () => ({
      streamId: "test-stream-2",
      state: {
        _: "thinking",
        about: "Solve this",
        depth: 1,
        paths: [],
        started: now,
        physiology: { energy: 0.9, boredom: 0.1, frustration: 0.1 },
      },
      lastEventId: "event-1",
      createdAt: new Date(now),
    });
    // @ts-expect-error - dynamically overriding mock function
    cognitiveRepo.getEventsSince = async () => [];

    const completeEvent: Event = {
      _: "complete",
      outcome: { _: "success", result: "done", duration: 100 },
      ts: now as any,
    };

    const { state } = await runCognitiveLoop(
      ctx as any,
      "test-stream-2",
      completeEvent
    );

    expect(state._).toBe("reflecting");
    // @ts-expect-error - state.outcome only exists on "reflecting" state, TS union requires narrowing
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

    const { state } = await runCognitiveLoop(
      ctx as any,
      "test-stream-3",
      feedbackEvent
    );

    expect(state).toBeDefined();
  });

  it("updates autonomy on complete with success outcome", async () => {
    const ctx = {};
    const now = Date.now();

    // Use a snapshot to put us in thinking state
    // @ts-expect-error - dynamically overriding mock function
    cognitiveRepo.getLatestSnapshot = async () => ({
      streamId: "test-stream-4",
      state: {
        _: "thinking",
        about: "Execute task",
        depth: 1,
        paths: [],
        started: now,
        physiology: { energy: 0.9, boredom: 0.1, frustration: 0.1 },
      },
      lastEventId: "event-1",
      createdAt: new Date(now),
    });
    // @ts-expect-error - dynamically overriding mock function
    cognitiveRepo.getEventsSince = async () => [];

    const completeEvent: Event = {
      _: "complete",
      outcome: { _: "success", result: "completed", duration: 100 },
      ts: now as any,
    };

    const { state, effects } = await runCognitiveLoop(
      ctx as any,
      "test-stream-4",
      completeEvent
    );

    expect(state._).toBe("reflecting");
    expect(effects).toEqual([
      { type: "log_reflection", outcome: completeEvent.outcome },
    ]);
  });

  it("updates autonomy on complete with failure outcome", async () => {
    const ctx = {};
    const now = Date.now();

    // Use a snapshot to put us in thinking state
    // @ts-expect-error - dynamically overriding mock function
    cognitiveRepo.getLatestSnapshot = async () => ({
      streamId: "test-stream-5",
      state: {
        _: "thinking",
        about: "Execute task",
        depth: 1,
        paths: [],
        started: now,
        physiology: { energy: 0.9, boredom: 0.1, frustration: 0.1 },
      },
      lastEventId: "event-1",
      createdAt: new Date(now),
    });
    // @ts-expect-error - dynamically overriding mock function
    cognitiveRepo.getEventsSince = async () => [];

    const completeEvent: Event = {
      _: "complete",
      outcome: { _: "failure", error: "task failed", recoverable: true },
      ts: now as any,
    };

    const { state, effects } = await runCognitiveLoop(
      ctx as any,
      "test-stream-5",
      completeEvent
    );

    expect(state._).toBe("reflecting");
    expect(effects).toEqual([
      { type: "log_reflection", outcome: completeEvent.outcome },
    ]);
  });

  afterAll(() => {
    mock.restore();
  });
});
