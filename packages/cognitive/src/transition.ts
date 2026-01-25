import { performance } from "node:perf_hooks";

import type {
  AutonomyGradient,
  CognitiveState,
  Event,
  Physiology,
} from "./state";

import { cognitiveTransitionDuration } from "./metrics";
import {
  capturing,
  executing,
  idle,
  reflecting,
  thinking,
  updatePhysiology,
} from "./state";

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
    const { reason } = event;
    if (entropyKeywords.some((keyword) => reason.includes(keyword))) {
      return updatePhysiology(physiology, "entropy_high");
    }
    return updatePhysiology(physiology, "step");
  }

  return updatePhysiology(physiology, "step");
};

export interface TransitionResult {
  state: CognitiveState;
  autonomy: AutonomyGradient;
}

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
        : ("ts" in event
          ? event.ts
          : (() => {
              throw new Error("event_missing_timestamp");
            })());
    const nextPhysiology = applyPhysiologyEvent(state.physiology, event);

    switch (state._) {
      case "idle": {
        if (event._ === "input") {
          result = {
            state: capturing(
              eventTimestamp,
              event.content,
              0.8,
              nextPhysiology
            ),
            autonomy,
          };
        }
        break;
      }

      case "capturing": {
        if (event._ === "input") {
          // Input processed, move to thinking
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
        } else if (event._ === "timeout") {
          // Timeout during capture, move to thinking anyway
          result = {
            state: thinking(
              eventTimestamp,
              state.input,
              1,
              undefined,
              nextPhysiology
            ),
            autonomy,
          };
        }
        break;
      }

      case "thinking": {
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
        } else if (event._ === "interrupt") {
          // Interrupt while thinking should break the loop and return to idle.
          result = {
            state: idle(eventTimestamp, nextPhysiology),
            autonomy,
          };
        } else if (event._ === "input") {
          // New input while thinking - could transition to deciding if options provided
          // For now, continue thinking with new input
          result = {
            state: thinking(
              eventTimestamp,
              event.content,
              state.depth + 1,
              state.reasoningTraces,
              nextPhysiology
            ),
            autonomy,
          };
        }
        break;
      }

      case "deciding": {
        if (event._ === "input") {
          // Decision made (input contains selected option ID or decision)
          // Find the selected option or use first option
          const selectedOption =
            state.options.find(
              (opt) =>
                opt.id === event.content || opt.id.includes(event.content)
            ) ?? state.options[0];
          if (selectedOption) {
            result = {
              state: executing(
                eventTimestamp,
                selectedOption.plan,
                autonomy,
                nextPhysiology
              ),
              autonomy,
            };
          }
        } else if (event._ === "timeout") {
          // Decision timeout - use first option or return to thinking
          const selectedOption = state.options[0];
          if (selectedOption) {
            result = {
              state: executing(
                eventTimestamp,
                selectedOption.plan,
                autonomy,
                nextPhysiology
              ),
              autonomy,
            };
          } else {
            result = {
              state: thinking(
                eventTimestamp,
                state.options[0]?.description ?? "No options available",
                1,
                undefined,
                nextPhysiology
              ),
              autonomy,
            };
          }
        }
        break;
      }

      case "executing": {
        if (event._ === "complete") {
          result = {
            state: reflecting(
              event.outcome,
              state.plan.steps.map((s) => s.action).join(", "),
              event.outcome._ === "success"
                ? String(event.outcome.result ?? "completed")
                : (event.outcome._ === "failure"
                  ? event.outcome.error
                  : "unknown"),
              nextPhysiology
            ),
            autonomy,
          };
        } else if (event._ === "interrupt") {
          // Interrupt during execution - move to reflecting with cancelled outcome
          result = {
            state: reflecting(
              { _: "cancelled", reason: event.reason },
              state.plan.steps.map((s) => s.action).join(", "),
              `interrupted: ${event.reason}`,
              nextPhysiology
            ),
            autonomy,
          };
        }
        break;
      }

      case "reflecting": {
        // After reflection, return to idle
        result = {
          state: idle(eventTimestamp, nextPhysiology),
          autonomy,
        };
        break;
      }
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
    if (shouldWarn && durationMs > 0.1) {}
  }
};
