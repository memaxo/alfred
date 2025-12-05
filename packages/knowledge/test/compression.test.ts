import { describe, expect, it } from "bun:test";
import {
  calculateEffectiveHalfLife,
  decayConfidence,
  decayConfidenceAdaptive,
  getAccessMultiplier,
} from "../src/compression";
import type { Knowledge } from "../src/hypergraph";

// Helper to create a fact with specific confidence
function createFact(confidence: number): Knowledge {
  return {
    _: "fact",
    content: "test fact",
    confidence: confidence as Knowledge & { confidence: number },
    source: "test",
  } as Knowledge;
}

describe("decayConfidence (standard)", () => {
  const halfLife = 7 * 24 * 60 * 60 * 1000; // 7 days

  it("decays confidence by half after one half-life", () => {
    const node = createFact(1.0);
    const decayed = decayConfidence(node, halfLife, halfLife);

    expect(decayed._).toBe("fact");
    if (decayed._ === "fact") {
      expect(Number(decayed.confidence)).toBeCloseTo(0.5, 2);
    }
  });

  it("decays confidence by quarter after two half-lives", () => {
    const node = createFact(1.0);
    const decayed = decayConfidence(node, halfLife * 2, halfLife);

    if (decayed._ === "fact") {
      expect(Number(decayed.confidence)).toBeCloseTo(0.25, 2);
    }
  });

  it("does not decay relations", () => {
    const relation: Knowledge = {
      _: "relation",
      from: "node1" as Knowledge & { _: "fact" },
      to: "node2" as Knowledge & { _: "fact" },
      kind: "related_to",
      weight: 1.0,
    } as Knowledge;

    const decayed = decayConfidence(relation, halfLife, halfLife);
    expect(decayed).toEqual(relation);
  });
});

describe("decayConfidenceAdaptive", () => {
  const baseHalfLife = 7 * 24 * 60 * 60 * 1000; // 7 days

  it("decays like standard decay when accessCount=0", () => {
    const node = createFact(1.0);
    const standard = decayConfidence(node, baseHalfLife, baseHalfLife);
    const adaptive = decayConfidenceAdaptive(
      node,
      baseHalfLife,
      baseHalfLife,
      0
    );

    if (standard._ === "fact" && adaptive._ === "fact") {
      expect(Number(adaptive.confidence)).toBeCloseTo(
        Number(standard.confidence),
        3
      );
    }
  });

  it("decays slower with higher access count", () => {
    const node = createFact(1.0);
    const elapsed = baseHalfLife;

    // No access - standard decay
    const noAccess = decayConfidenceAdaptive(node, elapsed, baseHalfLife, 0);
    // Moderate access (9 times)
    const moderate = decayConfidenceAdaptive(node, elapsed, baseHalfLife, 9);
    // High access (99 times)
    const high = decayConfidenceAdaptive(node, elapsed, baseHalfLife, 99);

    if (noAccess._ === "fact" && moderate._ === "fact" && high._ === "fact") {
      // Higher access count should result in higher remaining confidence
      expect(Number(moderate.confidence)).toBeGreaterThan(
        Number(noAccess.confidence)
      );
      expect(Number(high.confidence)).toBeGreaterThan(
        Number(moderate.confidence)
      );
    }
  });

  it("correctly applies access multiplier formula", () => {
    const node = createFact(1.0);
    const elapsed = baseHalfLife;
    const accessCount = 9;

    // Expected multiplier: 1 + log(1 + 9) = 1 + log(10) ≈ 3.30
    const expectedMultiplier = 1 + Math.log(1 + accessCount);
    const effectiveHalfLife = baseHalfLife * expectedMultiplier;

    // Standard decay with effective half-life
    const expected = 0.5 ** (elapsed / effectiveHalfLife);

    const decayed = decayConfidenceAdaptive(
      node,
      elapsed,
      baseHalfLife,
      accessCount
    );

    if (decayed._ === "fact") {
      expect(Number(decayed.confidence)).toBeCloseTo(expected, 3);
    }
  });

  it("does not decay relations", () => {
    const relation: Knowledge = {
      _: "relation",
      from: "node1" as Knowledge & { _: "fact" },
      to: "node2" as Knowledge & { _: "fact" },
      kind: "related_to",
      weight: 1.0,
    } as Knowledge;

    const decayed = decayConfidenceAdaptive(
      relation,
      baseHalfLife,
      baseHalfLife,
      10
    );
    expect(decayed).toEqual(relation);
  });
});

describe("getAccessMultiplier", () => {
  it("returns 1.0 for accessCount=0", () => {
    const multiplier = getAccessMultiplier(0);
    expect(multiplier).toBeCloseTo(1.0, 5);
  });

  it("returns ~3.30 for accessCount=9", () => {
    // 1 + log(10) = 1 + 2.30 ≈ 3.30
    const multiplier = getAccessMultiplier(9);
    expect(multiplier).toBeCloseTo(1 + Math.log(10), 3);
    expect(multiplier).toBeGreaterThan(3);
    expect(multiplier).toBeLessThan(3.5);
  });

  it("returns ~4.61 for accessCount=99", () => {
    // 1 + log(100) = 1 + 4.61 = 5.61
    const multiplier = getAccessMultiplier(99);
    expect(multiplier).toBeCloseTo(1 + Math.log(100), 3);
    expect(multiplier).toBeGreaterThan(4);
    expect(multiplier).toBeLessThan(6);
  });

  it("returns ~6.91 for accessCount=999", () => {
    // 1 + log(1000) = 1 + 6.91 = 7.91
    const multiplier = getAccessMultiplier(999);
    expect(multiplier).toBeCloseTo(1 + Math.log(1000), 3);
    expect(multiplier).toBeGreaterThan(6);
    expect(multiplier).toBeLessThan(8);
  });

  it("increases logarithmically with access count", () => {
    const m1 = getAccessMultiplier(1);
    const m10 = getAccessMultiplier(10);
    const m100 = getAccessMultiplier(100);
    const m1000 = getAccessMultiplier(1000);

    // Each multiplier should be greater than the previous
    expect(m10).toBeGreaterThan(m1);
    expect(m100).toBeGreaterThan(m10);
    expect(m1000).toBeGreaterThan(m100);

    // The rate of increase should slow down (logarithmic)
    const increase1 = m10 - m1;
    const increase2 = m100 - m10;
    const increase3 = m1000 - m100;

    // Later increases are approximately equal (ln(x) property)
    expect(increase2).toBeCloseTo(increase3, 0);
  });
});

describe("calculateEffectiveHalfLife", () => {
  const baseHalfLife = 7 * 24 * 60 * 60 * 1000; // 7 days

  it("equals base half-life when accessCount=0", () => {
    const effective = calculateEffectiveHalfLife(baseHalfLife, 0);
    expect(effective).toBe(baseHalfLife);
  });

  it("doubles half-life at ~e-1 accesses", () => {
    // Need 1 + log(1+x) = 2, so log(1+x) = 1, so 1+x = e, so x = e-1 ≈ 1.72
    // For integer access, at x=2: multiplier = 1 + log(3) ≈ 2.10
    const effective = calculateEffectiveHalfLife(baseHalfLife, 2);
    expect(effective).toBeGreaterThan(baseHalfLife * 2);
    expect(effective).toBeLessThan(baseHalfLife * 2.2);
  });

  it("triples half-life at ~e²-1 accesses", () => {
    // Need 1 + log(1+x) = 3, so log(1+x) = 2, so 1+x = e², so x ≈ 6.39
    // For integer access, at x=6: multiplier = 1 + log(7) ≈ 2.95
    // At x=7: multiplier = 1 + log(8) ≈ 3.08
    const effective = calculateEffectiveHalfLife(baseHalfLife, 7);
    expect(effective).toBeGreaterThan(baseHalfLife * 3);
    expect(effective).toBeLessThan(baseHalfLife * 3.2);
  });

  it("scales linearly with base half-life", () => {
    const base1 = 1000;
    const base2 = 2000;
    const accessCount = 10;

    const effective1 = calculateEffectiveHalfLife(base1, accessCount);
    const effective2 = calculateEffectiveHalfLife(base2, accessCount);

    expect(effective2).toBe(effective1 * 2);
  });
});

describe("decay behavior scenarios", () => {
  const baseHalfLife = 7 * 24 * 60 * 60 * 1000; // 7 days
  const oneDay = 24 * 60 * 60 * 1000;

  it("frequently accessed node retains more confidence after 30 days", () => {
    const node = createFact(1.0);
    const elapsed = 30 * oneDay; // 30 days

    // Never accessed node
    const cold = decayConfidenceAdaptive(node, elapsed, baseHalfLife, 0);
    // Accessed 100 times
    const hot = decayConfidenceAdaptive(node, elapsed, baseHalfLife, 100);

    if (cold._ === "fact" && hot._ === "fact") {
      // Cold node should be nearly forgotten
      expect(Number(cold.confidence)).toBeLessThan(0.1);
      // Hot node should still be remembered
      expect(Number(hot.confidence)).toBeGreaterThan(0.3);
    }
  });

  it("seed node with low initial confidence can be overridden quickly", () => {
    const seedNode = createFact(0.5); // Seed confidence
    const elapsed = 14 * oneDay; // 2 weeks

    // Seed nodes typically have low access
    const decayed = decayConfidenceAdaptive(seedNode, elapsed, baseHalfLife, 1);

    if (decayed._ === "fact") {
      // Should decay to ~0.25 range
      expect(Number(decayed.confidence)).toBeLessThan(0.4);
    }
  });

  it("learned knowledge with high confidence and access persists", () => {
    const learnedNode = createFact(0.9); // High learned confidence
    const elapsed = 30 * oneDay;

    // Frequently accessed learned knowledge
    const decayed = decayConfidenceAdaptive(
      learnedNode,
      elapsed,
      baseHalfLife,
      50
    );

    if (decayed._ === "fact") {
      // Should still be above low confidence threshold (>0.4)
      // With access_count=50, multiplier = 1 + log(51) ≈ 4.93
      // effective_half_life = 7 days × 4.93 ≈ 34.5 days
      // After 30 days: 0.9 × 0.5^(30/34.5) ≈ 0.49
      expect(Number(decayed.confidence)).toBeGreaterThan(0.4);
    }
  });
});
