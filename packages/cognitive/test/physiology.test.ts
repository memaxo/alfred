import { describe, expect, it } from "bun:test";

import {
  initialAutonomy,
  meetsConstraints,
  type Physiology,
  updateAutonomy,
  updatePhysiology,
} from "../src/state";

describe("Cognitive Physiology", () => {
  it("updates physiology correctly", () => {
    let phy: Physiology = { energy: 1, boredom: 0, frustration: 0 };

    // Step consumes energy
    phy = updatePhysiology(phy, "step");
    expect(phy.energy).toBeCloseTo(0.99);

    // Error increases frustration
    phy = updatePhysiology(phy, "error");
    expect(phy.frustration).toBe(0.2);
    expect(phy.energy).toBeCloseTo(0.94);

    // Success reduces frustration
    phy = updatePhysiology(phy, "success");
    expect(phy.frustration).toBe(0.1);
    expect(phy.energy).toBeCloseTo(0.99);

    // High entropy loop
    phy = updatePhysiology(phy, "entropy_high");
    expect(phy.boredom).toBe(0.3);
  });

  it("regulates autonomy based on physiology", () => {
    const now = Date.now();
    const auto = initialAutonomy(now); // level 0.3

    // Normal update
    const next = updateAutonomy(now, auto, {
      _: "success",
      task: "test",
      duration: 100,
    });
    // Success increases level slightly
    expect(next.level).toBeGreaterThan(0.3);

    // High Frustration Scenario
    const frustratedPhy: Physiology = {
      energy: 0.5,
      boredom: 0,
      frustration: 0.8,
    };
    const constrained = updateAutonomy(
      now,
      auto,
      { _: "failure", task: "test", error: "oops" },
      frustratedPhy
    );

    // Should be significantly lower due to frustration penalty (0.5x multiplier)
    expect(constrained.level).toBeLessThan(0.2);
  });

  it("high boredom blocks execution via meetsConstraints", () => {
    const now = Date.now();
    const auto = initialAutonomy(now);

    const highBoredomPhy: Physiology = {
      energy: 0.7,
      boredom: 0.95, // Very high boredom (>0.9 threshold)
      frustration: 0,
    };

    // Boredom > 0.9 blocks execution entirely (checked in meetsConstraints)
    // Note: updateAutonomy doesn't apply boredom multiplier, but meetsConstraints blocks it
    const { allowed, reason } = meetsConstraints(
      auto,
      "test_action",
      highBoredomPhy
    );

    expect(allowed).toBe(false);
    expect(reason).toBe("boredom_loop_detected");
  });

  it("low energy reduces autonomy level", () => {
    const now = Date.now();
    const auto = initialAutonomy(now);

    const lowEnergyPhy: Physiology = {
      energy: 0.15, // Very low energy (< 0.2 threshold)
      boredom: 0,
      frustration: 0,
    };

    // Use neutral/negative evidence to see multiplier effect
    // Positive evidence (success) prevents level from decreasing due to Math.max logic
    const constrained = updateAutonomy(
      now,
      auto,
      { _: "failure", task: "test", error: "test error" },
      lowEnergyPhy
    );

    // Low energy should reduce autonomy (0.8x multiplier)
    // Note: With failure evidence, level decreases AND multiplier applies
    expect(constrained.level).toBeLessThan(auto.level);
  });

  it("physiology multipliers are applied after Bayesian update", () => {
    const now = Date.now();
    const auto = initialAutonomy(now);

    // First update with success (increases autonomy)
    const afterSuccess = updateAutonomy(now, auto, {
      _: "success",
      task: "test",
      duration: 100,
    });

    // Then apply high frustration physiology
    const highFrustrationPhy: Physiology = {
      energy: 0.5,
      boredom: 0,
      frustration: 0.9, // Very high frustration
    };

    const final = updateAutonomy(
      now,
      afterSuccess,
      { _: "failure", task: "test", error: "error" },
      highFrustrationPhy
    );

    // Should be lower than afterSuccess due to frustration penalty
    expect(final.level).toBeLessThan(afterSuccess.level);
  });
});
