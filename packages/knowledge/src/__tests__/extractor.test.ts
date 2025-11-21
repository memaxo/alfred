import { describe, expect, test } from "bun:test";
import { extract, extractTemporal } from "../extractor.js";

describe("Knowledge Extractor", () => {
  test("extract entities using compromise", () => {
    const text = "Elon Musk founded SpaceX in 2002.";
    const result = extract(text, "test-source");

    expect(result.facts.length).toBeGreaterThan(0);
    const fact = result.facts[0];
    expect(fact.content).toContain("Elon Musk founded SpaceX");

    // compromise usually identifies Elon Musk as Person and SpaceX as Organization
    expect(result.entities.has("Elon Musk")).toBe(true);
    expect(result.entities.has("SpaceX")).toBe(true);
  });

  test("extract relations using verb heuristics", () => {
    const text = "Elon Musk founded SpaceX.";
    const result = extract(text, "test-source");

    // We expect a relation [Elon Musk, founded, SpaceX]
    const hasRelation = result.facts[0].relations.some(
      (r) => r[0] === "Elon Musk" && r[1] === "founded" && r[2] === "SpaceX"
    );
    expect(hasRelation).toBe(true);
  });

  test("extract temporal facts using chrono-node", () => {
    const text = "I have a meeting on Friday at 3pm.";
    const temporal = extractTemporal(text);

    expect(temporal.length).toBeGreaterThan(0);
    expect(temporal[0].time).toBeDefined();
    // chrono parsing depends on "now", so we just check if it parsed something valid
    expect(temporal[0].fact).toContain("meeting");
  });

  test("detect causal relationships", () => {
    const text = "The engine failed because the fuel pump was clogged.";
    const result = extract(text, "test-source");

    expect(result.causality.length).toBeGreaterThan(0);
    expect(result.causality[0].cause).toBe("The engine failed");
    expect(result.causality[0].effect).toBe("the fuel pump was clogged");
  });

  test("detect contradictions", () => {
    const text = "The sky is blue. The sky is not blue.";
    // Note: extract processes sentences one by one.
    // We need to pass a single text block that contains both for the contradiction check to happen
    // across the extracted facts from that block.
    const result = extract(text, "test-source");

    expect(result.contradictions.length).toBeGreaterThan(0);
  });
});
