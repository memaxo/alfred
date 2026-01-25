/**
 * State predicates and queries
 */

import type { CognitiveState } from "./types.js";

export const isActive = (state: CognitiveState): boolean => state._ !== "idle";

export const canInterrupt = (state: CognitiveState): boolean =>
  state._ === "thinking" || state._ === "deciding";

export const requiresInput = (state: CognitiveState): boolean =>
  state._ === "idle" || state._ === "reflecting";

export const isExecuting = (state: CognitiveState): boolean =>
  state._ === "executing";

export const duration = (state: CognitiveState, now?: number): number => {
  const currentTime = now ?? Date.now();
  switch (state._) {
    case "idle": {
      return currentTime - state.since;
    }
    case "capturing": {
      return currentTime - state.started;
    }
    case "thinking": {
      return currentTime - state.started;
    }
    case "deciding": {
      return state.deadline - currentTime;
    }
    case "executing": {
      return currentTime - state.started;
    }
    case "reflecting": {
      return 0;
    }
  }
};

export const isStale = (
  state: CognitiveState,
  threshold = 30_000,
  now?: number
): boolean => duration(state, now) > threshold;
