import { afterAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";

const workflowRepoMocks = {
  appendEvent: vi.fn(),
  createRun: vi.fn(),
  getRun: vi.fn(),
  listEvents: vi.fn(),
  updateRun: vi.fn(),
};

mock.module("@alfred/db/repo/workflow", () => workflowRepoMocks);

afterAll(() => {
  mock.restore();
});

import { installLoggerMock } from "@alfred/test-kit/logger";

installLoggerMock();

const { ReviewGateManager } =
  await import("../../src/workflow/review-gate-manager");

describe("ReviewGateManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflowRepoMocks.getRun.mockResolvedValue(null);
    workflowRepoMocks.updateRun.mockResolvedValue();
  });

  describe("restoreFromRun", () => {
    it("does nothing when run has no stateData", async () => {
      workflowRepoMocks.getRun.mockResolvedValue({
        id: "run-1",
        stateData: null,
      });

      const manager = new ReviewGateManager();
      await manager.restoreFromRun("run-1");

      expect(workflowRepoMocks.getRun).toHaveBeenCalledWith("run-1");
      expect(manager.isSatisfied()).toBe(true);
    });

    it("restores reviewGate state from stateData", async () => {
      workflowRepoMocks.getRun.mockResolvedValue({
        id: "run-1",
        stateData: {
          reviewGate: {
            checks: [
              { id: "test", type: "test", status: "passed", attempts: 1 },
            ],
            minimumRequired: 1,
            planInitialized: true,
            planRequired: true,
          },
        },
      });

      const manager = new ReviewGateManager();
      await manager.restoreFromRun("run-1");

      const summary = manager.summary();
      expect(summary).toHaveLength(1);
      expect(summary[0].id).toBe("test");
      expect(summary[0].status).toBe("passed");
    });

    it("restores reviewEscalation from stateData", async () => {
      workflowRepoMocks.getRun.mockResolvedValue({
        id: "run-1",
        stateData: {
          reviewEscalation: {
            reason: "fixer_exhausted",
            attempts: 3,
          },
          reviewGate: {
            checks: [],
            planInitialized: false,
            planRequired: false,
            minimumRequired: 0,
          },
        },
      });

      const manager = new ReviewGateManager();
      await manager.restoreFromRun("run-1");

      const serialized = manager.serialize();
      expect(serialized.reviewEscalation).toEqual({
        attempts: 3,
        reason: "fixer_exhausted",
      });
    });

    it("handles getRun errors gracefully", async () => {
      workflowRepoMocks.getRun.mockRejectedValue(new Error("db_error"));

      const manager = new ReviewGateManager();
      await manager.restoreFromRun("run-1");

      // Should not throw, manager should be in default state
      expect(manager.isSatisfied()).toBe(true);
    });

    it("handles malformed stateData gracefully", async () => {
      workflowRepoMocks.getRun.mockResolvedValue({
        id: "run-1",
        stateData: "not an object",
      });

      const manager = new ReviewGateManager();
      await manager.restoreFromRun("run-1");

      expect(manager.isSatisfied()).toBe(true);
    });
  });

  describe("requireAtLeast", () => {
    it("delegates to underlying gate", () => {
      const manager = new ReviewGateManager();
      manager.requireAtLeast(2);

      // With minimum required but no checks, should not be satisfied
      expect(manager.isSatisfied()).toBe(false);
    });
  });

  describe("applyPlan", () => {
    it("applies plan from unknown data", () => {
      const manager = new ReviewGateManager();
      manager.applyPlan({
        checks: [
          { id: "lint", type: "lint" },
          { id: "test", type: "test" },
        ],
      });

      const summary = manager.summary();
      expect(summary).toHaveLength(2);
      expect(summary.map((c) => c.id)).toContain("lint");
      expect(summary.map((c) => c.id)).toContain("test");
    });

    it("handles null/undefined data", () => {
      const manager = new ReviewGateManager();
      manager.applyPlan(null);
      manager.applyPlan();

      expect(manager.summary()).toHaveLength(0);
    });
  });

  describe("recordCheck", () => {
    it("records check with string evidence", () => {
      const manager = new ReviewGateManager();
      manager.applyPlan({ checks: [{ id: "test", type: "test" }] });
      manager.recordCheck({
        id: "test",
        output: "All tests passed",
        status: "passed",
        type: "test",
      });

      const summary = manager.summary();
      expect(summary[0].status).toBe("passed");
      expect(summary[0].evidence).toBe("All tests passed");
    });

    it("records check with object evidence (JSON stringified)", () => {
      const manager = new ReviewGateManager();
      manager.applyPlan({ checks: [{ id: "test", type: "test" }] });
      manager.recordCheck({
        error: { code: 1, message: "failed" },
        id: "test",
        status: "failed",
        type: "test",
      });

      const summary = manager.summary();
      expect(summary[0].evidence).toBe('{"code":1,"message":"failed"}');
    });

    it("handles evidence from output, error, or evidence fields", () => {
      const manager = new ReviewGateManager();

      manager.applyPlan({ checks: [{ id: "a", type: "a" }] });
      manager.recordCheck({ id: "a", output: "from output", status: "passed" });
      expect(manager.summary()[0].evidence).toBe("from output");
    });

    it("handles non-stringifiable evidence", () => {
      const manager = new ReviewGateManager();
      manager.applyPlan({ checks: [{ id: "test", type: "test" }] });

      const circular: Record<string, unknown> = {};
      circular.self = circular;

      manager.recordCheck({
        evidence: circular,
        id: "test",
        status: "failed",
        type: "test",
      });

      // Should fall back to String()
      const summary = manager.summary();
      expect(summary[0].evidence).toBe("[object Object]");
    });
  });

  describe("recordEscalation", () => {
    it("returns metricKind on first call", () => {
      const manager = new ReviewGateManager();
      const result = manager.recordEscalation({
        attempts: 3,
        reason: "fixer_exhausted",
      });

      expect(result).toEqual({ metricKind: "review_fixer_exhausted" });
    });

    it("returns null on subsequent calls (idempotent)", () => {
      const manager = new ReviewGateManager();
      manager.recordEscalation({ reason: "fixer_exhausted" });
      const result = manager.recordEscalation({ reason: "another_reason" });

      expect(result).toBeNull();
    });

    it("stores all escalation fields", () => {
      const manager = new ReviewGateManager();
      manager.recordEscalation({
        attempts: 3,
        failures: [{ command: "bun test", error: "fail" }],
        fixerAttempts: 2,
        plan: ".agent/plans/run/debug.md",
        reason: "fixer_exhausted",
        relevantFiles: ["src/foo.ts"],
        summary: "Tests failed",
      });

      const serialized = manager.serialize();
      expect(serialized.reviewEscalation).toMatchObject({
        attempts: 3,
        fixerAttempts: 2,
        plan: ".agent/plans/run/debug.md",
        reason: "fixer_exhausted",
        relevantFiles: ["src/foo.ts"],
        summary: "Tests failed",
      });
    });

    it("formats metric kind from reason", () => {
      const manager = new ReviewGateManager();

      const result1 = manager.recordEscalation({
        reason: "Max Retries Exceeded!",
      });
      expect(result1?.metricKind).toBe("review_max_retries_exceeded");
    });

    it("returns default metric kind when reason is empty", () => {
      const manager = new ReviewGateManager();
      const result = manager.recordEscalation({});

      expect(result?.metricKind).toBe("review_escalated");
    });
  });

  describe("getEscalationReason", () => {
    it("returns undefined before escalation is recorded", () => {
      const manager = new ReviewGateManager();
      expect(manager.getEscalationReason()).toBeUndefined();
    });

    it("returns reason after escalation is recorded", () => {
      const manager = new ReviewGateManager();
      manager.recordEscalation({ reason: "timeout" });

      expect(manager.getEscalationReason()).toBe("timeout");
    });
  });

  describe("isSatisfied", () => {
    it("returns true when no plan is required", () => {
      const manager = new ReviewGateManager();
      expect(manager.isSatisfied()).toBe(true);
    });

    it("returns false when plan has failing checks", () => {
      const manager = new ReviewGateManager();
      manager.applyPlan({ checks: [{ id: "test", type: "test" }] });
      manager.recordCheck({ id: "test", status: "failed" });

      expect(manager.isSatisfied()).toBe(false);
    });

    it("returns true when all checks pass", () => {
      const manager = new ReviewGateManager();
      manager.applyPlan({ checks: [{ id: "test", type: "test" }] });
      manager.recordCheck({ id: "test", status: "passed" });

      expect(manager.isSatisfied()).toBe(true);
    });
  });

  describe("serialize", () => {
    it("returns complete state", () => {
      const manager = new ReviewGateManager();
      manager.applyPlan({ checks: [{ id: "test", type: "test" }] });
      manager.recordCheck({ attempt: 1, id: "test", status: "passed" });
      manager.recordEscalation({ reason: "test_reason" });

      const serialized = manager.serialize();

      expect(serialized.reviewGate).toBeDefined();
      expect(serialized.reviewGate.checks).toHaveLength(1);
      expect(serialized.reviewEscalation?.reason).toBe("test_reason");
    });
  });

  describe("persistState", () => {
    it("merges with existing stateData", async () => {
      workflowRepoMocks.getRun.mockResolvedValue({
        id: "run-1",
        stateData: { existingKey: "existingValue" },
      });

      const manager = new ReviewGateManager();
      manager.applyPlan({ checks: [{ id: "test", type: "test" }] });

      await manager.persistState("run-1");

      expect(workflowRepoMocks.updateRun).toHaveBeenCalledWith(
        "run-1",
        expect.objectContaining({
          stateData: expect.objectContaining({
            existingKey: "existingValue",
            reviewGate: expect.any(Object),
          }),
        })
      );
    });

    it("creates stateData when none exists", async () => {
      workflowRepoMocks.getRun.mockResolvedValue({
        id: "run-1",
        stateData: null,
      });

      const manager = new ReviewGateManager();
      await manager.persistState("run-1");

      expect(workflowRepoMocks.updateRun).toHaveBeenCalledWith(
        "run-1",
        expect.objectContaining({
          stateData: expect.objectContaining({
            reviewGate: expect.any(Object),
          }),
        })
      );
    });

    it("handles persistence errors gracefully", async () => {
      workflowRepoMocks.getRun.mockRejectedValue(new Error("db_error"));

      const manager = new ReviewGateManager();
      await manager.persistState("run-1");

      // Should not throw
      expect(workflowRepoMocks.updateRun).not.toHaveBeenCalled();
    });
  });
});
