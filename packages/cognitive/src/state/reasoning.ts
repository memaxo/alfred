/**
 * Reasoning quality evaluation
 */

import type { Evidence } from "../autonomy/types.js";
import type { Outcome } from "../plan/types.js";

export const evaluateReasoningQuality = (
  traces: string[],
  outcome: Outcome
): Evidence => {
  if (traces.length === 0) {
    return { _: "feedback", positive: false, strength: 0.3 };
  }

  const avgLength =
    traces.reduce((sum, text) => sum + text.length, 0) / traces.length;
  const hasDecisionPoints = traces.some((text) =>
    /considering|choosing|selecting|decided/i.test(text)
  );
  const hasAlternatives = traces.some((text) =>
    /however|alternatively|instead|but|though/i.test(text)
  );
  const hasCausalReasoning = traces.some((text) =>
    /because|therefore|thus|leads to|causes/i.test(text)
  );

  let score = 0.5;
  if (avgLength > 50) {
    score += 0.1;
  }
  if (hasDecisionPoints) {
    score += 0.15;
  }
  if (hasAlternatives) {
    score += 0.15;
  }
  if (hasCausalReasoning) {
    score += 0.1;
  }

  const positive = outcome._ === "success";
  const strength = Math.min(1, score);

  return { _: "feedback", positive, strength };
};
