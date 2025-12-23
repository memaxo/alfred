import { describe, expect, it } from "bun:test";

import {
  bayesianUpdate,
  betaMode,
  betaVariance,
  decayPriorTowardBaseline,
} from "../src/autonomy/bayesian";
import { DEFAULT_BETA_PRIOR } from "../src/autonomy/types";
import { timestamp } from "../src/util/math";

describe("betaMode", () => {
  it("returns mean when alpha or beta <= 1", () => {
    expect(betaMode({ alpha: 1, beta: 5 })).toBeCloseTo(1 / 6, 8);
    expect(betaMode({ alpha: 5, beta: 1 })).toBeCloseTo(5 / 6, 8);
    expect(betaMode({ alpha: 0.5, beta: 0.5 })).toBeCloseTo(0.5, 8);
  });

  it("returns mode when alpha and beta > 1", () => {
    // mode = (alpha - 1) / (alpha + beta - 2)
    expect(betaMode({ alpha: 2, beta: 5 })).toBeCloseTo(1 / 5, 8);
    expect(betaMode({ alpha: 5, beta: 2 })).toBeCloseTo(4 / 5, 8);
    expect(betaMode({ alpha: 3, beta: 3 })).toBeCloseTo(0.5, 8);
  });

  it("handles symmetric distributions", () => {
    expect(betaMode({ alpha: 10, beta: 10 })).toBeCloseTo(0.5, 8);
  });
});

describe("betaVariance", () => {
  it("returns 0 when sum <= 0", () => {
    expect(betaVariance({ alpha: 0, beta: 0 })).toBe(0);
    expect(betaVariance({ alpha: -1, beta: 0 })).toBe(0);
  });

  it("calculates variance correctly", () => {
    // variance = (alpha * beta) / ((alpha + beta)^2 * (alpha + beta + 1))
    const { alpha, beta } = { alpha: 2, beta: 5 };
    const sum = alpha + beta;
    const expected = (alpha * beta) / (sum * sum * (sum + 1));
    expect(betaVariance({ alpha, beta })).toBeCloseTo(expected, 8);
  });

  it("decreases as sample size increases", () => {
    const small = betaVariance({ alpha: 2, beta: 3 });
    const large = betaVariance({ alpha: 20, beta: 30 });
    expect(large).toBeLessThan(small);
  });
});

describe("decayPriorTowardBaseline", () => {
  const now = 1_700_000_000_000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("returns prior unchanged when lastUpdate is undefined", () => {
    const prior = { alpha: 10, beta: 5 };
    const result = decayPriorTowardBaseline(now, undefined, prior);
    expect(result.alpha).toBe(10);
    expect(result.beta).toBe(5);
  });

  it("returns prior unchanged when time delta is 0 or negative", () => {
    const prior = { alpha: 10, beta: 5 };
    const lastUpdate = timestamp(now);
    const result = decayPriorTowardBaseline(now, lastUpdate, prior);
    expect(result.alpha).toBe(10);
    expect(result.beta).toBe(5);
  });

  it("decays toward baseline over time", () => {
    const prior = { alpha: 10, beta: 2 };
    const lastUpdate = timestamp(now - 30 * DAY_MS);
    const result = decayPriorTowardBaseline(now, lastUpdate, prior);

    // Should move toward DEFAULT_BETA_PRIOR (alpha: 2, beta: 5)
    expect(result.alpha).toBeLessThan(prior.alpha);
    expect(result.alpha).toBeGreaterThan(DEFAULT_BETA_PRIOR.alpha);
    expect(result.beta).toBeGreaterThan(prior.beta);
    expect(result.beta).toBeLessThan(DEFAULT_BETA_PRIOR.beta);
  });

  it("converges to baseline after very long time", () => {
    const prior = { alpha: 100, beta: 1 };
    const lastUpdate = timestamp(now - 365 * DAY_MS);
    const result = decayPriorTowardBaseline(now, lastUpdate, prior);

    // After a year, should be very close to baseline
    expect(result.alpha).toBeCloseTo(DEFAULT_BETA_PRIOR.alpha, 0);
    expect(result.beta).toBeCloseTo(DEFAULT_BETA_PRIOR.beta, 0);
  });
});

describe("bayesianUpdate", () => {
  const now = 1_700_000_000_000;
  const prior = { alpha: 2, beta: 5 };

  it("increments alpha on success", () => {
    const result = bayesianUpdate(now, prior, {
      _: "success",
      task: "test",
      duration: 10,
      reliability: 1,
    });
    expect(result.posterior.alpha).toBe(prior.alpha + 1);
    expect(result.posterior.beta).toBe(prior.beta);
  });

  it("increments beta on failure", () => {
    const result = bayesianUpdate(now, prior, {
      _: "failure",
      task: "test",
      error: "boom",
      reliability: 1,
    });
    expect(result.posterior.alpha).toBe(prior.alpha);
    expect(result.posterior.beta).toBe(prior.beta + 1);
  });

  it("handles positive feedback", () => {
    const result = bayesianUpdate(now, prior, {
      _: "feedback",
      positive: true,
      strength: 0.5,
      reliability: 1,
    });
    expect(result.posterior.alpha).toBe(prior.alpha + 0.5);
    expect(result.posterior.beta).toBe(prior.beta);
  });

  it("handles negative feedback", () => {
    const result = bayesianUpdate(now, prior, {
      _: "feedback",
      positive: false,
      strength: 0.8,
      reliability: 1,
    });
    expect(result.posterior.alpha).toBe(prior.alpha);
    expect(result.posterior.beta).toBe(prior.beta + 0.8);
  });

  it("applies override weight (1.5x) to beta", () => {
    const result = bayesianUpdate(now, prior, {
      _: "override",
      reason: "manual",
      reliability: 1,
    });
    expect(result.posterior.alpha).toBe(prior.alpha);
    expect(result.posterior.beta).toBe(prior.beta + 1.5);
  });

  it("scales update by reliability", () => {
    const full = bayesianUpdate(now, prior, {
      _: "success",
      task: "test",
      duration: 10,
      reliability: 1,
    });
    const half = bayesianUpdate(now, prior, {
      _: "success",
      task: "test",
      duration: 10,
      reliability: 0.5,
    });
    expect(half.posterior.alpha - prior.alpha).toBeCloseTo(
      (full.posterior.alpha - prior.alpha) * 0.5,
      8
    );
  });

  it("returns level and confidence derived from posterior", () => {
    const result = bayesianUpdate(now, prior, {
      _: "success",
      task: "test",
      duration: 10,
    });
    expect(result.level).toBeGreaterThanOrEqual(0);
    expect(result.level).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("does not update when reliability is 0", () => {
    const result = bayesianUpdate(now, prior, {
      _: "success",
      task: "test",
      duration: 10,
      reliability: 0,
    });
    expect(result.posterior.alpha).toBe(prior.alpha);
    expect(result.posterior.beta).toBe(prior.beta);
  });
});
