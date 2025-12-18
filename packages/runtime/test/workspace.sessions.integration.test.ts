import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Workspace } from "@alfred/agent/environment/types";
import {
  checkTmuxLeaks,
  __internals as leakInternals,
} from "../../../scripts/check-tmux-leaks.ts";
import type { OrchestratorContext } from "../src/orchestrator/types";
import {
  cleanupPlanDir,
  mockRunner,
  preparePlanDir,
} from "./utils/review-helpers";

// Create mock functions BEFORE any imports
let mockWorkflowRun: {
  id: string;
  stateData: Record<string, unknown> | null;
} | null = null;

const codexExecuteMock = mock(async () => {
  throw new Error("fixer-crash");
});

const smokeVerifyMock = mock(async () => ({ success: true, message: "ok" }));

const mockGetRun = mock(async (_runId: string) => mockWorkflowRun);
const mockUpdateRun = mock(
  async (_runId: string, _patch: { stateData?: unknown }) => mockWorkflowRun
);

const toolSessionExecuteMock = mock(
  async ({ input }: { input: { action: string; sessionId: string } }) => {
    return { ok: true, output: "mock" };
  }
);

const workspaceCreateMock = mock(async () => {
  const workspace: Workspace = {
    id: "mock-workspace",
    kind: "worktree",
    root: process.cwd(),
    initialize: async () => {},
    cleanup: async () => {},
    checkpoint: async () => {},
    restore: async () => {},
    exec: async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 0,
    }),
    startSession: async () => "mock-session",
    stopSession: async () => {},
    listSessions: async () => [],
  };
  return workspace;
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

mock.module("@alfred/agent/orchestrator/tool/session", () => ({
  toolSession: {
    execute: toolSessionExecuteMock,
    name: "session",
    description: "Mock session tool",
    inputSchema: {},
    outputSchema: {},
  },
}));

mock.module("@alfred/agent/environment/factory", () => ({
  WorkspaceFactory: {
    create: workspaceCreateMock,
  },
}));

// Now import - these will get the mocked versions
const { WorkspaceFactory } = await import("@alfred/agent/environment/factory");
const { toolCodex } = await import("@alfred/agent/orchestrator/tool/codex/index");
const { toolSession } = await import("@alfred/agent/orchestrator/tool/session");
const { smokeTester } = await import("@alfred/agent/orchestrator/verification/smoke");
const { WorktreeWorkspace } = await import("@alfred/agent/environment/worktree");
const { runReviewPhase, reviewWorkflowRepo } = await import(
  "../src/orchestrator/review"
);

describe("workspace session coverage", () => {
  let restoreRunner: (() => void) | undefined;
  const activeSessions = new Set<string>();
  let originalGetRun: typeof reviewWorkflowRepo.getRun;
  let originalUpdateRun: typeof reviewWorkflowRepo.updateRun;

  beforeEach(() => {
    process.env.ORCH_ENABLE_SESSIONS = "1";
    process.env.ORCH_TMUX_DISABLED = "1";
    leakInternals.setListHandler(async () => Array.from(activeSessions));
    mockWorkflowRun = { id: "test-run", stateData: null };

    // Store originals
    originalGetRun = reviewWorkflowRepo.getRun;
    originalUpdateRun = reviewWorkflowRepo.updateRun;

    // Reset all mocks
    codexExecuteMock.mockReset();
    smokeVerifyMock.mockReset();
    mockGetRun.mockReset();
    mockUpdateRun.mockReset();
    toolSessionExecuteMock.mockReset();
    workspaceCreateMock.mockReset();

    // Set up default implementations
    codexExecuteMock.mockImplementation(async () => {
      throw new Error("fixer-crash");
    });
    smokeVerifyMock.mockImplementation(async () => ({ success: true, message: "ok" }));
    mockGetRun.mockImplementation(async (_runId: string) => mockWorkflowRun);
    mockUpdateRun.mockImplementation(
      async (_runId: string, _patch: { stateData?: unknown }) => mockWorkflowRun
    );

    reviewWorkflowRepo.getRun = mockGetRun;
    reviewWorkflowRepo.updateRun = mockUpdateRun;
  });

  afterEach(async () => {
    process.env.ORCH_ENABLE_SESSIONS = undefined;
    process.env.ORCH_TMUX_DISABLED = undefined;
    leakInternals.resetListHandler();
    activeSessions.clear();

    restoreRunner?.();
    restoreRunner = undefined;

    reviewWorkflowRepo.getRun = originalGetRun;
    reviewWorkflowRepo.updateRun = originalUpdateRun;
  });

  afterAll(() => {
    mock.restore();
  });

  it("starts and stops fixer sessions even when the fixer crashes", async () => {
    const runId = `review-sessions-${Date.now().toString(36)}`;
    await preparePlanDir(runId);

    const startSpy = mock(async (_command: string, sessionId?: string) => {
      const id = sessionId ?? `ws-${runId}-stub-${Date.now().toString(36)}`;
      activeSessions.add(id);
      return id;
    });
    const stopSpy = mock(async (sessionId: string) => {
      activeSessions.delete(sessionId);
    });
    const cleanupSpy = mock(async () => {
      activeSessions.clear();
    });

    workspaceCreateMock.mockImplementation(async () => {
      const workspace: Workspace = {
        id: "review-session",
        kind: "worktree",
        root: process.cwd(),
        initialize: async () => {},
        cleanup: cleanupSpy,
        checkpoint: async () => {},
        restore: async () => {},
        exec: async () => ({
          stdout: "",
          stderr: "",
          exitCode: 0,
          durationMs: 0,
        }),
        startSession: startSpy,
        stopSession: stopSpy,
        listSessions: async () => Array.from(activeSessions),
      };
      return workspace;
    });

    restoreRunner = mockRunner(async ({ command }) => ({
      stdout: "",
      stderr: `failed: ${command}`,
      exitCode: 1,
      durationMs: 5,
    }));

    const ctx: OrchestratorContext = {
      input: {
        requirement: "ensure fixer tmux sessions are cleaned up",
        auto: "medium",
      },
      runId,
      signal: new AbortController().signal,
      workspace: process.cwd(),
      projectConfig: null,
    } as OrchestratorContext;

    const mergePlan = {
      summary: "tmux coverage",
      expectedFiles: ["packages/runtime/src/orchestrator/review.ts"],
      changedPackages: ["packages/runtime"],
      targetBranch: "dev",
      branches: [],
    };

    const generator = runReviewPhase(ctx, mergePlan);
    for await (const _event of generator) {
      // Drain iterator; assertions rely on side-effects
    }

    expect(startSpy.mock.calls.length).toBe(3);
    expect(stopSpy.mock.calls.length).toBe(3);
    expect(activeSessions.size).toBe(0);

    await checkTmuxLeaks({ quiet: true });
    await cleanupPlanDir(runId);
  });

  it("generates unique session ids when startSession is invoked concurrently", async () => {
    const runId = `concurrent-${Date.now().toString(36)}`;
    const sessionTracker = new Set<string>();

    toolSessionExecuteMock.mockImplementation(
      async ({ input }: { input: { action: string; sessionId: string } }) => {
        switch (input.action) {
          case "start": {
            sessionTracker.add(input.sessionId);
            return { ok: true, output: "started" };
          }
          case "stop": {
            sessionTracker.delete(input.sessionId);
            return { ok: true, output: "stopped" };
          }
          case "list": {
            return { ok: true, sessions: Array.from(sessionTracker) };
          }
          default:
            return { ok: true };
        }
      }
    );

    leakInternals.setListHandler(async () => Array.from(sessionTracker));

    const workspace = new WorktreeWorkspace("agent-cc", runId, process.cwd(), {
      enableSessions: true,
    });

    const [first, second] = await Promise.all([
      workspace.startSession("bash"),
      workspace.startSession("bash"),
    ]);

    expect(first).not.toBe(second);
    expect(first).toContain(runId);
    expect(second).toContain(runId);
    expect(sessionTracker.size).toBe(2);

    await Promise.all([
      workspace.stopSession(first),
      workspace.stopSession(second),
    ]);

    expect(sessionTracker.size).toBe(0);
    await checkTmuxLeaks({ quiet: true });
  });

  it("fails leak detection when tmux sessions remain", async () => {
    const leakingSessions = ["ws-leak-test-1"];
    leakInternals.setListHandler(async () => leakingSessions);

    await expect(checkTmuxLeaks({ quiet: true })).rejects.toThrow(
      "tmux_session_leak_detected"
    );
  });
});
