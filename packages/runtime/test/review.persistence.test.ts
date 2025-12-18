import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { smokeTester } from "@alfred/agent/orchestrator/verification/smoke";
import { runReviewPhase } from "../src/orchestrator/review";
import type { OrchestratorContext } from "../src/orchestrator/types";
import {
  cleanupPlanDir,
  mockRunner,
  preparePlanDir,
} from "./utils/review-helpers";

/**
 * ALF-13: Persist fix attempt count (Security)
 *
 * Tests that fixAttempts is correctly persisted to workflow stateData
 * and restored on resume, preventing unlimited fix attempts via
 * suspend/resume cycles.
 */
describe("review fixAttempts persistence", () => {
  let restoreRunner: (() => void) | undefined;
  let originalCodex: typeof toolCodex.execute;
  let originalSmoke: typeof smokeTester.verify;

  // Mock state for workflowRepo
  let mockWorkflowRun: {
    id: string;
    stateData: Record<string, unknown> | null;
  } | null = null;
  let updateRunCalls: Array<{
    runId: string;
    patch: { stateData?: unknown };
  }> = [];

  // Mock workflowRepo
  const mockWorkflowRepo = {
    getRun: mock(async (runId: string) => mockWorkflowRun),
    updateRun: mock(async (runId: string, patch: { stateData?: unknown }) => {
      updateRunCalls.push({ runId, patch });
      if (mockWorkflowRun && patch.stateData) {
        mockWorkflowRun.stateData = patch.stateData as Record<string, unknown>;
      }
      return mockWorkflowRun;
    }),
  };

  beforeEach(() => {
    process.env.ORCH_TMUX_DISABLED = "1";
    originalCodex = toolCodex.execute;
    originalSmoke = smokeTester.verify;

    // Reset mock state
    mockWorkflowRun = null;
    updateRunCalls = [];
    mockWorkflowRepo.getRun.mockClear();
    mockWorkflowRepo.updateRun.mockClear();

    // Mock the @alfred/db/repo/workflow module
    mock.module("@alfred/db/repo/workflow", () => ({
      workflowRepo: mockWorkflowRepo,
    }));
  });

  afterEach(async () => {
    delete process.env.ORCH_TMUX_DISABLED;
    restoreRunner?.();
    restoreRunner = undefined;
    toolCodex.execute = originalCodex;
    smokeTester.verify = originalSmoke;
  });

  it("loads persisted fixAttempts from stateData on resume", async () => {
    const runId = `review-persist-${Date.now().toString(36)}`;
    await preparePlanDir(runId);

    // Simulate a resumed workflow with 2 prior fix attempts
    mockWorkflowRun = {
      id: runId,
      stateData: { fixAttempts: 2 },
    };

    const fixerCalls: number[] = [];
    restoreRunner = mockRunner(async () => ({
      stdout: "fail",
      stderr: "error",
      exitCode: 1,
      durationMs: 1,
    }));

    // Track fixer agent invocations
    toolCodex.execute = async () => {
      fixerCalls.push(Date.now());
    };
    smokeTester.verify = async () => ({ success: true, message: "ok" });

    const ctx: OrchestratorContext = {
      input: {
        requirement: "Test fixAttempts persistence",
        auto: "medium", // Required for self-correction
      },
      runId,
      signal: new AbortController().signal,
      workspace: process.cwd(),
      projectConfig: null,
    } as OrchestratorContext;

    const mergePlan = {
      summary: "test changes",
      expectedFiles: ["apps/web/src/test.tsx"],
      changedPackages: ["apps/web"],
      targetBranch: "dev",
      branches: [],
    };

    const events: Array<{
      type?: string;
      kind?: string;
      message?: string;
      data?: unknown;
    }> = [];
    try {
      const generator = runReviewPhase(ctx, mergePlan);
      for await (const event of generator) {
        events.push(event as (typeof events)[number]);
      }
    } finally {
      await cleanupPlanDir(runId);
    }

    // With fixAttempts=2, only 1 more fix attempt should be allowed (MAX_FIX_ATTEMPTS=3)
    // The fixer runs when fixAttempts < MAX_FIX_ATTEMPTS, so at fixAttempts=2, it runs once
    expect(fixerCalls.length).toBe(1);

    // Verify escalation event was emitted after exhausting retries
    const escalationEvent = events.find((e) => e?.kind === "review-escalated");
    expect(escalationEvent).toBeDefined();
    expect((escalationEvent?.data as { reason?: string })?.reason).toBe(
      "fixer_exhausted"
    );
  });

  it("persists fixAttempts to stateData after each fix attempt", async () => {
    const runId = `review-persist-write-${Date.now().toString(36)}`;
    await preparePlanDir(runId);

    // Start fresh (no prior attempts)
    mockWorkflowRun = {
      id: runId,
      stateData: null,
    };

    let fixerCallCount = 0;
    restoreRunner = mockRunner(async () => ({
      stdout: "fail",
      stderr: "error",
      exitCode: 1,
      durationMs: 1,
    }));

    // Fixer always "fails to fix" so we get multiple attempts
    toolCodex.execute = async () => {
      fixerCallCount++;
    };
    smokeTester.verify = async () => ({ success: true, message: "ok" });

    const ctx: OrchestratorContext = {
      input: {
        requirement: "Test fixAttempts persistence",
        auto: "medium",
      },
      runId,
      signal: new AbortController().signal,
      workspace: process.cwd(),
      projectConfig: null,
    } as OrchestratorContext;

    const mergePlan = {
      summary: "test changes",
      expectedFiles: ["apps/web/src/test.tsx"],
      changedPackages: ["apps/web"],
      targetBranch: "dev",
      branches: [],
    };

    try {
      const generator = runReviewPhase(ctx, mergePlan);
      for await (const _ of generator) {
        // Consume all events
      }
    } finally {
      await cleanupPlanDir(runId);
    }

    // With MAX_FIX_ATTEMPTS=3, we should have 3 fixer calls
    expect(fixerCallCount).toBe(3);

    // Verify updateRun was called with incrementing fixAttempts
    const stateDataUpdates = updateRunCalls
      .filter((call) => call.patch.stateData)
      .map(
        (call) => (call.patch.stateData as Record<string, unknown>)?.fixAttempts
      );

    expect(stateDataUpdates).toEqual([1, 2, 3]);
  });

  it("respects MAX_FIX_ATTEMPTS across suspend/resume cycles", async () => {
    const runId = `review-max-attempts-${Date.now().toString(36)}`;
    await preparePlanDir(runId);

    // Simulate workflow already at max attempts
    mockWorkflowRun = {
      id: runId,
      stateData: { fixAttempts: 3 },
    };

    const fixerCalls: number[] = [];
    restoreRunner = mockRunner(async () => ({
      stdout: "fail",
      stderr: "error",
      exitCode: 1,
      durationMs: 1,
    }));

    toolCodex.execute = async () => {
      fixerCalls.push(Date.now());
    };
    smokeTester.verify = async () => ({ success: true, message: "ok" });

    const ctx: OrchestratorContext = {
      input: {
        requirement: "Test max attempts enforcement",
        auto: "medium",
      },
      runId,
      signal: new AbortController().signal,
      workspace: process.cwd(),
      projectConfig: null,
    } as OrchestratorContext;

    const mergePlan = {
      summary: "test changes",
      expectedFiles: ["apps/web/src/test.tsx"],
      changedPackages: ["apps/web"],
      targetBranch: "dev",
      branches: [],
    };

    const events: Array<{
      type?: string;
      kind?: string;
      message?: string;
      data?: unknown;
    }> = [];
    try {
      const generator = runReviewPhase(ctx, mergePlan);
      for await (const event of generator) {
        events.push(event as (typeof events)[number]);
      }
    } finally {
      await cleanupPlanDir(runId);
    }

    // At fixAttempts=3, no more fixer attempts should be made
    // (condition is fixAttempts < MAX_FIX_ATTEMPTS)
    expect(fixerCalls.length).toBe(0);

    // Verify escalation was emitted
    const escalationEvent = events.find((e) => e?.kind === "review-escalated");
    expect(escalationEvent).toBeDefined();
  });

  it("handles missing stateData gracefully (defaults to 0)", async () => {
    const runId = `review-no-state-${Date.now().toString(36)}`;
    await preparePlanDir(runId);

    // Workflow exists but has no stateData
    mockWorkflowRun = {
      id: runId,
      stateData: null,
    };

    let fixerCallCount = 0;
    let checkRunCount = 0;
    restoreRunner = mockRunner(async () => {
      checkRunCount++;
      // Pass on second run to verify we get initial attempt + 1 retry
      if (checkRunCount > 4) {
        return { stdout: "ok", stderr: "", exitCode: 0, durationMs: 1 };
      }
      return { stdout: "fail", stderr: "error", exitCode: 1, durationMs: 1 };
    });

    toolCodex.execute = async () => {
      fixerCallCount++;
    };
    smokeTester.verify = async () => ({ success: true, message: "ok" });

    const ctx: OrchestratorContext = {
      input: {
        requirement: "Test default fixAttempts",
        auto: "medium",
      },
      runId,
      signal: new AbortController().signal,
      workspace: process.cwd(),
      projectConfig: null,
    } as OrchestratorContext;

    const mergePlan = {
      summary: "test changes",
      expectedFiles: ["apps/web/src/test.tsx"],
      changedPackages: ["apps/web"],
      targetBranch: "dev",
      branches: [],
    };

    const events: Array<{ type?: string; kind?: string; data?: unknown }> = [];
    try {
      const generator = runReviewPhase(ctx, mergePlan);
      for await (const event of generator) {
        events.push(event as (typeof events)[number]);
      }
    } finally {
      await cleanupPlanDir(runId);
    }

    // Should have run fixer at least once (defaults to fixAttempts=0)
    expect(fixerCallCount).toBeGreaterThan(0);

    // Verify the review eventually passed
    const resultEvent = events.find((e) => e?.kind === "review-exec-result");
    expect(resultEvent).toBeDefined();
    expect((resultEvent?.data as { status?: string })?.status).toBe(
      "completed"
    );
  });

  it("handles workflowRepo errors gracefully", async () => {
    const runId = `review-repo-error-${Date.now().toString(36)}`;
    await preparePlanDir(runId);

    // Simulate repo error
    mockWorkflowRepo.getRun.mockImplementation(async () => {
      throw new Error("Database connection failed");
    });

    let fixerCallCount = 0;
    restoreRunner = mockRunner(async () => ({
      stdout: "fail",
      stderr: "error",
      exitCode: 1,
      durationMs: 1,
    }));

    toolCodex.execute = async () => {
      fixerCallCount++;
    };
    smokeTester.verify = async () => ({ success: true, message: "ok" });

    const ctx: OrchestratorContext = {
      input: {
        requirement: "Test repo error handling",
        auto: "medium",
      },
      runId,
      signal: new AbortController().signal,
      workspace: process.cwd(),
      projectConfig: null,
    } as OrchestratorContext;

    const mergePlan = {
      summary: "test changes",
      expectedFiles: ["apps/web/src/test.tsx"],
      changedPackages: ["apps/web"],
      targetBranch: "dev",
      branches: [],
    };

    try {
      const generator = runReviewPhase(ctx, mergePlan);
      for await (const _ of generator) {
        // Consume all events
      }
    } finally {
      await cleanupPlanDir(runId);
    }

    // Despite repo error, should still run (defaulting to fixAttempts=0)
    // and attempt fixes
    expect(fixerCallCount).toBe(3); // MAX_FIX_ATTEMPTS
  });
});
