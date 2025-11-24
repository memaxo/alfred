import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { runReviewPhase } from "../src/orchestrator/review";
import type { OrchestratorContext } from "../src/orchestrator/types";
import {
  cleanupPlanDir,
  mockRunner,
  preparePlanDir,
} from "./utils/review-helpers";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { smokeTester } from "@alfred/agent/orchestrator/verification/smoke";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import type { Workspace } from "@alfred/agent/environment/types";
import { WorktreeWorkspace } from "@alfred/agent/environment/worktree";
import { toolSession } from "@alfred/agent/orchestrator/tool/session";
import {
  checkTmuxLeaks,
  __internals as leakInternals,
} from "../../../scripts/check-tmux-leaks.ts";

describe("workspace session coverage", () => {
  const originalWorkspaceCreate = WorkspaceFactory.create;
  const originalCodex = toolCodex.execute;
  const originalSmoke = smokeTester.verify;
  const originalToolSession = toolSession.execute;

  let restoreRunner: (() => void) | undefined;
  const activeSessions = new Set<string>();

  beforeEach(() => {
    process.env.ORCH_ENABLE_SESSIONS = "1";
    process.env.ORCH_TMUX_DISABLED = "1";
    leakInternals.setListHandler(async () => Array.from(activeSessions));
  });

  afterEach(async () => {
    delete process.env.ORCH_ENABLE_SESSIONS;
    delete process.env.ORCH_TMUX_DISABLED;
    leakInternals.resetListHandler();
    activeSessions.clear();

    restoreRunner?.();
    restoreRunner = undefined;

    WorkspaceFactory.create = originalWorkspaceCreate;
    toolCodex.execute = originalCodex;
    smokeTester.verify = originalSmoke;
    toolSession.execute = originalToolSession;
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

    WorkspaceFactory.create = mock(async () => {
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

    toolCodex.execute = mock(async () => {
      throw new Error("fixer-crash");
    });

    smokeTester.verify = async () => ({ success: true, message: "ok" });

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

    toolSession.execute = mock(async ({
      input,
    }: Parameters<typeof toolSession.execute>[0]) => {
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
    });

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
});
