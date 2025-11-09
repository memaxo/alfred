import { describe, expect, it } from "bun:test";

import { captureReasoning } from "../src/flows";
import { evaluateReasoningQuality, type Outcome } from "../src/state";

describe("reasoning capture and evaluation", () => {
  it("captures traces and returns positive feedback on success", () => {
    const traces = [
      {
        text: "Considering approach alpha because it reduces latency.",
        timestamp: Date.now(),
      },
      {
        text: "However, option beta might improve resilience.",
        timestamp: Date.now() + 10,
      },
    ];

    const captured = captureReasoning(traces, {
      threadId: "thread-x",
      executionId: "exec-123",
    });

    expect(captured.facts.length).toBe(2);
    expect(Number(captured.confidence)).toBeGreaterThan(0.6);

    const outcome: Outcome = { _: "success", result: null, duration: 5_000 };
    const feedback = evaluateReasoningQuality(
      traces.map((trace) => trace.text),
      outcome
    );

    expect(feedback._).toBe("feedback");
    expect(feedback.positive).toBe(true);
    expect(feedback.strength).toBeGreaterThan(0.5);
  });
});
