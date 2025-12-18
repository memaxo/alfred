import { performance } from "node:perf_hooks";
import { cognitiveTransitionDuration } from "./metrics";
import type {
  AutonomyGradient,
  CognitiveState,
  Event,
  Physiology,
} from "./state";
import { idle, reflecting, thinking, updatePhysiology } from "./state";

const entropyKeywords = ["loop", "boredom"];

const applyPhysiologyEvent = (
  physiology: Physiology,
  event: Event
): Physiology => {
  if (event._ === "complete") {
    if (event.outcome._ === "success") {
      return updatePhysiology(physiology, "success");
    }
    if (event.outcome._ === "failure") {
      return updatePhysiology(physiology, "error");
    }
    return updatePhysiology(physiology, "step");
  }

  if (event._ === "interrupt") {
    const reason = event.reason;
    if (entropyKeywords.some((keyword) => reason.includes(keyword))) {
      return updatePhysiology(physiology, "entropy_high");
    }
    return updatePhysiology(physiology, "step");
  }

  return updatePhysiology(physiology, "step");
};

export type TransitionResult = {
  state: CognitiveState;
  autonomy: AutonomyGradient;
};

export const applyTransition = (
  state: CognitiveState,
  autonomy: AutonomyGradient,
  event: Event
): TransitionResult => {
  const start = performance.now();
  let result: TransitionResult | undefined;

  try {
    const eventTimestamp =
      event._ === "timeout"
        ? event.deadline
        : "ts" in event
          ? event.ts
          : Date.now();
    const nextPhysiology = applyPhysiologyEvent(state.physiology, event);

    switch (state._) {
      case "idle":
        if (event._ === "input") {
          result = {
            state: thinking(
              eventTimestamp,
              event.content,
              1,
              undefined,
              nextPhysiology
            ),
            autonomy,
          };
        }
        break;

      case "thinking":
        if (event._ === "complete") {
          result = {
            state: reflecting(
              event.outcome,
              "unknown",
              "unknown",
              nextPhysiology
            ),
            autonomy,
          };
        }
        break;

      case "reflecting":
        result = {
          state: idle(eventTimestamp, nextPhysiology),
          autonomy,
        };
        break;
    }

    if (!result) {
      result = {
        state: { ...state, physiology: nextPhysiology },
        autonomy,
      };
    }

    return result;
  } finally {
    const durationMs = performance.now() - start;
    const toState = result?.state._ ?? state._;

    cognitiveTransitionDuration.observe(
      {
        from_state: state._,
        to_state: toState,
        event_type: event._,
      },
      durationMs / 1000
    );

    // Keep production warnings, but avoid noisy perf-test output.
    const shouldWarn = process.env.NODE_ENV !== "test";
    if (shouldWarn && durationMs > 0.1) {
    }
  }
};
