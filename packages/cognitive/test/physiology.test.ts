import { describe, expect, it } from "bun:test";
import {
  updatePhysiology,
  updateAutonomy,
  initialAutonomy,
  type Physiology,
} from "../src/state";

describe("Cognitive Physiology", () => {
  it("updates physiology correctly", () => {
    let phy: Physiology = { energy: 1.0, boredom: 0.0, frustration: 0.0 };

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
    const auto = initialAutonomy(); // level 0.3
    
    // Normal update
    const next = updateAutonomy(auto, { _: "success", task: "test", duration: 100 });
    // Success increases level slightly
    expect(next.level).toBeGreaterThan(0.3);

    // High Frustration Scenario
    const frustratedPhy: Physiology = { energy: 0.5, boredom: 0, frustration: 0.8 };
    const constrained = updateAutonomy(
      auto,
      { _: "failure", task: "test", error: "oops" },
      frustratedPhy
    );
    
    // Should be significantly lower due to frustration penalty (0.5x multiplier)
    expect(constrained.level).toBeLessThan(0.2); 
  });
});
