import { beforeEach, describe, expect, it } from "bun:test";

import {
  calculateThreshold,
  clearThresholdCache,
  DEFAULT_OVERRIDE_THRESHOLD,
  getAllThresholds,
  getOverrideThresholdSync,
  MAX_OVERRIDE_THRESHOLD,
  MIN_OVERRIDE_THRESHOLD,
  MIN_SAMPLES_FOR_CALIBRATION,
} from "../src/lexicon/threshold";

describe("calculateThreshold", () => {
  it("returns default threshold when samples below minimum", () => {
    const threshold = calculateThreshold(0, MIN_SAMPLES_FOR_CALIBRATION - 1);
    expect(threshold).toBe(DEFAULT_OVERRIDE_THRESHOLD);
  });

  it("returns default threshold with zero error rate", () => {
    const threshold = calculateThreshold(0, MIN_SAMPLES_FOR_CALIBRATION);
    expect(threshold).toBe(DEFAULT_OVERRIDE_THRESHOLD);
  });

  it("returns minimum threshold with 100% error rate", () => {
    const threshold = calculateThreshold(100, 100);
    expect(threshold).toBeCloseTo(MIN_OVERRIDE_THRESHOLD, 3);
  });

  it("returns intermediate threshold with 50% error rate", () => {
    const threshold = calculateThreshold(50, 100);
    // 0.8 × 0.5 + 0.5 × 0.5 = 0.65
    const expected =
      DEFAULT_OVERRIDE_THRESHOLD * 0.5 + MIN_OVERRIDE_THRESHOLD * 0.5;
    expect(threshold).toBeCloseTo(expected, 3);
  });

  it("never exceeds maximum threshold", () => {
    const threshold = calculateThreshold(-10, 100); // Negative corrections (impossible but test bounds)
    expect(threshold).toBeLessThanOrEqual(MAX_OVERRIDE_THRESHOLD);
  });

  it("never goes below minimum threshold", () => {
    const threshold = calculateThreshold(200, 100); // More corrections than classifications (impossible)
    expect(threshold).toBeGreaterThanOrEqual(MIN_OVERRIDE_THRESHOLD);
  });

  it("decreases threshold as error rate increases", () => {
    const t10 = calculateThreshold(10, 100); // 10% error
    const t30 = calculateThreshold(30, 100); // 30% error
    const t50 = calculateThreshold(50, 100); // 50% error

    expect(t30).toBeLessThan(t10);
    expect(t50).toBeLessThan(t30);
  });
});

describe("getOverrideThresholdSync", () => {
  beforeEach(() => {
    clearThresholdCache();
  });

  it("returns default threshold for unknown domain", () => {
    const threshold = getOverrideThresholdSync("unknown_domain");
    expect(threshold).toBe(DEFAULT_OVERRIDE_THRESHOLD);
  });

  it("is case insensitive", () => {
    const t1 = getOverrideThresholdSync("Coding");
    const t2 = getOverrideThresholdSync("CODING");
    const t3 = getOverrideThresholdSync("coding");

    expect(t1).toBe(t2);
    expect(t2).toBe(t3);
  });
});

describe("getAllThresholds", () => {
  beforeEach(() => {
    clearThresholdCache();
  });

  it("returns empty array when cache is empty", () => {
    const thresholds = getAllThresholds();
    expect(thresholds).toEqual([]);
  });
});

describe("threshold constants", () => {
  it("has correct default values", () => {
    expect(DEFAULT_OVERRIDE_THRESHOLD).toBe(0.8);
    expect(MIN_OVERRIDE_THRESHOLD).toBe(0.5);
    expect(MAX_OVERRIDE_THRESHOLD).toBe(0.95);
    expect(MIN_SAMPLES_FOR_CALIBRATION).toBe(10);
  });

  it("maintains proper ordering", () => {
    expect(MIN_OVERRIDE_THRESHOLD).toBeLessThan(DEFAULT_OVERRIDE_THRESHOLD);
    expect(DEFAULT_OVERRIDE_THRESHOLD).toBeLessThan(MAX_OVERRIDE_THRESHOLD);
  });
});

describe("calibration scenarios", () => {
  it("domain with high accuracy keeps high threshold", () => {
    // 5% error rate
    const threshold = calculateThreshold(5, 100);
    // 0.8 × 0.95 + 0.5 × 0.05 = 0.76 + 0.025 = 0.785
    expect(threshold).toBeGreaterThan(0.75);
    expect(threshold).toBeLessThan(DEFAULT_OVERRIDE_THRESHOLD);
  });

  it("domain with moderate accuracy has moderate threshold", () => {
    // 20% error rate
    const threshold = calculateThreshold(20, 100);
    // 0.8 × 0.8 + 0.5 × 0.2 = 0.64 + 0.1 = 0.74
    expect(threshold).toBeGreaterThan(0.7);
    expect(threshold).toBeLessThan(0.8);
  });

  it("domain with low accuracy has low threshold", () => {
    // 40% error rate
    const threshold = calculateThreshold(40, 100);
    // 0.8 × 0.6 + 0.5 × 0.4 = 0.48 + 0.2 = 0.68
    expect(threshold).toBeGreaterThan(MIN_OVERRIDE_THRESHOLD);
    expect(threshold).toBeLessThan(0.7);
  });
});
