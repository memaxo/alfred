import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { randomUUID } from "node:crypto";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import type { Workspace } from "@alfred/agent/environment/types";
import { WorktreeWorkspace } from "@alfred/agent/environment/worktree";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { toolSession } from "@alfred/agent/orchestrator/tool/session";
import { smokeTester } from "@alfred/agent/orchestrator/verification/smoke";
import {
  checkTmuxLeaks,
  __internals as leakInternals,
} from "../../../scripts/check-tmux-leaks.ts";
import { reviewWorkflowRepo, runReviewPhase } from "../src/orchestrator/review";
import type { OrchestratorContext } from "../src/orchestrator/types";
import { cleanupPlanDir, preparePlanDir } from "./utils/review-helpers";

// Create mock functions BEFORE any imports
let mockWorkflowRun: {
  id: string;
  stateData: Record<string, unknown> | null;
} | null = null;

const codexExecuteMock = mock(async () => {
  await Promise.resolve();
  throw new Error("fixer-crash");
});

const smokeVerifyMock = mock(async () => ({ success: true, message: "ok" }));
const runCommandMock = mock(async () => ({
  stdout: "",
  stderr: "",
  exitCode: 0,
  durationMs: 0,
}));

const mockGetRun = mock(async (_runId: string) => mockWorkflowRun);
const mockUpdateRun = mock(
  async (_runId: string, _patch: { stateData?: unknown }) => mockWorkflowRun
);

const toolSessionExecuteMock = mock(
  async (_args: { input: { action: string; sessionId: string } }) => ({
    ok: true,
    output: "mock",
  })
);

const workspaceCreateMock = mock(async () => {
  await Promise.resolve();
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

// SKIP: These tests pass in isolation but fail when run with other tests due to
// Bun's mock.module() not isolating properly between test files.
// TODO: Refactor to use dependency injection instead of mock.module()
// biome-ignore lint/suspicious/noSkippedTests: Mock isolation issue needs refactor
describe.skip("workspace session coverage", () => {
  const activeSessions = new Set<string>();
  let originalGetRun: typeof reviewWorkflowRepo.getRun;
  let originalUpdateRun: typeof reviewWorkflowRepo.updateRun;
  let originalWorkspaceCreate: typeof WorkspaceFactory.create;
  let originalCodexExecute: typeof toolCodex.execute;
  let originalSmokeVerify: typeof smokeTester.verify;
  let originalSessionExecute: typeof toolSession.execute;

  beforeEach(() => {
    process.env.ORCH_ENABLE_SESSIONS = "1";
    process.env.ORCH_TMUX_DISABLED = "1";
    leakInternals.setListHandler(async () => Array.from(activeSessions));
    mockWorkflowRun = { id: "test-run", stateData: null };

    // Store originals
    originalGetRun = reviewWorkflowRepo.getRun;
    originalUpdateRun = reviewWorkflowRepo.updateRun;
    originalWorkspaceCreate = WorkspaceFactory.create;
    originalCodexExecute = toolCodex.execute;
    originalSmokeVerify = smokeTester.verify;
    originalSessionExecute = toolSession.execute;

    // Reset all mocks
    codexExecuteMock.mockReset();
    smokeVerifyMock.mockReset();
    runCommandMock.mockReset();
    mockGetRun.mockReset();
    mockUpdateRun.mockReset();
    toolSessionExecuteMock.mockReset();
    workspaceCreateMock.mockReset();

    // Set up default implementations
    codexExecuteMock.mockImplementation(async () => {
      await Promise.resolve();
      throw new Error("fixer-crash");
    });
    smokeVerifyMock.mockImplementation(async () => ({
      success: true,
      message: "ok",
    }));
    runCommandMock.mockImplementation(async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 0,
    }));
    mockGetRun.mockImplementation(async (_runId: string) => mockWorkflowRun);
    mockUpdateRun.mockImplementation(
      async (_runId: string, _patch: { stateData?: unknown }) => mockWorkflowRun
    );

    reviewWorkflowRepo.getRun = mockGetRun;
    reviewWorkflowRepo.updateRun = mockUpdateRun;

    WorkspaceFactory.create =
      workspaceCreateMock as unknown as typeof WorkspaceFactory.create;
    toolCodex.execute = codexExecuteMock;
    smokeTester.verify = smokeVerifyMock;
    toolSession.execute =
      toolSessionExecuteMock as unknown as typeof toolSession.execute;
  });

  afterEach(async () => {
    await Promise.resolve();
    process.env.ORCH_ENABLE_SESSIONS = undefined;
    process.env.ORCH_TMUX_DISABLED = undefined;
    leakInternals.resetListHandler();
    activeSessions.clear();

    reviewWorkflowRepo.getRun = originalGetRun;
    reviewWorkflowRepo.updateRun = originalUpdateRun;

    WorkspaceFactory.create = originalWorkspaceCreate;
    toolCodex.execute = originalCodexExecute;
    smokeTester.verify = originalSmokeVerify;
    toolSession.execute = originalSessionExecute;
  });

  afterAll(() => {
    // Avoid `mock.module()` so this suite remains order-independent across files.
  });

  it("starts and stops fixer sessions even when the fixer crashes", async () => {
    const runId = `review-sessions-${randomUUID()}`;
    await preparePlanDir(runId);

    const startSpy = mock(async (_command: string, sessionId?: string) => {
      await Promise.resolve();
      const id = sessionId ?? `ws-${runId}-stub-${Date.now().toString(36)}`;
      activeSessions.add(id);
      return id;
    });
    const stopSpy = mock(async (sessionId: string) => {
      await Promise.resolve();
      activeSessions.delete(sessionId);
    });
    const cleanupSpy = mock(async () => {
      await Promise.resolve();
      activeSessions.clear();
    });

    workspaceCreateMock.mockImplementation(async () => {
      await Promise.resolve();
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

    runCommandMock.mockImplementation(async (command: string) => ({
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

    const generator = runReviewPhase(ctx, mergePlan, {
      sessionsEnabled: true,
      workspaceCreate:
        workspaceCreateMock as unknown as typeof WorkspaceFactory.create,
      runCommand: runCommandMock as unknown as typeof runCommandMock,
      codexExecute: codexExecuteMock,
      smokeVerify: smokeVerifyMock,
    });
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
    const runId = `concurrent-${randomUUID()}`;
    const sessionTracker = new Set<string>();

    toolSessionExecuteMock.mockImplementation(
      async ({ input }: { input: { action: string; sessionId: string } }) => {
        await Promise.resolve();
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
