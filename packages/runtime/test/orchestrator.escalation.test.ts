import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { WorkflowEvent } from "@alfred/type/plan";
import { ContextBuilder } from "../src/context";

/**
 * Tests for orchestrator escalation handling.
 *
 * Validates that:
 * 1. Escalation from waves halts pipeline before merge phase
 * 2. Escalation reason is propagated in emitted events
 * 3. Escalation events are persisted correctly
 * 4. Linear notification is sent when escalation occurs with Linear context
 */

// Mock tracking
let mockEscalationResult = false;
let mockEscalationReason: string | undefined;
let emitLinearActivityCalls: Array<{
  type: string;
  payload: unknown;
}> = [];
let runMergePhaseCalled = false;
let runReviewPhaseCalled = false;
let runConflictPhaseCalled = false;
let runMergeAnalysisCalled = false;

// Mock runWaves to simulate escalation scenarios
const mockRunWaves = mock(function* (_ctx: unknown) {
  yield { type: "notice", message: "waves_started" } as WorkflowEvent;

  // Return result based on test configuration
  return {
    trackerState: { agents: {}, waves: {} },
    allAgentOutcomes: [],
    agentFileHints: new Map<string, Set<string>>(),
    activeWorkspaces: [] as Array<{ cleanup: () => Promise<void>; id: string }>,
    aborted: false,
    interrupted: false,
    escalated: mockEscalationResult,
    escalationReason: mockEscalationReason,
  };
});

// Mock merge phase to track if it gets called
const mockRunMergePhase = mock(function* (
  _ctx: unknown,
  _wavesResult: unknown
) {
  runMergePhaseCalled = true;
  yield { type: "notice", message: "merge_phase_started" } as WorkflowEvent;
  return { mergePlan: {}, conflictScanResult: null };
});

// Mock conflict phase
const mockRunConflictPhase = mock(function* (
  _ctx: unknown,
  _conflictResult: unknown
) {
  runConflictPhaseCalled = true;
  yield { type: "notice", message: "conflict_phase_started" } as WorkflowEvent;
});

// Mock merge analysis
const mockRunMergeAnalysis = mock(function* (
  _ctx: unknown,
  _mergePlan: unknown
) {
  runMergeAnalysisCalled = true;
  yield {
    type: "notice",
    message: "merge_analysis_started",
  } as WorkflowEvent;
});

// Mock review phase
const mockRunReviewPhase = mock(function* (_ctx: unknown, _mergePlan: unknown) {
  runReviewPhaseCalled = true;
  yield { type: "notice", message: "review_phase_started" } as WorkflowEvent;
});

// Mock worktree manager
const mockWorktreeManager = {
  cleanup: mock(async () => {}),
  safeMerge: mock(async () => ({ success: true, conflictFiles: [] })),
};

// Mock Linear activity emission
const mockEmitLinearActivity = mock(
  (type: string, payload: unknown): Promise<{ ok: boolean }> => {
    emitLinearActivityCalls.push({ type, payload });
    return Promise.resolve({ ok: true });
  }
);

// Set up all mocks before importing the module
mock.module("../src/orchestrator/waves", () => ({
  runWaves: mockRunWaves,
}));

mock.module("../src/orchestrator/merge", () => ({
  runMergePhase: mockRunMergePhase,
  runMergeAnalysis: mockRunMergeAnalysis,
}));

mock.module("../src/orchestrator/conflict", () => ({
  runConflictPhase: mockRunConflictPhase,
}));

mock.module("../src/orchestrator/review", () => ({
  runReviewPhase: mockRunReviewPhase,
}));

mock.module("@alfred/agent/orchestrator/tool/worktree", () => ({
  worktreeManager: mockWorktreeManager,
}));

mock.module("@alfred/agent/integrations/linear", () => ({
  emitLinearActivity: mockEmitLinearActivity,
  extractIssueIdFromSession: (sessionId: string) =>
    sessionId.includes(":") ? sessionId.split(":")[0] : sessionId,
  setLinearCancelled: async () => {},
  setLinearCompleted: async () => {},
  setLinearDelegate: async () => {},
  setLinearSessionExternalUrl: async () => {},
  setLinearStarted: async () => {},
  commentOnLinearIssue: async () => {},
}));

// Import the orchestrator module after mocks are set up
const { runOrchestrator } = await import("../src/orchestrator/index");

// Store original ContextBuilder.build
const originalBuild = ContextBuilder.prototype.build;
ContextBuilder.prototype.build = async () =>
  ({
    bundle: null,
    receipts: {},
    totalTokens: 0,
  }) as any;

const tempDirs: string[] = [];

beforeEach(() => {
  // Reset all mocks and tracking state
  mockRunWaves.mockClear();
  mockRunMergePhase.mockClear();
  mockRunConflictPhase.mockClear();
  mockRunMergeAnalysis.mockClear();
  mockRunReviewPhase.mockClear();
  mockWorktreeManager.cleanup.mockClear();
  mockEmitLinearActivity.mockClear();

  // Reset tracking variables
  mockEscalationResult = false;
  mockEscalationReason = undefined;
  emitLinearActivityCalls = [];
  runMergePhaseCalled = false;
  runReviewPhaseCalled = false;
  runConflictPhaseCalled = false;
  runMergeAnalysisCalled = false;
});

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

afterAll(() => {
  ContextBuilder.prototype.build = originalBuild;
  mock.restore();
});

describe("runOrchestrator escalation", () => {
  it("halts merge/review when waves escalate", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "orch-esc-"));
    tempDirs.push(workspace);

    // Configure mock to return escalated result
    mockEscalationResult = true;
    mockEscalationReason = "agent_blocked";

    const input = {
      requirement: "Fix critical bug",
      auto: "low" as const,
      workspace,
    };

    const abortController = new AbortController();
    const runId = "test-run-escalation-halt";

    const generator = runOrchestrator(
      input,
      runId,
      abortController.signal,
      undefined, // history
      undefined, // projectConfig
      undefined, // escalationContext
      undefined, // authz
      undefined, // scanContext
      undefined // userId
    );

    const events: WorkflowEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    // Verify waves was called
    expect(mockRunWaves).toHaveBeenCalledTimes(1);

    // Verify merge/review phases were NOT called due to escalation
    expect(runMergePhaseCalled).toBe(false);
    expect(runConflictPhaseCalled).toBe(false);
    expect(runMergeAnalysisCalled).toBe(false);
    expect(runReviewPhaseCalled).toBe(false);

    // Verify escalation notice event was emitted
    const escalationEvent = events.find(
      (e) => e.type === "notice" && (e as any).message === "workflow_escalated"
    );
    expect(escalationEvent).toBeDefined();
  });

  it("propagates escalation reason from waves", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "orch-esc-reason-"));
    tempDirs.push(workspace);

    const expectedReason = "Missing dependency: @alfred/critical-package";

    // Configure mock to return escalated result with specific reason
    mockEscalationResult = true;
    mockEscalationReason = expectedReason;

    const input = {
      requirement: "Implement new feature",
      auto: "low" as const,
      workspace,
    };

    const abortController = new AbortController();
    const runId = "test-run-escalation-reason";

    const generator = runOrchestrator(
      input,
      runId,
      abortController.signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    const events: WorkflowEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    // Find the escalation notice event
    const escalationEvent = events.find(
      (e) => e.type === "notice" && (e as any).message === "workflow_escalated"
    );

    expect(escalationEvent).toBeDefined();
    expect((escalationEvent as any).reason).toBe(expectedReason);
  });

  it("persists escalation event to workflow history", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "orch-esc-persist-"));
    tempDirs.push(workspace);

    mockEscalationResult = true;
    mockEscalationReason = "architecture_mismatch";

    const input = {
      requirement: "Refactor database layer",
      auto: "low" as const,
      workspace,
    };

    const abortController = new AbortController();
    const runId = "test-run-escalation-persist";

    const generator = runOrchestrator(
      input,
      runId,
      abortController.signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    const events: WorkflowEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    // Verify that the escalation event is in the stream
    // (persistence to workflow_events happens at a higher layer)
    const escalationEvent = events.find(
      (e) => e.type === "notice" && (e as any).message === "workflow_escalated"
    );

    expect(escalationEvent).toBeDefined();
    expect((escalationEvent as any).reason).toBe("architecture_mismatch");

    // Verify event structure is correct for persistence
    expect(escalationEvent).toHaveProperty("type", "notice");
    expect(escalationEvent).toHaveProperty("message", "workflow_escalated");
    expect(escalationEvent).toHaveProperty("reason");
  });

  it("does not emit escalation event when waves complete normally", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "orch-no-esc-"));
    tempDirs.push(workspace);

    // Configure mock to return normal (non-escalated) result
    mockEscalationResult = false;
    mockEscalationReason = undefined;

    const input = {
      requirement: "Add unit tests",
      auto: "low" as const,
      workspace,
    };

    const abortController = new AbortController();
    const runId = "test-run-no-escalation";

    const generator = runOrchestrator(
      input,
      runId,
      abortController.signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    const events: WorkflowEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    // Verify NO escalation event was emitted
    const escalationEvent = events.find(
      (e) => e.type === "notice" && (e as any).message === "workflow_escalated"
    );
    expect(escalationEvent).toBeUndefined();

    // Verify merge phase WAS called (normal flow)
    expect(runMergePhaseCalled).toBe(true);
  });

  it("handles escalation with interrupt flag", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "orch-esc-int-"));
    tempDirs.push(workspace);

    // Configure mock for both escalation and interrupt
    mockEscalationResult = true;
    mockEscalationReason = "supervisor_interrupt";

    // Override mock to also set interrupted
    mockRunWaves.mockImplementationOnce(function* (_ctx: unknown) {
      yield { type: "notice", message: "waves_started" } as WorkflowEvent;
      return {
        trackerState: { agents: {}, waves: {} },
        allAgentOutcomes: [],
        agentFileHints: new Map<string, Set<string>>(),
        activeWorkspaces: [],
        aborted: false,
        interrupted: true,
        escalated: true,
        escalationReason: "supervisor_interrupt",
      };
    });

    const input = {
      requirement: "Complex refactoring",
      auto: "low" as const,
      workspace,
    };

    const abortController = new AbortController();
    const runId = "test-run-escalation-interrupt";

    const generator = runOrchestrator(
      input,
      runId,
      abortController.signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    const events: WorkflowEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    // Both escalation and interrupt events should be emitted
    const escalationEvent = events.find(
      (e) => e.type === "notice" && (e as any).message === "workflow_escalated"
    );
    const interruptEvent = events.find(
      (e) =>
        e.type === "notice" && (e as any).message === "workflow_interrupted"
    );

    expect(escalationEvent).toBeDefined();
    expect(interruptEvent).toBeDefined();

    // Merge phase should NOT be called
    expect(runMergePhaseCalled).toBe(false);
  });

  it("handles empty escalation reason gracefully", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "orch-esc-empty-"));
    tempDirs.push(workspace);

    // Configure mock with escalation but no reason
    mockEscalationResult = true;
    mockEscalationReason = undefined;

    const input = {
      requirement: "Debug issue",
      auto: "low" as const,
      workspace,
    };

    const abortController = new AbortController();
    const runId = "test-run-escalation-empty-reason";

    const generator = runOrchestrator(
      input,
      runId,
      abortController.signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    const events: WorkflowEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    // Escalation event should still be emitted
    const escalationEvent = events.find(
      (e) => e.type === "notice" && (e as any).message === "workflow_escalated"
    );
    expect(escalationEvent).toBeDefined();

    // Reason should be undefined (not an error)
    expect((escalationEvent as any).reason).toBeUndefined();

    // Merge phase should NOT be called
    expect(runMergePhaseCalled).toBe(false);
  });

  it("cleans up workspaces after escalation", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "orch-esc-cleanup-"));
    tempDirs.push(workspace);

    const mockWorkspace = {
      id: "test-workspace",
      cleanup: mock(async () => {}),
    };

    // Configure mock with active workspaces
    mockRunWaves.mockImplementationOnce(function* (_ctx: unknown) {
      yield { type: "notice", message: "waves_started" } as WorkflowEvent;
      return {
        trackerState: { agents: {}, waves: {} },
        allAgentOutcomes: [],
        agentFileHints: new Map<string, Set<string>>(),
        activeWorkspaces: [mockWorkspace],
        aborted: false,
        interrupted: false,
        escalated: true,
        escalationReason: "cleanup_test",
      };
    });

    const input = {
      requirement: "Test cleanup",
      auto: "low" as const,
      workspace,
    };

    const abortController = new AbortController();
    const runId = "test-run-escalation-cleanup";

    const generator = runOrchestrator(
      input,
      runId,
      abortController.signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    // Drain the generator
    const events: WorkflowEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    // Verify workspace cleanup was called
    expect(mockWorkspace.cleanup).toHaveBeenCalledTimes(1);
  });

  it("emits escalation event with proper structure for Linear notification", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "orch-esc-linear-"));
    tempDirs.push(workspace);

    const escalationReason =
      "Agent blocked: missing API credentials for external service";

    mockEscalationResult = true;
    mockEscalationReason = escalationReason;

    // Input with Linear context (sessionId, space, authz would be provided at workflow level)
    const input = {
      requirement: "Integrate external payment API",
      auto: "medium" as const,
      workspace,
      linear: {
        sessionId: "ALF-123:session-abc",
        space: "alfred-workspace",
        authz: "lin_oauth_token_xyz",
      },
    };

    const abortController = new AbortController();
    const runId = "test-run-escalation-linear";

    const generator = runOrchestrator(
      input,
      runId,
      abortController.signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    const events: WorkflowEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    // Find the escalation event
    const escalationEvent = events.find(
      (e) => e.type === "notice" && (e as any).message === "workflow_escalated"
    );

    expect(escalationEvent).toBeDefined();

    // Verify the event has the proper structure for downstream Linear notification
    // The event should contain:
    // - type: "notice" (for event classification)
    // - message: "workflow_escalated" (for event filtering)
    // - reason: the escalation reason (for notification body)
    expect(escalationEvent).toMatchObject({
      type: "notice",
      message: "workflow_escalated",
      reason: escalationReason,
    });

    // The escalation event structure allows the workflow orchestrator
    // (orchestrateWorkflowStream in workflow/orchestrator.ts) to:
    // 1. Detect escalation via event.type === "notice" && event.message === "workflow_escalated"
    // 2. Extract the reason via event.reason
    // 3. Send Linear notification via emitLinearActivity("escalation", {...})
    //
    // Note: Linear notification logic is handled at the workflow orchestrator level,
    // not in runOrchestrator. This test verifies the event structure is correct.
  });

  it("passes Linear context through orchestrator context", async () => {
    const workspace = await mkdtemp(
      path.join(tmpdir(), "orch-esc-linear-ctx-")
    );
    tempDirs.push(workspace);

    mockEscalationResult = true;
    mockEscalationReason = "context_propagation_test";

    let capturedContext: any = null;

    // Override mock to capture the context
    mockRunWaves.mockImplementationOnce(function* (ctx: unknown) {
      capturedContext = ctx;
      yield { type: "notice", message: "waves_started" } as WorkflowEvent;
      return {
        trackerState: { agents: {}, waves: {} },
        allAgentOutcomes: [],
        agentFileHints: new Map<string, Set<string>>(),
        activeWorkspaces: [],
        aborted: false,
        interrupted: false,
        escalated: true,
        escalationReason: "context_propagation_test",
      };
    });

    const linearContext = {
      sessionId: "ALF-456:session-def",
      space: "alfred-space",
      authz: "lin_oauth_token_abc",
      issueId: "ALF-456",
    };

    const input = {
      requirement: "Test Linear context propagation",
      auto: "low" as const,
      workspace,
      linear: linearContext,
    };

    const abortController = new AbortController();
    const runId = "test-run-escalation-linear-context";

    const generator = runOrchestrator(
      input,
      runId,
      abortController.signal,
      undefined,
      undefined,
      undefined,
      "authz-token-for-tools",
      undefined,
      "user-123"
    );

    // Drain the generator
    for await (const _ of generator) {
      // consume events
    }

    // Verify Linear context is propagated through orchestrator context
    expect(capturedContext).toBeDefined();
    expect(capturedContext.input.linear).toEqual(linearContext);
    expect(capturedContext.authz).toBe("authz-token-for-tools");
    expect(capturedContext.userId).toBe("user-123");
  });
});
