import { describe, expect, it } from "bun:test";
import {
  initialAutonomy,
  meetsConstraints,
  timestamp,
  updateAutonomy,
  type Physiology,
} from "../src/state";

const DAY_MS = 24 * 60 * 60 * 1000;
const baseNow = 1_700_000_000_000;

describe("Autonomy Bayesian updates", () => {
  it("weights autonomy adjustments by evidence reliability", () => {
    const base = initialAutonomy(baseNow);

    const strong = updateAutonomy(baseNow, base, {
      _: "success",
      task: "task",
      duration: 10,
      reliability: 1,
    });

    const weak = updateAutonomy(baseNow, base, {
      _: "success",
      task: "task",
      duration: 10,
      reliability: 0.2,
    });

    expect(strong.level - base.level).toBeGreaterThan(
      weak.level - base.level
    );
  });

  it("defaults reliability to 1 when omitted", () => {
    const base = initialAutonomy(baseNow);

    const explicit = updateAutonomy(baseNow, base, {
      _: "failure",
      task: "task",
      error: "boom",
      reliability: 1,
    });

    const implicit = updateAutonomy(baseNow, base, {
      _: "failure",
      task: "task",
      error: "boom",
    });

    expect(implicit.level).toBeCloseTo(explicit.level, 8);
    expect(implicit.confidence).toBeCloseTo(explicit.confidence, 8);
  });

  it("clamps reliability within [0, 1]", () => {
    const base = initialAutonomy(baseNow);

    const capped = updateAutonomy(baseNow, base, {
      _: "success",
      task: "task",
      duration: 5,
      reliability: 2,
    });

    const expected = updateAutonomy(baseNow, base, {
      _: "success",
      task: "task",
      duration: 5,
      reliability: 1,
    });

    expect(capped.level).toBeCloseTo(expected.level, 8);
    expect(capped.confidence).toBeCloseTo(expected.confidence, 8);

    const suppressed = updateAutonomy(baseNow, base, {
      _: "failure",
      task: "task",
      error: "boom",
      reliability: -1,
    });

    expect(suppressed.level).toBeCloseTo(base.level, 8);
    expect(suppressed.confidence).toBeCloseTo(base.confidence, 8);
    expect(suppressed.prior.alpha).toBeCloseTo(base.prior.alpha, 8);
    expect(suppressed.prior.beta).toBeCloseTo(base.prior.beta, 8);
  });

  it("decays confidence when the last update is old", () => {
    const start = 1_700_000_000_000;
    const base = initialAutonomy(start);
    const evidence = { _: "success", task: "task", duration: 10 } as const;

    const afterFirst = updateAutonomy(start + 1_000, base, evidence);
    const immediate = updateAutonomy(start + 2_000, afterFirst, evidence);
    const decayed = updateAutonomy(start + 30 * DAY_MS, afterFirst, evidence);

    expect(immediate.confidence - decayed.confidence).toBeGreaterThan(1e-4);
    expect(decayed.confidence).toBeLessThan(immediate.confidence);
    expect(decayed.level).toBeLessThanOrEqual(immediate.level);
  });

  it("monotonically increases level across consecutive successes", () => {
    const reliabilities = [0.2, 0.5, 0.9, 1];

    for (const reliability of reliabilities) {
      let state = initialAutonomy(baseNow);
      let now = baseNow;
      let previous = state.level;

      for (let i = 0; i < 6; i++) {
        now += 10;
        state = updateAutonomy(now, state, {
          _: "success",
          task: `success-${i}`,
          duration: 5,
          reliability,
        });

        expect(state.level).toBeGreaterThanOrEqual(previous);
        previous = state.level;
      }
    }
  });

  it("monotonically decreases level across consecutive failures", () => {
    const reliabilities = [0.2, 0.6, 1];

    for (const reliability of reliabilities) {
      let state = initialAutonomy(baseNow);
      let now = baseNow;
      let previous = state.level;

      for (let i = 0; i < 6; i++) {
        now += 10;
        state = updateAutonomy(now, state, {
          _: "failure",
          task: `failure-${i}`,
          error: "boom",
          reliability,
        });

        expect(state.level).toBeLessThanOrEqual(previous);
        previous = state.level;
      }
    }
  });

  it("ignores evidence with zero reliability", () => {
    const base = initialAutonomy(baseNow);

    const ignoredSuccess = updateAutonomy(baseNow, base, {
      _: "success",
      task: "noop",
      duration: 1,
      reliability: 0,
    });

    expect(ignoredSuccess.level).toBeCloseTo(base.level, 10);
    expect(ignoredSuccess.confidence).toBeCloseTo(base.confidence, 10);
    expect(ignoredSuccess.prior.alpha).toBeCloseTo(base.prior.alpha, 10);
    expect(ignoredSuccess.prior.beta).toBeCloseTo(base.prior.beta, 10);

    const ignoredFailure = updateAutonomy(baseNow, ignoredSuccess, {
      _: "failure",
      task: "noop",
      error: "",
      reliability: 0,
    });

    expect(ignoredFailure.level).toBeCloseTo(ignoredSuccess.level, 10);
    expect(ignoredFailure.confidence).toBeCloseTo(
      ignoredSuccess.confidence,
      10
    );
    expect(ignoredFailure.prior.alpha).toBeCloseTo(
      ignoredSuccess.prior.alpha,
      10
    );
    expect(ignoredFailure.prior.beta).toBeCloseTo(
      ignoredSuccess.prior.beta,
      10
    );
  });

  it("keeps autonomy level within [0, 1] bounds", () => {
    let state = initialAutonomy(baseNow);
    let now = baseNow;

    for (let i = 0; i < 50; i++) {
      now += 5;
      state = updateAutonomy(now, state, {
        _: "success",
        task: `push-high-${i}`,
        duration: 1,
        reliability: 1,
      });

      expect(state.level).toBeGreaterThanOrEqual(0);
      expect(state.level).toBeLessThanOrEqual(1);
    }

    for (let i = 0; i < 50; i++) {
      now += 5;
      state = updateAutonomy(now, state, {
        _: "failure",
        task: `push-low-${i}`,
        error: "boom",
        reliability: 1,
      });

      expect(state.level).toBeGreaterThanOrEqual(0);
      expect(state.level).toBeLessThanOrEqual(1);
    }
  });
});

describe("meetsConstraints physiology gating", () => {
  it("blocks execution when frustration exceeds threshold", () => {
    const auto = initialAutonomy(baseNow);
    const highFrustration: Physiology = {
      energy: 1,
      boredom: 0,
      frustration: 0.9,
    };

    const result = meetsConstraints(auto, "deploy", highFrustration);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("frustration_threshold_exceeded");
  });

  it("blocks execution when energy is depleted", () => {
    const auto = initialAutonomy(baseNow);
    const exhausted: Physiology = {
      energy: 0.05,
      boredom: 0,
      frustration: 0,
    };

    const result = meetsConstraints(auto, "analyze", exhausted);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("energy_depleted");
  });
});

describe("timestamp brand validation", () => {
  it("accepts zero, positive integers, and Date.now output", () => {
    expect(() => timestamp(0)).not.toThrow();
    expect(() => timestamp(1)).not.toThrow();
    expect(() => timestamp(Date.now())).not.toThrow();
  });

  it("rejects negative numbers", () => {
    expect(() => timestamp(-1)).toThrow("Timestamp cannot be negative");
  });

  it("rejects NaN inputs", () => {
    expect(() => timestamp(Number.NaN)).toThrow(
      "Timestamp must be a finite number"
    );
  });

  it("rejects infinite values", () => {
    expect(() => timestamp(Number.POSITIVE_INFINITY)).toThrow(
      "Timestamp must be a finite number"
    );
    expect(() => timestamp(Number.NEGATIVE_INFINITY)).toThrow(
      "Timestamp must be a finite number"
    );
  });
});
