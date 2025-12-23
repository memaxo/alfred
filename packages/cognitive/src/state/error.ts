/**
 * Error calculation (Levenshtein distance)
 */

import { performance } from "node:perf_hooks";

import { cognitiveErrorCalculationDuration } from "../metrics.js";

export const calculateError = (expected: string, actual: string): number => {
  const start = performance.now();
  try {
    if (expected === actual) {
      return 0;
    }
    if (expected.length === 0 || actual.length === 0) {
      return Math.max(expected.length, actual.length) === 0 ? 0 : 1;
    }

    const maxLen = Math.max(expected.length, actual.length);
    const [shorter, longer] =
      expected.length <= actual.length
        ? [expected, actual]
        : [actual, expected];

    let prevRow = Array.from({ length: shorter.length + 1 }, (_, i) => i);
    let currRow = new Array<number>(shorter.length + 1);

    for (let i = 1; i <= longer.length; i++) {
      currRow[0] = i;
      const longChar = longer.charCodeAt(i - 1);

      for (let j = 1; j <= shorter.length; j++) {
        const cost = longChar === shorter.charCodeAt(j - 1) ? 0 : 1;
        const insertion = currRow[j - 1]! + 1;
        const deletion = prevRow[j]! + 1;
        const substitution = prevRow[j - 1]! + cost;
        currRow[j] = Math.min(insertion, deletion, substitution);
      }

      [prevRow, currRow] = [currRow, prevRow];
    }

    return prevRow[shorter.length]! / maxLen;
  } finally {
    const durationMs = performance.now() - start;
    cognitiveErrorCalculationDuration.observe(durationMs / 1000);
    const shouldWarn = process.env.NODE_ENV !== "test";
    if (shouldWarn && durationMs > 0.1) {
      console.warn(
        `cognitive_error_calculation_slow: ${durationMs.toFixed(3)}ms (budget: 0.1ms)`
      );
    }
  }
};
