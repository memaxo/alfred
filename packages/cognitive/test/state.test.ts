import { afterEach, describe, expect, it } from "bun:test";
import { initialAutonomy, updateAutonomy } from "../src/state";

const DAY_MS = 24 * 60 * 60 * 1000;
const realNow = Date.now;

afterEach(() => {
  Date.now = realNow;
});

describe("Autonomy Bayesian updates", () => {
  it("weights autonomy adjustments by evidence reliability", () => {
    const base = initialAutonomy();

    const strong = updateAutonomy(base, {
      _: "success",
      task: "task",
      duration: 10,
      reliability: 1,
    });

    const weak = updateAutonomy(base, {
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
    const base = initialAutonomy();

    const explicit = updateAutonomy(base, {
      _: "failure",
      task: "task",
      error: "boom",
      reliability: 1,
    });

    const implicit = updateAutonomy(base, {
      _: "failure",
      task: "task",
      error: "boom",
    });

    expect(implicit.level).toBeCloseTo(explicit.level, 8);
    expect(implicit.confidence).toBeCloseTo(explicit.confidence, 8);
  });

  it("clamps reliability within [0, 1]", () => {
    const base = initialAutonomy();

    const capped = updateAutonomy(base, {
      _: "success",
      task: "task",
      duration: 5,
      reliability: 2,
    });

    const expected = updateAutonomy(base, {
      _: "success",
      task: "task",
      duration: 5,
      reliability: 1,
    });

    expect(capped.level).toBeCloseTo(expected.level, 8);
    expect(capped.confidence).toBeCloseTo(expected.confidence, 8);

    const suppressed = updateAutonomy(base, {
      _: "failure",
      task: "task",
      error: "boom",
      reliability: -1,
    });

    expect(suppressed.level).toBeCloseTo(base.level, 8);
    expect(suppressed.confidence).toBeCloseTo(base.confidence, 8);
  });

  it("decays confidence when the last update is old", () => {
    const start = 1_700_000_000_000;
    Date.now = () => start;
    const base = initialAutonomy();

    const evidence = { _: "success", task: "task", duration: 10 } as const;

    Date.now = () => start + 1_000; // negligible gap
    const immediate = updateAutonomy(base, evidence);

    Date.now = () => start + 7 * DAY_MS; // a week without updates
    const decayed = updateAutonomy(base, evidence);

    expect(decayed.confidence).toBeLessThan(immediate.confidence);
    expect(decayed.level).toBeLessThan(immediate.level);
  });
});
