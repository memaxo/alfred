import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createLifecycle } from "../workflow/lifecycle.js";

// Mock dependencies
const mockGetRun = mock(async () => ({}));
const mockUpdateRun = mock(async () => ({}));
const mockGetPlanById = mock(async () => ({}));

mock.module("@alfred/db/repo/workflow", () => ({
  getRun: mockGetRun,
  updateRun: mockUpdateRun,
}));

mock.module("@alfred/db", () => ({
  planRepo: {
    getPlanById: mockGetPlanById,
  },
  workflowRepo: {
    getRun: mockGetRun,
    updateRun: mockUpdateRun,
  },
}));

// Mock @alfred/plan
const mockExtractPatternFromRun = mock(async () => ({}));
const mockExtractAntiPatternFromRun = mock(async () => ({}));
const mockLearnProjectConventions = mock(async () => ({}));

mock.module("@alfred/plan", () => ({
  extractPatternFromRun: mockExtractPatternFromRun,
  extractAntiPatternFromRun: mockExtractAntiPatternFromRun,
  learnProjectConventions: mockLearnProjectConventions,
}));

// SKIP: These tests pass in isolation but fail when run with other tests due to
// Bun's mock.module() not isolating properly between test files. The module mocks
// for @alfred/db, @alfred/plan etc. pollute other tests.
// NOTE: Refactor to use dependency injection instead of mock.module().
// biome-ignore lint/suspicious/noSkippedTests: Known test isolation issue with mock.module()
describe.skip("Workflow Lifecycle Hooks (Learning)", () => {
  const mockArgs = {
    userId: "user-123",
    stopStreamTimer: () => {},
    recordEvent: () => {},
    triggerPreferenceRefresh: () => {},
    emitComplete: () => {},
  };

  beforeEach(() => {
    mockGetRun.mockClear();
    mockUpdateRun.mockClear();
    mockGetPlanById.mockClear();
    mockExtractPatternFromRun.mockClear();
    mockExtractAntiPatternFromRun.mockClear();
    mockLearnProjectConventions.mockClear();
  });

  it("should trigger learning on successful completion", async () => {
    const lifecycle = createLifecycle(mockArgs);

    mockGetRun.mockImplementation(
      async () =>
        ({
          id: "run-123",
          status: "completed",
          userId: "user-123",
          projectId: "proj-123",
          inputData: { planId: "plan-123" },
        }) as any
    );

    mockGetPlanById.mockImplementation(
      async () =>
        ({
          id: "plan-123",
          plan: { intent: "test" },
        }) as any
    );

    await lifecycle.markCompleted("run-123");

    // Wait for async learning block
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockExtractPatternFromRun).toHaveBeenCalled();
    expect(mockLearnProjectConventions).toHaveBeenCalled();
  });

  it("should trigger anti-pattern learning on failure", async () => {
    const lifecycle = createLifecycle(mockArgs);

    mockGetRun.mockImplementation(
      async () =>
        ({
          id: "run-failed",
          status: "failed",
          userId: "user-123",
          inputData: { planId: "plan-123" },
        }) as any
    );

    mockGetPlanById.mockImplementation(
      async () =>
        ({
          id: "plan-123",
          plan: { intent: "test" },
        }) as any
    );

    await lifecycle.markFailed({
      runId: "run-failed",
      error: new Error("Arbiter failed"),
      input: { auto: "low", mode: "sequential" },
      notifyLinearFailure: async () => {},
      emitError: () => {},
    });

    // Wait for async learning block
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockExtractAntiPatternFromRun).toHaveBeenCalled();
  });
});
