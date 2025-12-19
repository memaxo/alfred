import { describe, expect, it } from "bun:test";
import { benchmarkOperation } from "@alfred/test-kit";
import {
  calculateError,
  idle,
  initialAutonomy,
  updateAutonomy,
  updatePhysiology,
} from "../src/state";
import { applyTransition } from "../src/transition";

// budget: state-transition

describe("cognitive performance budgets", () => {
  it("applyTransition stays under 100µs", async () => {
    const now = Date.now();
    const state = idle(now);
    const autonomy = initialAutonomy(now);
    const event = {
      _: "input",
      content: "Plan lunch",
      source: "user",
      ts: now,
    } as const;

    const stats = await benchmarkOperation(
      "state-transition",
      0.1, // 100µs budget
      2000, // 2000 iterations
      async () => {
        applyTransition(state, autonomy, event);
      }
    );

    expect(stats.p99).toBeLessThan(0.1);
  });

  it("updatePhysiology stays under 10µs", async () => {
    let physiology = idle(Date.now()).physiology;
    const stats = await benchmarkOperation(
      "physiology-update",
      0.01, // 10µs budget
      5000, // 5000 iterations
      async () => {
        physiology = updatePhysiology(physiology, "step");
      }
    );

    expect(stats.p99).toBeLessThan(0.01);
  });

  it("updateAutonomy stays under 50µs", async () => {
    let tick = Date.now();
    let gradient = initialAutonomy(tick);
    const evidence = {
      _: "success",
      task: "task",
      duration: 5,
      reliability: 1,
    } as const;

    const stats = await benchmarkOperation(
      "autonomy-update",
      0.05, // 50µs budget
      2000, // 2000 iterations
      async () => {
        gradient = updateAutonomy(tick, gradient, evidence);
        tick += 1;
      }
    );

    expect(stats.p99).toBeLessThan(0.05);
  });

  it("calculateError stays under 100µs", async () => {
    const expected = "expected string value repeated to ensure work";
    const actual =
      "actual string value repeated to ensure work differs meaningfully";

    const stats = await benchmarkOperation(
      "error-calculation",
      0.1, // 100µs budget
      2000, // 2000 iterations
      async () => {
        calculateError(expected, actual);
      }
    );

    expect(stats.p99).toBeLessThan(0.1);
  });
});
