import { describe, expect, it } from "bun:test";

import { ANIMATION_CONFIG } from "../config";

describe("ANIMATION_CONFIG", () => {
  it("has positive stiffness values for all animation types", () => {
    expect(ANIMATION_CONFIG.spawn.stiffness).toBeGreaterThan(0);
    expect(ANIMATION_CONFIG.close.stiffness).toBeGreaterThan(0);
    expect(ANIMATION_CONFIG.resize.stiffness).toBeGreaterThan(0);
    expect(ANIMATION_CONFIG.tile.stiffness).toBeGreaterThan(0);
  });

  it("has positive damping values for all animation types", () => {
    expect(ANIMATION_CONFIG.spawn.damping).toBeGreaterThan(0);
    expect(ANIMATION_CONFIG.close.damping).toBeGreaterThan(0);
    expect(ANIMATION_CONFIG.resize.damping).toBeGreaterThan(0);
    expect(ANIMATION_CONFIG.tile.damping).toBeGreaterThan(0);
  });

  it("has reasonable duration values (50-500ms)", () => {
    expect(ANIMATION_CONFIG.duration.spawn).toBeGreaterThanOrEqual(50);
    expect(ANIMATION_CONFIG.duration.spawn).toBeLessThanOrEqual(500);

    expect(ANIMATION_CONFIG.duration.close).toBeGreaterThanOrEqual(50);
    expect(ANIMATION_CONFIG.duration.close).toBeLessThanOrEqual(500);

    expect(ANIMATION_CONFIG.duration.resize).toBeGreaterThanOrEqual(50);
    expect(ANIMATION_CONFIG.duration.resize).toBeLessThanOrEqual(500);

    expect(ANIMATION_CONFIG.duration.tile).toBeGreaterThanOrEqual(50);
    expect(ANIMATION_CONFIG.duration.tile).toBeLessThanOrEqual(500);
  });

  it("close animation is faster than or equal to spawn", () => {
    expect(ANIMATION_CONFIG.duration.close).toBeLessThanOrEqual(
      ANIMATION_CONFIG.duration.spawn
    );
  });
});
