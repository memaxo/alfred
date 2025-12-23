import { describe, expect, it } from "bun:test";

import { evaluateReasoningQuality } from "../src/state/reasoning";
import type { Outcome } from "../src/plan/types";

const successOutcome: Outcome = { _: "success", result: null, duration: 100 };
const failureOutcome: Outcome = {
  _: "failure",
  error: "boom",
  recoverable: true,
};

describe("evaluateReasoningQuality", () => {
  it("returns negative feedback for empty traces", () => {
    const result = evaluateReasoningQuality([], successOutcome);
    expect(result._).toBe("feedback");
    expect(result.positive).toBe(false);
    expect(result.strength).toBe(0.3);
  });

  it("returns positive feedback on success outcome", () => {
    const traces = ["I am considering the options"];
    const result = evaluateReasoningQuality(traces, successOutcome);
    expect(result._).toBe("feedback");
    expect(result.positive).toBe(true);
  });

  it("returns negative feedback on failure outcome", () => {
    const traces = ["I am considering the options"];
    const result = evaluateReasoningQuality(traces, failureOutcome);
    expect(result._).toBe("feedback");
    expect(result.positive).toBe(false);
  });

  it("increases score for longer traces (avg > 50 chars)", () => {
    const shortTraces = ["short"];
    const longTraces = [
      "This is a much longer reasoning trace that exceeds fifty characters easily",
    ];

    const shortResult = evaluateReasoningQuality(shortTraces, successOutcome);
    const longResult = evaluateReasoningQuality(longTraces, successOutcome);

    expect(longResult.strength).toBeGreaterThan(shortResult.strength);
  });

  it("increases score for decision point keywords", () => {
    const withoutDecision = ["I looked at the data"];
    const withDecision = ["I am considering the options and choosing carefully"];

    const noDecision = evaluateReasoningQuality(withoutDecision, successOutcome);
    const hasDecision = evaluateReasoningQuality(withDecision, successOutcome);

    expect(hasDecision.strength).toBeGreaterThan(noDecision.strength);
  });

  it("increases score for alternative exploration keywords", () => {
    const withoutAlternatives = ["I will do this"];
    const withAlternatives = ["However, alternatively I could try something else"];

    const noAlt = evaluateReasoningQuality(withoutAlternatives, successOutcome);
    const hasAlt = evaluateReasoningQuality(withAlternatives, successOutcome);

    expect(hasAlt.strength).toBeGreaterThan(noAlt.strength);
  });

  it("increases score for causal reasoning keywords", () => {
    const withoutCausal = ["I will do this"];
    const withCausal = ["Because of X, therefore Y leads to Z"];

    const noCausal = evaluateReasoningQuality(withoutCausal, successOutcome);
    const hasCausal = evaluateReasoningQuality(withCausal, successOutcome);

    expect(hasCausal.strength).toBeGreaterThan(noCausal.strength);
  });

  it("caps strength at 1.0", () => {
    const richTraces = [
      "I am carefully considering all options because this is critical. " +
        "However, alternatively I could choose differently. " +
        "Therefore, after selecting the best approach, I decided to proceed. " +
        "This leads to the optimal outcome thus achieving our goals.",
    ];

    const result = evaluateReasoningQuality(richTraces, successOutcome);
    expect(result.strength).toBeLessThanOrEqual(1);
  });

  it("handles multiple traces", () => {
    const traces = [
      "First I considered option A",
      "Then I thought about option B",
      "Finally I decided on C because it was best",
    ];

    const result = evaluateReasoningQuality(traces, successOutcome);
    expect(result._).toBe("feedback");
    expect(result.strength).toBeGreaterThan(0.5);
  });

  it("is case insensitive for keyword detection", () => {
    const uppercase = ["CONSIDERING THE OPTIONS"];
    const lowercase = ["considering the options"];

    const upper = evaluateReasoningQuality(uppercase, successOutcome);
    const lower = evaluateReasoningQuality(lowercase, successOutcome);

    expect(upper.strength).toBe(lower.strength);
  });

  it("handles partial and cancelled outcomes", () => {
    const traces = ["Some reasoning"];

    const partial = evaluateReasoningQuality(traces, {
      _: "partial",
      completed: ["a"],
      failed: ["b"],
    });
    expect(partial.positive).toBe(false);

    const cancelled = evaluateReasoningQuality(traces, {
      _: "cancelled",
      reason: "user",
    });
    expect(cancelled.positive).toBe(false);
  });
});
