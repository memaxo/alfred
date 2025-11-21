import { describe, expect, it } from "bun:test";

import {
  enrichReasoningContext,
  extractReasoning,
  toKnowledge,
} from "../src/extractor";

describe("extractReasoning", () => {
  it("detects decision and alternative sentences", () => {
    const text =
      "We are considering option A to reduce latency. However, we might instead adopt option B.";

    const extraction = extractReasoning(text, {
      threadId: "thread-1",
      source: "unit",
    });

    const decision = extraction.facts.find(
      (fact) => fact.source === "decision-reasoning"
    );
    const alternative = extraction.facts.find(
      (fact) => fact.source === "alternative-reasoning"
    );

    expect(decision).toBeDefined();
    expect(decision?.content).toContain("considering option A");
    expect(alternative).toBeDefined();
    expect(alternative?.content).toContain("However, we might instead adopt");
  });
});

describe("enrichReasoningContext", () => {
  it("annotates fact sources with thread context", () => {
    const extraction = extractReasoning("We are considering option A.", {
      threadId: "alpha-thread",
      source: "reasoning:test",
    });
    const knowledge = toKnowledge(extraction);

    const enriched = enrichReasoningContext(knowledge, {
      threadId: "alpha-thread",
      sessionId: "exec-1",
      timestamp: Date.now(),
    });

    for (const entry of enriched) {
      if (entry.data._ === "fact") {
        expect(entry.data.source).toContain("alpha-thread");
      }
    }
  });
});
