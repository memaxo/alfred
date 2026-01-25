import { describe, expect, it, mock } from "bun:test";

process.env.OPENAI_API_KEY = "mock-key";
process.env.ANTHROPIC_API_KEY = "mock-key";

mock.module("@alfred/db", () => {
  return {
    cognitiveRepo: {
      getAllEvents: async () => [],
      getLatestSnapshot: async () => {},
      getEventsSince: async () => [],
      appendEvent: async () => ({}),
    },
  };
});

import type { Event } from "@alfred/cognitive/state";
import type { HookContext, HookRegistry } from "@alfred/type";

import { initialAutonomy } from "@alfred/cognitive/state";
import { cognitiveRepo } from "@alfred/db";

import { runCognitiveLoop } from "../src/loops/cognitive";

type Captured = { event: unknown; autonomy: number; state: string }[];

function createHooks(events: Captured) {
  const registry: HookRegistry = {
    on: () => () => {},
    emit: async (event, ctx) => {
      events.push({
        autonomy: ctx.autonomy,
        event,
        state: ctx.cognitive.state,
      });

      if (event.type === "cognitive:input") {
        return {
          transformed: {
            ...event,
            input: "hooked input",
          },
        } as any;
      }

      return {} as any;
    },
    loadConfig: () => {},
    registeredEvents: () => [],
  };

  const ctx: HookContext = {
    sessionId: "session-1",
    workflowId: "workflow-1",
    autonomy: 0.5,
    cognitive: {
      state: "idle",
      autonomy: 0.5,
      physiology: { energy: 1, boredom: 0, frustration: 0 },
    },
    alfredVersion: "test",
    projectDir: process.cwd(),
    emit: async () => {},
    signal: new AbortController().signal,
    log: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  };

  return {
    get: (key: string) => (key === "hooks" ? { registry, ctx } : undefined),
  };
}

describe("runCognitiveLoop hooks integration", () => {
  it("emits cognitive hooks and allows cognitive:input transformation", async () => {
    const events: Captured = [];
    const ctx = createHooks(events);

    const inputEvent: Event = {
      _: "input",
      content: "original",
      source: "user",
      ts: Date.now() as any,
    };

    const { state } = await runCognitiveLoop(
      ctx as any,
      "stream-1",
      inputEvent
    );

    expect(state._).toBe("capturing");
    // @ts-expect-error - state.input only exists on capturing
    expect(state.input).toBe("hooked input");

    const types = events.map((e) => (e.event as any).type);
    expect(types).toContain("cognitive:input");
    expect(types).toContain("cognitive:transition");
  });

  it("emits cognitive:learning when entering reflecting", async () => {
    const events: Captured = [];
    const ctx = createHooks(events);
    const now = Date.now();

    // @ts-expect-error - dynamically overriding mock function
    cognitiveRepo.getLatestSnapshot = async () => ({
      streamId: "stream-2",
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
      outcome: { _: "success", result: "done", duration: 10 },
      ts: now as any,
    };

    const { state } = await runCognitiveLoop(
      ctx as any,
      "stream-2",
      completeEvent
    );
    expect(state._).toBe("reflecting");

    const learning = events.find(
      (e) => (e.event as any).type === "cognitive:learning"
    );
    expect(learning).toBeDefined();
    expect((learning!.event as any).outcome).toBe("success");
  });

  it("emits cognitive:autonomy:change on feedback", async () => {
    const events: Captured = [];
    const ctx = createHooks(events);
    const auto = initialAutonomy(0);

    // @ts-expect-error - dynamically overriding mock function
    cognitiveRepo.getLatestSnapshot = async () => ({
      streamId: "stream-3",
      state: {
        _: "idle",
        since: 0,
        physiology: { energy: 0.9, boredom: 0.1, frustration: 0.1 },
        autonomy: auto,
      } as any,
      lastEventId: "event-1",
      createdAt: new Date(0),
    });
    // @ts-expect-error - dynamically overriding mock function
    cognitiveRepo.getEventsSince = async () => [];

    const feedbackEvent: Event = {
      _: "feedback",
      expected: "A",
      actual: "A",
      similarity: 0.9,
      ts: Date.now() as any,
    };

    await runCognitiveLoop(ctx as any, "stream-3", feedbackEvent);

    const autonomyChange = events.find(
      (e) => (e.event as any).type === "cognitive:autonomy:change"
    );
    expect(autonomyChange).toBeDefined();
  });
});
