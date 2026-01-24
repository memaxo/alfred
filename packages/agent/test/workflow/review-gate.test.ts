import { describe, expect, it } from "bun:test";

import { ReviewGate } from "../../src/workflow/review-gate";

describe("ReviewGate", () => {
  describe("serialize/restore", () => {
    it("serializes empty state correctly", () => {
      const gate = new ReviewGate();
      const serialized = gate.serialize();

      expect(serialized).toEqual({
        checks: [],
        planInitialized: false,
        planRequired: false,
        minimumRequired: 0,
      });
    });

    it("restores empty state correctly", () => {
      const gate = new ReviewGate();
      gate.restore({
        checks: [],
        planInitialized: false,
        planRequired: false,
        minimumRequired: 0,
      });

      expect(gate.serialize()).toEqual({
        checks: [],
        planInitialized: false,
        planRequired: false,
        minimumRequired: 0,
      });
    });

    it("serializes state with checks", () => {
      const gate = new ReviewGate();
      gate.applyPlan({
        checks: [
          { id: "tests", type: "test" },
          { id: "lint", type: "lint" },
        ],
      });
      gate.recordCheck({
        id: "tests",
        type: "test",
        status: "passed",
        attempt: 1,
      });

      const serialized = gate.serialize();

      expect(serialized.planInitialized).toBe(true);
      expect(serialized.planRequired).toBe(true);
      expect(serialized.checks).toHaveLength(2);

      const testsCheck = serialized.checks.find((c) => c.id === "tests");
      expect(testsCheck).toMatchObject({
        id: "tests",
        type: "test",
        status: "passed",
        attempts: 1,
      });

      const lintCheck = serialized.checks.find((c) => c.id === "lint");
      expect(lintCheck).toMatchObject({
        id: "lint",
        type: "lint",
        status: "pending",
        attempts: 0,
      });
    });

    it("restores state with checks correctly", () => {
      const original = new ReviewGate();
      original.applyPlan({
        checks: [
          { id: "tests", type: "test" },
          { id: "lint", type: "lint" },
        ],
      });
      original.recordCheck({
        id: "tests",
        type: "test",
        status: "passed",
        attempt: 2,
        evidence: "All tests passed",
      });

      const serialized = original.serialize();

      const restored = new ReviewGate();
      restored.restore(serialized);

      expect(restored.serialize()).toEqual(serialized);
    });

    it("preserves minimumRequired through serialize/restore", () => {
      const original = new ReviewGate();
      original.requireAtLeast(3);

      const serialized = original.serialize();
      expect(serialized.minimumRequired).toBe(3);

      const restored = new ReviewGate();
      restored.restore(serialized);

      expect(restored.serialize().minimumRequired).toBe(3);
    });

    it("preserves isSatisfied state through serialize/restore", () => {
      const original = new ReviewGate();
      original.applyPlan({ checks: [{ id: "tests", type: "test" }] });
      original.recordCheck({ id: "tests", type: "test", status: "passed" });

      expect(original.isSatisfied()).toBe(true);

      const serialized = original.serialize();
      const restored = new ReviewGate();
      restored.restore(serialized);

      expect(restored.isSatisfied()).toBe(true);
    });

    it("preserves unsatisfied state through serialize/restore", () => {
      const original = new ReviewGate();
      original.applyPlan({ checks: [{ id: "tests", type: "test" }] });
      original.recordCheck({ id: "tests", type: "test", status: "failed" });

      expect(original.isSatisfied()).toBe(false);

      const serialized = original.serialize();
      const restored = new ReviewGate();
      restored.restore(serialized);

      expect(restored.isSatisfied()).toBe(false);
    });

    it("clears existing checks when restoring", () => {
      const gate = new ReviewGate();
      gate.applyPlan({ checks: [{ id: "old", type: "check" }] });

      gate.restore({
        checks: [{ id: "new", type: "check", status: "passed", attempts: 0 }],
        planInitialized: true,
        planRequired: true,
        minimumRequired: 0,
      });

      const summary = gate.summary();
      expect(summary).toHaveLength(1);
      expect(summary[0].id).toBe("new");
    });

    it("handles partial restore data gracefully", () => {
      const gate = new ReviewGate();
      gate.restore({});

      expect(gate.serialize()).toEqual({
        checks: [],
        planInitialized: false,
        planRequired: false,
        minimumRequired: 0,
      });
    });

    it("can continue recording checks after restore", () => {
      const original = new ReviewGate();
      original.applyPlan({
        checks: [
          { id: "tests", type: "test" },
          { id: "lint", type: "lint" },
        ],
      });
      original.recordCheck({ id: "tests", type: "test", status: "passed" });

      const serialized = original.serialize();
      const restored = new ReviewGate();
      restored.restore(serialized);

      // Continue recording on the restored gate
      restored.recordCheck({ id: "lint", type: "lint", status: "passed" });

      expect(restored.isSatisfied()).toBe(true);
      const summary = restored.summary();
      const lintCheck = summary.find((c) => c.id === "lint");
      expect(lintCheck?.status).toBe("passed");
    });

    it("preserves evidence through serialize/restore", () => {
      const original = new ReviewGate();
      original.applyPlan({ checks: [{ id: "tests", type: "test" }] });
      original.recordCheck({
        id: "tests",
        type: "test",
        status: "failed",
        attempt: 1,
        evidence: "Error: Test failed at line 42",
      });

      const serialized = original.serialize();
      const restored = new ReviewGate();
      restored.restore(serialized);

      const summary = restored.summary();
      expect(summary[0].evidence).toBe("Error: Test failed at line 42");
    });
  });

  describe("requireAtLeast interaction with restore", () => {
    it("restored gate respects minimumRequired for isSatisfied", () => {
      const original = new ReviewGate();
      original.requireAtLeast(2);
      original.applyPlan({
        checks: [
          { id: "tests", type: "test" },
          { id: "lint", type: "lint" },
        ],
      });
      original.recordCheck({ id: "tests", type: "test", status: "passed" });
      // Only 1 passed, need 2

      expect(original.isSatisfied()).toBe(false);

      const serialized = original.serialize();
      const restored = new ReviewGate();
      restored.restore(serialized);

      expect(restored.isSatisfied()).toBe(false);

      // Now pass the second check
      restored.recordCheck({ id: "lint", type: "lint", status: "passed" });
      expect(restored.isSatisfied()).toBe(true);
    });
  });
});
