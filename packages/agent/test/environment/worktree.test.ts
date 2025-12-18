import { beforeEach, describe, expect, it, mock } from "bun:test";
import { WorktreeWorkspace } from "../../src/environment/worktree";

// Mock worktreeManager
mock.module("../../src/orchestrator/tool/worktree", () => ({
  worktreeManager: {
    create: mock((_repoBase, runId, id) =>
      Promise.resolve({
        path: `/tmp/alfred-test/${runId}/${id}`,
        branch: `agent/${runId}/${id}`,
        baseRef: "HEAD",
      })
    ),
    remove: mock(() => Promise.resolve(undefined)),
  },
}));

// Mock toolRunner
const mockExecute = mock(() =>
  Promise.resolve({ stdout: "", stderr: "", exitCode: 0 })
);
mock.module("../../src/orchestrator/tool/runner", () => ({
  toolRunner: {
    execute: mockExecute,
  },
}));

const mockSessionExecute = mock(() =>
  Promise.resolve({ ok: true, sessions: [] })
);
mock.module("../../src/orchestrator/tool/session", () => ({
  toolSession: {
    execute: mockSessionExecute,
  },
}));

describe("WorktreeWorkspace", () => {
  const workspace = new WorktreeWorkspace("agent-1", "run-123", "/tmp/repo");

  beforeEach(() => {
    mockExecute.mockClear();
  });

  it("initializes correctly", async () => {
    await workspace.initialize();
    expect(workspace.root).toBe("/tmp/alfred-test/run-123/agent-1");
  });

  it("checkpoints by creating a git tag", async () => {
    await workspace.initialize();
    await workspace.checkpoint("test-label");

    expect(mockExecute).toHaveBeenCalled();
    const cmd = mockExecute.mock.calls[0][0];
    expect(cmd).toContain("git tag -f checkpoint/run-123/agent-1/test-label");
  });

  it("restores by resetting to git tag", async () => {
    await workspace.initialize();
    await workspace.restore("test-label");

    // Should reset
    const calls = mockExecute.mock.calls;
    expect(calls.length).toBe(2);

    expect(calls[0][0]).toContain(
      "git reset --hard checkpoint/run-123/agent-1/test-label"
    );
    expect(calls[0][1]).toBe(workspace.root);

    // Should clean
    expect(calls[1][0]).toBe("git clean -fd");
    expect(calls[1][1]).toBe(workspace.root);
  });

  it("executes commands via toolRunner", async () => {
    await workspace.initialize();
    await workspace.exec("ls -la");

    expect(mockExecute).toHaveBeenCalledWith(
      "ls -la",
      workspace.root,
      undefined,
      undefined
    );
  });

  it("starts and stops sessions when enabled", async () => {
    const sessionWorkspace = new WorktreeWorkspace(
      "agent-1",
      "run-123",
      "/tmp/repo",
      { enableSessions: true }
    );
    await sessionWorkspace.initialize();

    const sessionId = await sessionWorkspace.startSession(
      "bun run dev",
      "dev-session"
    );
    expect(sessionId).toContain("dev-session");
    expect(mockSessionExecute).toHaveBeenCalledWith({
      input: {
        action: "start",
        sessionId,
        command: "bun run dev",
      },
    });

    await sessionWorkspace.stopSession?.(sessionId);
    expect(mockSessionExecute).toHaveBeenCalledWith({
      input: {
        action: "stop",
        sessionId,
      },
    });
  });

  it("cleans up sessions on cleanup", async () => {
    const sessionWorkspace = new WorktreeWorkspace(
      "agent-clean",
      "run-999",
      "/tmp/repo",
      { enableSessions: true }
    );
    await sessionWorkspace.initialize();
    const sessionId = await sessionWorkspace.startSession(
      "bun watch",
      "watch-session"
    );
    mockSessionExecute.mockClear();

    await sessionWorkspace.cleanup();
    expect(mockSessionExecute).toHaveBeenCalledWith({
      input: {
        action: "stop",
        sessionId,
      },
    });
  });
});
