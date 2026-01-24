import type { CognitiveState, Event, Outcome } from "@alfred/cognitive/state";

import { timestamp } from "@alfred/cognitive/state";
import { RuntimeContext } from "@alfred/type/runtime-context";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";

import { resetCognitiveTables } from "./utils/cognitive-fixtures";

if (!process.env.BUN_TEST) {
  process.env.BUN_TEST = "1";
}

let runCognitiveLoop: typeof import("../src/loops/cognitive").runCognitiveLoop;
let cognitiveRepo: typeof import("@alfred/db").cognitiveRepo;

beforeAll(async () => {
  ({ runCognitiveLoop } = await import("../src/loops/cognitive"));
  ({ cognitiveRepo } = await import("@alfred/db"));
});

const ctx = new RuntimeContext([["scanContext", null]]);

const now = () => Date.now();
const withTimestamp = <T extends Record<string, unknown>>(event: T) => ({
  ...event,
  ts: timestamp(now()),
});

const inputEvent = (content: string): Event =>
  ({
    _: "input",
    content,
    source: "user",
    ...withTimestamp({}),
  }) as Event;

const timeoutEvent = (deadline: number): Event =>
  ({
    _: "timeout",
    deadline: timestamp(deadline),
  }) as Event;

const completeEvent = (outcome: Outcome): Event =>
  ({
    _: "complete",
    outcome,
    ...withTimestamp({}),
  }) as Event;

const interruptEvent = (reason: string): Event =>
  ({
    _: "interrupt",
    reason,
    priority: 1,
    ...withTimestamp({}),
  }) as Event;

const stream = (suffix: string) => `cognitive-test-${suffix}-${now()}`;

describe("runCognitiveLoop integration", () => {
  beforeEach(async () => {
    await resetCognitiveTables();
  });

  afterAll(async () => {
    await resetCognitiveTables();
  });

  it("persists input events and transitions idle -> thinking", async () => {
    const streamId = stream("input");

    // Idle -> Input -> Capturing
    const result1 = await runCognitiveLoop?.(
      ctx,
      streamId,
      inputEvent("Plan day")
    );
    expect(result1.state._).toBe("capturing");

    // Capturing -> Timeout -> Thinking
    const result2 = await runCognitiveLoop?.(
      ctx,
      streamId,
      timeoutEvent(now() + 1000)
    );
    expect(result2.state._).toBe("thinking");
    expect(result2.effects).toHaveLength(1);
    expect(result2.effects[0]).toMatchObject({
      type: "generate_response",
      input: "Plan day",
    });

    const events = await cognitiveRepo?.getAllEvents(streamId);
    expect(events).toHaveLength(2);
    const payload = events[0]?.payload as Record<string, unknown>;
    const eventData = payload.data as Record<string, unknown>;
    expect(eventData.content).toBe("Plan day");
  });

  it("replays prior events so completion yields reflection", async () => {
    const streamId = stream("complete");

    // Idle -> Input -> Capturing
    await runCognitiveLoop?.(ctx, streamId, inputEvent("Plan trip"));
    // Capturing -> Timeout -> Thinking
    await runCognitiveLoop?.(ctx, streamId, timeoutEvent(now() + 1000));

    const outcome: Outcome = { _: "success", result: "done", duration: 42 };

    // Thinking -> Complete -> Reflecting
    const result = await runCognitiveLoop?.(
      ctx,
      streamId,
      completeEvent(outcome)
    );
    expect(result.state._).toBe("reflecting");
    const reflectingState = result.state as Extract<
      CognitiveState,
      { _: "reflecting" }
    >;
    expect(reflectingState.outcome._).toBe("success");

    const events = await cognitiveRepo?.getAllEvents(streamId);
    expect(events).toHaveLength(3);
    expect(events[2]?.type).toBe("complete");
  });

  it("records entropy interrupts and updates physiology", async () => {
    const streamId = stream("interrupt");
    // Idle -> Input -> Capturing
    await runCognitiveLoop?.(ctx, streamId, inputEvent("Investigate loop"));
    // Capturing -> Timeout -> Thinking
    const firstResult = await runCognitiveLoop?.(
      ctx,
      streamId,
      timeoutEvent(now() + 1000)
    );
    const firstState = firstResult.state;

    const interrupt = interruptEvent("loop detected");
    // Thinking -> Interrupt -> Idle (with updated physiology)
    const nextResult = await runCognitiveLoop?.(ctx, streamId, interrupt);
    const nextState = nextResult.state;

    // Interrupt while thinking returns to idle (not thinking)
    // But verify the boredom increased
    expect(nextState._).toBe("idle");
    expect(nextState.physiology.boredom).toBeGreaterThan(
      firstState.physiology.boredom
    );

    const events = await cognitiveRepo?.getAllEvents(streamId);
    expect(events).toHaveLength(3);
    expect(events[2]?.type).toBe("interrupt");
  });
});
