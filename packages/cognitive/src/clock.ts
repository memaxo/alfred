/**
 * Clock Abstraction for Deterministic Testing
 *
 * Allows injection of time for pure functions that need timestamps.
 * Use systemClock in production, testClock for deterministic tests.
 */

export interface Clock {
  now: () => number;
}

/**
 * System clock using Date.now() - use in production
 */
export const systemClock: Clock = {
  now: () => Date.now(),
};

/**
 * Create a test clock with a fixed timestamp
 *
 * @param fixed - Fixed timestamp to return
 * @returns Clock that always returns the fixed timestamp
 */
export const testClock = (fixed: number): Clock => ({
  now: () => fixed,
});

/**
 * Create a test clock that advances by a fixed amount each call
 *
 * @param start - Starting timestamp
 * @param step - Amount to advance on each call (default: 1ms)
 * @returns Clock that advances each time now() is called
 */
export const advancingClock = (start: number, step = 1): Clock => {
  let current = start;
  return {
    now: () => {
      const result = current;
      current += step;
      return result;
    },
  };
};
