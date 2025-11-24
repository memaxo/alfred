import {
  idle,
  reflecting,
  thinking,
  updatePhysiology,
} from "./state";
import type {
  AutonomyGradient,
  CognitiveState,
  Event,
  Physiology,
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
  const nextPhysiology = applyPhysiologyEvent(state.physiology, event);

  switch (state._) {
    case "idle":
      if (event._ === "input") {
        return {
          state: thinking(event.content, 1, undefined, nextPhysiology),
          autonomy,
        };
      }
      break;

    case "thinking":
      if (event._ === "complete") {
        return {
          state: reflecting(event.outcome, "unknown", "unknown", nextPhysiology),
          autonomy,
        };
      }
      break;

    case "reflecting":
      return {
        state: idle(nextPhysiology),
        autonomy,
      };
  }

  return {
    state: { ...state, physiology: nextPhysiology },
    autonomy,
  };
};
