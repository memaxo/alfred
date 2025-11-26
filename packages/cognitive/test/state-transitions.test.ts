import { describe, expect, it } from "bun:test";

import {
  idle,
  initialAutonomy,
  reflecting,
  thinking,
  type AutonomyGradient,
  type CognitiveState,
  type Event,
  type Outcome,
} from "../src/state";
import { applyTransition } from "../src/transition";

const auto = initialAutonomy(Date.now());

const inputEvent = (content: string): Event =>
  ({
    _: "input",
    content,
    source: "user",
    ts: Date.now(),
  }) as Event;

const successOutcome: Outcome = {
  _: "success",
  result: "ok",
  duration: 10,
};

const failureOutcome: Outcome = {
  _: "failure",
  error: "boom",
  recoverable: true,
};

const completeEvent = (outcome: Outcome): Event =>
  ({
    _: "complete",
    outcome,
    ts: Date.now(),
  }) as Event;

const interruptEvent = (reason: string): Event =>
  ({
    _: "interrupt",
    reason,
    priority: 1,
    ts: Date.now(),
  }) as Event;

const apply = (
  state: CognitiveState,
  event: Event,
  autonomy: AutonomyGradient = auto
) => applyTransition(state, autonomy, event);

describe("applyTransition", () => {
  it("moves idle -> thinking on input events", () => {
    const start = idle(Date.now());
    const result = apply(start, inputEvent("Plan lunch"));

    expect(result.state._).toBe("thinking");
    expect((result.state as Extract<CognitiveState, { _: "thinking" }>).about).toBe(
      "Plan lunch"
    );
    expect(result.state.physiology.energy).toBeLessThan(start.physiology.energy);
    expect(result.autonomy).toBe(auto);
  });

  it("moves thinking -> reflecting on completion", () => {
    const start = thinking(Date.now(), "Plan lunch");
    const result = apply(start, completeEvent(successOutcome));

    expect(result.state._).toBe("reflecting");
    expect(
      (result.state as Extract<CognitiveState, { _: "reflecting" }>).outcome._
    ).toBe("success");
  });

  it("returns to idle after reflection with updated physiology", () => {
    const start = reflecting(failureOutcome, "expected", "actual");
    const result = apply(start, inputEvent("next task"));

    expect(result.state._).toBe("idle");
    expect(result.state.physiology.energy).toBeLessThan(
      start.physiology.energy
    );
  });

  it("marks entropy-high interrupts by increasing boredom", () => {
    const start = thinking(Date.now(), "loop");
    const result = apply(start, interruptEvent("loop detected"));

    expect(result.state._).toBe("thinking");
    expect(result.state.physiology.boredom).toBeGreaterThan(
      start.physiology.boredom
    );
  });

  it("penalizes failed completion outcomes via physiology", () => {
    const start = thinking(Date.now(), "Plan lunch");
    const result = apply(start, completeEvent(failureOutcome));

    expect(result.state._).toBe("reflecting");
    expect(result.state.physiology.frustration).toBeGreaterThan(
      start.physiology.frustration
    );
  });
});
