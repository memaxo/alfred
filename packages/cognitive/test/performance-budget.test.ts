import { describe, expect, it } from "bun:test";
import { performance } from "node:perf_hooks";

import { applyTransition } from "../src/transition";
import {
  calculateError,
  idle,
  initialAutonomy,
  updateAutonomy,
  updatePhysiology,
} from "../src/state";

const measureAverageMs = (
  run: () => void,
  iterations: number,
  warmup: number
): number => {
  for (let i = 0; i < warmup; i++) {
    run();
  }
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    run();
  }
  return (performance.now() - start) / iterations;
};

describe("cognitive performance budgets", () => {
  it("applyTransition stays under 100µs", () => {
    const now = Date.now();
    const state = idle(now);
    const autonomy = initialAutonomy(now);
    const event = {
      _: "input",
      content: "Plan lunch",
      source: "user",
      ts: now,
    } as const;

    const avgMs = measureAverageMs(
      () => {
        applyTransition(state, autonomy, event);
      },
      2000,
      200
    );

    expect(avgMs).toBeLessThan(0.1);
  });

  it("updatePhysiology stays under 10µs", () => {
    let physiology = idle(Date.now()).physiology;
    const avgMs = measureAverageMs(
      () => {
        physiology = updatePhysiology(physiology, "step");
      },
      5000,
      500
    );

    expect(avgMs).toBeLessThan(0.01);
  });

  it("updateAutonomy stays under 50µs", () => {
    let tick = Date.now();
    let gradient = initialAutonomy(tick);
    const evidence = {
      _: "success",
      task: "task",
      duration: 5,
      reliability: 1,
    } as const;

    const avgMs = measureAverageMs(
      () => {
        gradient = updateAutonomy(tick, gradient, evidence);
        tick += 1;
      },
      2000,
      200
    );

    expect(avgMs).toBeLessThan(0.05);
  });

  it("calculateError stays under 100µs", () => {
    const expected = "expected string value repeated to ensure work";
    const actual =
      "actual string value repeated to ensure work differs meaningfully";

    const avgMs = measureAverageMs(
      () => {
        calculateError(expected, actual);
      },
      2000,
      200
    );

    expect(avgMs).toBeLessThan(0.1);
  });
});
