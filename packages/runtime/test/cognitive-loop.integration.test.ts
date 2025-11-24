import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import type { CognitiveState, Event, Outcome } from "@alfred/cognitive/state";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { resetCognitiveTables } from "./utils/cognitive-fixtures";

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = "sqlite::memory:";
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
  ts: now(),
});

const inputEvent = (content: string): Event =>
  ({
    _: "input",
    content,
    source: "user",
    ...withTimestamp({}),
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
  process.env.DATABASE_URL = originalDatabaseUrl;
});

  it("persists input events and transitions idle -> thinking", async () => {
    const streamId = stream("input");

    const state = await runCognitiveLoop!(
      ctx,
      streamId,
      inputEvent("Plan day")
    );
    expect(state._).toBe("thinking");

    const events = await cognitiveRepo!.getAllEvents(streamId);
    expect(events).toHaveLength(1);
    const payload = events[0]?.payload as Record<string, unknown>;
    expect(payload.content).toBe("Plan day");
  });

  it("replays prior events so completion yields reflection", async () => {
    const streamId = stream("complete");

    await runCognitiveLoop!(ctx, streamId, inputEvent("Plan trip"));
    const outcome: Outcome = { _: "success", result: "done", duration: 42 };

    const state = await runCognitiveLoop!(
      ctx,
      streamId,
      completeEvent(outcome)
    );
    expect(state._).toBe("reflecting");
    const reflectingState = state as Extract<
      CognitiveState,
      { _: "reflecting" }
    >;
    expect(reflectingState.outcome._).toBe("success");

    const events = await cognitiveRepo!.getAllEvents(streamId);
    expect(events).toHaveLength(2);
    expect(events[1]?.type).toBe("complete");
  });

  it("records entropy interrupts and updates physiology", async () => {
    const streamId = stream("interrupt");
    const firstState = await runCognitiveLoop!(
      ctx,
      streamId,
      inputEvent("Investigate loop")
    );

    const interrupt = interruptEvent("loop detected");
    const nextState = await runCognitiveLoop!(ctx, streamId, interrupt);

    expect(nextState._).toBe("thinking");
    expect(nextState.physiology.boredom).toBeGreaterThan(
      firstState.physiology.boredom
    );

    const events = await cognitiveRepo!.getAllEvents(streamId);
    expect(events).toHaveLength(2);
    expect(events[1]?.type).toBe("interrupt");
  });
});
