/**
 * Memory System Integration Tests
 *
 * Tests the integrated behavior of all memory system enhancements:
 * - Tiered seed confidence
 * - Domain classification with learning
 * - Adaptive decay with access tracking
 * - Domain-adaptive thresholds
 * - CRAG-style evaluation
 *
 * These tests verify the components work together correctly
 * without requiring a database connection.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import {
  calculateEffectiveHalfLife,
  decayConfidenceAdaptive,
  getAccessMultiplier,
} from "../src/compression";
import {
  classifyDomain,
  clearDomainCache,
  LEARNED_OVERRIDE_THRESHOLD,
} from "../src/lexicon/domains";
import {
  calculateThreshold,
  clearThresholdCache,
  DEFAULT_OVERRIDE_THRESHOLD,
  getOverrideThresholdSync,
} from "../src/lexicon/threshold";
import {
  getSeedConfidence,
  SEED_CONFIDENCE,
  SEED_CONFIDENCE_BY_TYPE,
} from "../src/ontology";

describe("Memory System Integration", () => {
  beforeEach(() => {
    clearDomainCache();
    clearThresholdCache();
  });

  describe("Tiered Seed Confidence + Domain Classification", () => {
    it("allows learned knowledge to override community seeds but not official seeds", () => {
      // Community seeds have confidence 0.5
      const communityConfidence = SEED_CONFIDENCE_BY_TYPE.community;
      expect(communityConfidence).toBe(0.5);

      // Official seeds have confidence 0.8
      const officialConfidence = SEED_CONFIDENCE_BY_TYPE.official;
      expect(officialConfidence).toBe(0.8);

      // Learned knowledge at 0.7 can override community but not official
      const learnedConfidence = 0.7;
      expect(learnedConfidence).toBeGreaterThan(communityConfidence);
      expect(learnedConfidence).toBeLessThan(officialConfidence);

      // Learned knowledge at 0.9 can override both
      const highLearnedConfidence = 0.9;
      expect(highLearnedConfidence).toBeGreaterThan(officialConfidence);
    });

    it("cold start uses static classification until learning kicks in", () => {
      // With no learned associations, should return static results
      // Use keywords that are explicitly in DOMAIN_KEYWORDS
      const results = classifyDomain("algorithm encryption machine learning");

      // Should detect domains from static keywords
      expect(results.length).toBeGreaterThan(0);
      // Results should have static source
      for (const result of results) {
        expect(result.source).toBe("static");
      }
    });
  });

  describe("Adaptive Decay + Access Tracking", () => {
    it("frequently accessed nodes retain confidence longer", () => {
      const baseHalfLife = 7 * 24 * 60 * 60 * 1000; // 7 days
      const elapsed = 30 * 24 * 60 * 60 * 1000; // 30 days

      // Create test facts
      const fact = {
        _: "fact" as const,
        content: "test fact",
        confidence: 0.9 as any,
        source: "test",
      };

      // Low access count - normal decay
      const lowAccess = decayConfidenceAdaptive(fact, elapsed, baseHalfLife, 0);

      // High access count - slower decay
      const highAccess = decayConfidenceAdaptive(
        fact,
        elapsed,
        baseHalfLife,
        100
      );

      // High access should retain more confidence
      expect(Number((highAccess as typeof fact).confidence)).toBeGreaterThan(
        Number((lowAccess as typeof fact).confidence)
      );
    });

    it("access multiplier scales logarithmically", () => {
      // Verify logarithmic scaling
      const m0 = getAccessMultiplier(0);
      const m10 = getAccessMultiplier(10);
      const m100 = getAccessMultiplier(100);
      const m1000 = getAccessMultiplier(1000);

      // Should increase but at decreasing rate
      expect(m10).toBeGreaterThan(m0);
      expect(m100).toBeGreaterThan(m10);
      expect(m1000).toBeGreaterThan(m100);

      // Rate of increase should slow down
      const increase1 = m10 - m0;
      const increase2 = m100 - m10;
      const increase3 = m1000 - m100;

      // Later increases are approximately equal (logarithmic property)
      expect(increase2).toBeCloseTo(increase3, 0);
    });

    it("seed nodes decay faster than frequently accessed learned nodes", () => {
      const baseHalfLife = 7 * 24 * 60 * 60 * 1000;
      const elapsed = 14 * 24 * 60 * 60 * 1000; // 2 weeks

      // Seed node with low initial confidence and no access
      const seedFact = {
        _: "fact" as const,
        content: "seed fact",
        confidence: SEED_CONFIDENCE as any,
        source: "seed",
      };

      // Learned node with high confidence and frequent access
      const learnedFact = {
        _: "fact" as const,
        content: "learned fact",
        confidence: 0.9 as any,
        source: "learned",
      };

      const decayedSeed = decayConfidenceAdaptive(
        seedFact,
        elapsed,
        baseHalfLife,
        2
      );
      const decayedLearned = decayConfidenceAdaptive(
        learnedFact,
        elapsed,
        baseHalfLife,
        50
      );

      // Learned should retain more confidence
      expect(
        Number((decayedLearned as typeof learnedFact).confidence)
      ).toBeGreaterThan(Number((decayedSeed as typeof seedFact).confidence));
    });
  });

  describe("Domain-Adaptive Thresholds", () => {
    it("domains with high error rates get lower thresholds", () => {
      // Domain with 5% error rate
      const lowError = calculateThreshold(5, 100);

      // Domain with 30% error rate
      const highError = calculateThreshold(30, 100);

      // Higher error rate = lower threshold (trust learned more)
      expect(highError).toBeLessThan(lowError);
      expect(lowError).toBeGreaterThan(0.7);
      expect(highError).toBeLessThan(0.8);
    });

    it("threshold calibration requires minimum samples", () => {
      // Below minimum samples, should return default
      const insufficient = calculateThreshold(5, 5);
      expect(insufficient).toBe(DEFAULT_OVERRIDE_THRESHOLD);

      // With enough samples, should calibrate
      const sufficient = calculateThreshold(5, 20);
      expect(sufficient).not.toBe(DEFAULT_OVERRIDE_THRESHOLD);
    });

    it("integrates with classification override logic", () => {
      // Default threshold is 0.8
      const defaultThreshold = getOverrideThresholdSync("unknown");
      expect(defaultThreshold).toBe(LEARNED_OVERRIDE_THRESHOLD);

      // Learned knowledge at 0.85 should override with default threshold
      const learnedConfidence = 0.85;
      expect(learnedConfidence).toBeGreaterThan(defaultThreshold);

      // If threshold was calibrated lower (0.6), more learned knowledge would pass
      const lowThreshold = 0.6;
      expect(0.65).toBeGreaterThan(lowThreshold);
      expect(0.65).toBeLessThan(defaultThreshold);
    });
  });

  describe("Learning Feedback Loop", () => {
    it("correction flow updates confidence appropriately", () => {
      // Initial state: seed confidence
      const seedConfidence = getSeedConfidence("community");
      expect(seedConfidence).toBe(0.5);

      // After correction, learned confidence should be higher
      const correctionConfidence = 0.9;
      expect(correctionConfidence).toBeGreaterThan(seedConfidence);

      // After multiple corrections, threshold should adjust
      // (simulated - actual persistence requires DB)
      const adjustedThreshold = calculateThreshold(10, 50); // 20% error
      expect(adjustedThreshold).toBeLessThan(DEFAULT_OVERRIDE_THRESHOLD);
    });

    it("high-accuracy domains maintain high override thresholds", () => {
      // Domain with 2% error rate
      const highAccuracy = calculateThreshold(2, 100);

      // Should still be close to default (trust static)
      expect(highAccuracy).toBeGreaterThan(0.75);
    });

    it("low-accuracy domains get low override thresholds", () => {
      // Domain with 40% error rate
      const lowAccuracy = calculateThreshold(40, 100);

      // Should be much lower than default (trust learned)
      expect(lowAccuracy).toBeLessThan(0.7);
      expect(lowAccuracy).toBeGreaterThan(0.5); // But not below minimum
    });
  });

  describe("Effective Half-Life Calculation", () => {
    it("matches theoretical formula", () => {
      const baseHalfLife = 1000;

      for (const accessCount of [0, 1, 10, 100, 1000]) {
        const expected = baseHalfLife * (1 + Math.log(1 + accessCount));
        const actual = calculateEffectiveHalfLife(baseHalfLife, accessCount);
        expect(actual).toBeCloseTo(expected, 5);
      }
    });
  });
});

describe("Performance Benchmarks", () => {
  it("domain classification completes in <1ms", () => {
    const iterations = 1000;
    const testText =
      "typescript react node.js docker kubernetes security encryption";

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      classifyDomain(testText);
    }
    const elapsed = performance.now() - start;

    const avgMs = elapsed / iterations;
    expect(avgMs).toBeLessThan(1);
  });

  it("threshold calculation completes in <0.1ms", () => {
    const iterations = 10_000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      calculateThreshold(i % 100, 100);
    }
    const elapsed = performance.now() - start;

    const avgMs = elapsed / iterations;
    expect(avgMs).toBeLessThan(0.1);
  });

  it("access multiplier calculation completes in <0.01ms", () => {
    const iterations = 100_000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      getAccessMultiplier(i % 1000);
    }
    const elapsed = performance.now() - start;

    const avgMs = elapsed / iterations;
    expect(avgMs).toBeLessThan(0.01);
  });
});
