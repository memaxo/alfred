import { describe, expect, it } from "bun:test";

import { defaultCriteria } from "../src/plan/types";

describe("defaultCriteria", () => {
  it("returns expected default values", () => {
    const criteria = defaultCriteria();
    expect(criteria.safety).toBe(1);
    expect(criteria.speed).toBe(0.7);
    expect(criteria.accuracy).toBe(0.9);
    expect(criteria.cost).toBe(0.5);
  });

  it("returns a new object each time", () => {
    const a = defaultCriteria();
    const b = defaultCriteria();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("safety is highest priority (1.0)", () => {
    const criteria = defaultCriteria();
    expect(criteria.safety).toBeGreaterThan(criteria.speed);
    expect(criteria.safety).toBeGreaterThan(criteria.accuracy);
    expect(criteria.safety).toBeGreaterThan(criteria.cost);
  });
});
