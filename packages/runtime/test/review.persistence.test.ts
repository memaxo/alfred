import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { OrchestratorContext } from "../src/orchestrator/types";
import {
  cleanupPlanDir,
  mockRunner,
  preparePlanDir,
} from "./utils/review-helpers";

// Create mock functions BEFORE any imports that use them
let mockWorkflowRun: {
  id: string;
  stateData: Record<string, unknown> | null;
} | null = null;
let updateRunCalls: Array<{
  runId: string;
  patch: { stateData?: unknown };
}> = [];

const codexExecuteMock = mock(async (_input: unknown, _writer?: unknown) => {
  // Mock implementation - actual tracking happens via mock.calls
});

const smokeVerifyMock = mock(async () => ({ success: true, message: "ok" }));

const mockGetRun = mock(async (_runId: string) => mockWorkflowRun);
const mockUpdateRun = mock(async (runId: string, patch: { stateData?: unknown }) => {
  updateRunCalls.push({ runId, patch });
  if (mockWorkflowRun && patch.stateData) {
    mockWorkflowRun.stateData = patch.stateData as Record<string, unknown>;
  }
  return mockWorkflowRun;
});

// Mock modules BEFORE importing them
mock.module("@alfred/agent/orchestrator/tool/codex/index", () => ({
  toolCodex: {
    execute: codexExecuteMock,
    name: "codex",
    description: "Mock codex tool",
    inputSchema: {},
    outputSchema: {},
  },
}));

mock.module("@alfred/agent/orchestrator/verification/smoke", () => ({
  smokeTester: {
    verify: smokeVerifyMock,
  },
}));

// Now import - these will get the mocked versions
const { runReviewPhase, reviewWorkflowRepo } = await import(
  "../src/orchestrator/review"
);

/**
 * ALF-13: Persist fix attempt count (Security)
 *
 * Tests that fixAttempts is correctly persisted to workflow stateData
 * and restored on resume, preventing unlimited fix attempts via
 * suspend/resume cycles.
 */
describe("review fixAttempts persistence", () => {
  let restoreRunner: (() => void) | undefined;
  let originalGetRun: typeof reviewWorkflowRepo.getRun;
  let originalUpdateRun: typeof reviewWorkflowRepo.updateRun;

  beforeEach(() => {
    process.env.ORCH_TMUX_DISABLED = "1";
    originalGetRun = reviewWorkflowRepo.getRun;
    originalUpdateRun = reviewWorkflowRepo.updateRun;

    // Reset mock state
    mockWorkflowRun = null;
    updateRunCalls = [];
    codexExecuteMock.mockReset();
    smokeVerifyMock.mockReset();
    mockGetRun.mockReset();
    mockUpdateRun.mockReset();

    // Set up default implementations
    smokeVerifyMock.mockImplementation(async () => ({ success: true, message: "ok" }));
    mockGetRun.mockImplementation(async (_runId: string) => mockWorkflowRun);
    mockUpdateRun.mockImplementation(async (runId: string, patch: { stateData?: unknown }) => {
      updateRunCalls.push({ runId, patch });
      if (mockWorkflowRun && patch.stateData) {
        mockWorkflowRun.stateData = patch.stateData as Record<string, unknown>;
      }
      return mockWorkflowRun;
    });

    reviewWorkflowRepo.getRun = mockGetRun;
    reviewWorkflowRepo.updateRun = mockUpdateRun;
  });

  afterEach(async () => {
    process.env.ORCH_TMUX_DISABLED = undefined;
    restoreRunner?.();
    restoreRunner = undefined;
    reviewWorkflowRepo.getRun = originalGetRun;
    reviewWorkflowRepo.updateRun = originalUpdateRun;
  });

  afterAll(() => {
    mock.restore();
  });

  it("loads persisted fixAttempts from stateData on resume", async () => {
    const runId = `review-persist-${Date.now().toString(36)}`;
    await preparePlanDir(runId);

    // Simulate a resumed workflow with 2 prior fix attempts
    mockWorkflowRun = {
      id: runId,
      stateData: { fixAttempts: 2 },
    };

    restoreRunner = mockRunner(async () => ({
      stdout: "fail",
      stderr: "error",
      exitCode: 1,
      durationMs: 1,
    }));

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
    expect(codexExecuteMock.mock.calls.length).toBe(1);

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

    restoreRunner = mockRunner(async () => ({
      stdout: "fail",
      stderr: "error",
      exitCode: 1,
      durationMs: 1,
    }));

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
    expect(codexExecuteMock.mock.calls.length).toBe(3);

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

    restoreRunner = mockRunner(async () => ({
      stdout: "fail",
      stderr: "error",
      exitCode: 1,
      durationMs: 1,
    }));

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
    expect(codexExecuteMock.mock.calls.length).toBe(0);

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

    let checkRunCount = 0;
    restoreRunner = mockRunner(async () => {
      checkRunCount++;
      // Pass on second run to verify we get initial attempt + 1 retry
      if (checkRunCount > 4) {
        return { stdout: "ok", stderr: "", exitCode: 0, durationMs: 1 };
      }
      return { stdout: "fail", stderr: "error", exitCode: 1, durationMs: 1 };
    });

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
    expect(codexExecuteMock.mock.calls.length).toBeGreaterThan(0);

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
    mockGetRun.mockImplementation(async () => {
      throw new Error("Database connection failed");
    });
    mockUpdateRun.mockImplementation(async () => {
      throw new Error("Database connection failed");
    });
    reviewWorkflowRepo.getRun = mockGetRun;
    reviewWorkflowRepo.updateRun = mockUpdateRun;

    restoreRunner = mockRunner(async () => ({
      stdout: "fail",
      stderr: "error",
      exitCode: 1,
      durationMs: 1,
    }));

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
    expect(codexExecuteMock.mock.calls.length).toBe(3); // MAX_FIX_ATTEMPTS
  });
});
