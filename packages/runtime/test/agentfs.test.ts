import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import type { Workspace } from "@alfred/agent/environment/types";
import type { AgentSpec } from "@alfred/agent/orchestrator/multi/spawn";
import { createTrackerContext } from "@alfred/agent/orchestrator/multi/tracker";
import type { SubTask, WorkflowEvent } from "@alfred/type/plan";
import { AsyncQueue } from "../src/utils/concurrency";

const codexExecuteMock = mock(async (_args: unknown) => ({
  result: "ok",
  artifacts: [],
}));

const droidExecuteMock = mock(async (_args: unknown) => ({
  result: "ok",
  artifacts: [],
}));

const opencodeExecuteMock = mock(async (_args: unknown) => ({
  result: "ok",
  artifacts: [],
}));

const processForLearningMock = mock(async (_dbPath: string) => ({
  patterns: [],
  mistakes: [],
  insights: [],
}));

mock.module("@alfred/agent/orchestrator/tool/codex/index", () => ({
  toolCodex: { execute: codexExecuteMock },
}));

mock.module("@alfred/agent/orchestrator/tool/droid", () => ({
  toolDroid: { execute: droidExecuteMock },
}));

mock.module("@alfred/agent/orchestrator/tool/opencode/index", () => ({
  toolOpenCode: { execute: opencodeExecuteMock },
}));

mock.module("@alfred/agent/agentfs/learning-bridge", () => ({
  processForLearning: processForLearningMock,
}));

type AgentFSWorkspaceLike = Workspace & {
  kind: "agentfs";
  dbPath: string;
  recordToolCall: (
    name: string,
    startedAt: number,
    completedAt: number,
    parameters?: unknown,
    result?: unknown,
    error?: string
  ) => Promise<number>;
};

describe("runAgent (agentfs)", () => {
  const baseDir = path.join(
    process.cwd(),
    ".agent",
    "test-workspaces",
    "agentfs"
  );
  let workspaceDir: string;
  let originalWorkspaceCreate: typeof WorkspaceFactory.create;

  beforeEach(async () => {
    codexExecuteMock.mockClear();
    droidExecuteMock.mockClear();
    opencodeExecuteMock.mockClear();
    processForLearningMock.mockClear();

    await mkdir(baseDir, { recursive: true });
    workspaceDir = path.join(baseDir, `run-${Date.now().toString(36)}`);
    await mkdir(workspaceDir, { recursive: true });

    originalWorkspaceCreate = WorkspaceFactory.create;
  });

  afterEach(async () => {
    WorkspaceFactory.create = originalWorkspaceCreate;
    await rm(workspaceDir, { recursive: true, force: true });
  });

  it("passes agentfsDbPath to toolCodex and triggers learning extraction", async () => {
    const runId = "test-run-agentfs";
    const taskId = "T00000001";

    const task: SubTask = {
      id: taskId,
      title: "Test AgentFS",
      requirement: "Ensure agentfs path is threaded into codex execution.",
      deps: [],
      priority: 1,
      acceptance: ["agentfsDbPath is passed into toolCodex"],
      filesHint: [],
    };

    const spec: AgentSpec = {
      agentId: `${runId}:${taskId}`,
      subTaskId: taskId,
      sessionId: `${runId}:${taskId}`,
      workingDirectory: workspaceDir,
      environment: "agentfs",
      auto: "low",
      agentfsOverlay: true,
      execPlanPath: path.join(".agent", "plans", runId, `${taskId}.md`),
      context: {},
    };

    const captured: {
      agentfsOverlay?: boolean;
      authz?: string;
    } = {};

    const mockWorkspace: AgentFSWorkspaceLike = {
      id: "mock-agentfs",
      kind: "agentfs",
      root: workspaceDir,
      branch: null,
      dbPath: path.join(workspaceDir, ".agentfs", "audit.db"),
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
      startSession: async () => "session",
      stopSession: async () => {},
      listSessions: async () => [],
      recordToolCall: async () => 1,
    };

    WorkspaceFactory.create = ((kind, agentId, _runId, _workspace, options) => {
      expect(kind).toBe("agentfs");
      expect(agentId).toBe(spec.agentId);
      captured.agentfsOverlay = options?.agentfsOverlay;
      captured.authz = options?.authz;
      return mockWorkspace;
    }) as typeof WorkspaceFactory.create;

    const { runAgent } = await import("../src/orchestrator/agent");

    const tracker = createTrackerContext([task]);
    const trackerContextRef = { current: tracker };
    const queue = new AsyncQueue<WorkflowEvent>();

    const outcome = await runAgent({
      spec,
      phaseId: "phase-test",
      runId,
      workspace: workspaceDir,
      workspaceRoot: workspaceDir,
      subTaskById: new Map([[taskId, task]]),
      projectConfig: null,
      activeWorkspaces: [],
      agentFileHints: new Map(),
      rootExecPlanPath: path.join(
        workspaceDir,
        ".agent",
        "plans",
        runId,
        "root.md"
      ),
      signal: new AbortController().signal,
      authz: "authz-token",
      userId: "user-1",
      trackerContextRef,
      queue,
    });

    expect(outcome.status).toBe("completed");
    expect(captured.agentfsOverlay).toBe(true);
    expect(captured.authz).toBe("authz-token");

    expect(codexExecuteMock).toHaveBeenCalledTimes(1);
    const call = codexExecuteMock.mock.calls[0]?.[0] as
      | { input?: { agentfsDbPath?: string } }
      | undefined;
    expect(call?.input?.agentfsDbPath).toBe(mockWorkspace.dbPath);

    expect(processForLearningMock).toHaveBeenCalledWith(mockWorkspace.dbPath);
  });

  it("dispatches to toolDroid when agentType is droid", async () => {
    const runId = "test-run-agentfs-droid";
    const taskId = "T00000003";

    const task: SubTask = {
      id: taskId,
      title: "Test agent dispatch (droid)",
      requirement: "Verify runAgent routes to toolDroid when agentType=droid.",
      deps: [],
      priority: 1,
      acceptance: ["toolDroid.execute is called"],
      filesHint: [],
    };

    const spec: AgentSpec = {
      agentId: `${runId}:${taskId}`,
      subTaskId: taskId,
      sessionId: `${runId}:${taskId}`,
      workingDirectory: workspaceDir,
      environment: "agentfs",
      auto: "low",
      agentType: "droid",
      execPlanPath: path.join(".agent", "plans", runId, `${taskId}.md`),
      context: {},
    };

    const mockWorkspace: AgentFSWorkspaceLike = {
      id: "mock-agentfs-droid",
      kind: "agentfs",
      root: workspaceDir,
      branch: null,
      dbPath: path.join(workspaceDir, ".agentfs", "audit.db"),
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
      startSession: async () => "session",
      stopSession: async () => {},
      listSessions: async () => [],
      recordToolCall: async () => 1,
    };

    WorkspaceFactory.create = (async () =>
      mockWorkspace) as typeof WorkspaceFactory.create;

    const { runAgent } = await import("../src/orchestrator/agent");

    const tracker = createTrackerContext([task]);
    const trackerContextRef = { current: tracker };
    const queue = new AsyncQueue<WorkflowEvent>();

    const outcome = await runAgent({
      spec,
      phaseId: "phase-test",
      runId,
      workspace: workspaceDir,
      workspaceRoot: workspaceDir,
      subTaskById: new Map([[taskId, task]]),
      projectConfig: null,
      activeWorkspaces: [],
      agentFileHints: new Map(),
      rootExecPlanPath: path.join(
        workspaceDir,
        ".agent",
        "plans",
        runId,
        "root.md"
      ),
      signal: new AbortController().signal,
      authz: "authz-token",
      userId: "user-1",
      trackerContextRef,
      queue,
    });

    expect(outcome.role).toBe("droid");
    expect(droidExecuteMock).toHaveBeenCalledTimes(1);
    expect(codexExecuteMock).toHaveBeenCalledTimes(0);
    expect(opencodeExecuteMock).toHaveBeenCalledTimes(0);
  });

  it("dispatches to toolOpenCode when agentType is opencode", async () => {
    const runId = "test-run-agentfs-opencode";
    const taskId = "T00000004";

    const task: SubTask = {
      id: taskId,
      title: "Test agent dispatch (opencode)",
      requirement:
        "Verify runAgent routes to toolOpenCode when agentType=opencode.",
      deps: [],
      priority: 1,
      acceptance: ["toolOpenCode.execute is called"],
      filesHint: [],
    };

    const spec: AgentSpec = {
      agentId: `${runId}:${taskId}`,
      subTaskId: taskId,
      sessionId: `${runId}:${taskId}`,
      workingDirectory: workspaceDir,
      environment: "agentfs",
      auto: "low",
      agentType: "opencode",
      execPlanPath: path.join(".agent", "plans", runId, `${taskId}.md`),
      context: {},
    };

    const mockWorkspace: AgentFSWorkspaceLike = {
      id: "mock-agentfs-opencode",
      kind: "agentfs",
      root: workspaceDir,
      branch: null,
      dbPath: path.join(workspaceDir, ".agentfs", "audit.db"),
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
      startSession: async () => "session",
      stopSession: async () => {},
      listSessions: async () => [],
      recordToolCall: async () => 1,
    };

    WorkspaceFactory.create = (async () =>
      mockWorkspace) as typeof WorkspaceFactory.create;

    const { runAgent } = await import("../src/orchestrator/agent");

    const tracker = createTrackerContext([task]);
    const trackerContextRef = { current: tracker };
    const queue = new AsyncQueue<WorkflowEvent>();

    const outcome = await runAgent({
      spec,
      phaseId: "phase-test",
      runId,
      workspace: workspaceDir,
      workspaceRoot: workspaceDir,
      subTaskById: new Map([[taskId, task]]),
      projectConfig: null,
      activeWorkspaces: [],
      agentFileHints: new Map(),
      rootExecPlanPath: path.join(
        workspaceDir,
        ".agent",
        "plans",
        runId,
        "root.md"
      ),
      signal: new AbortController().signal,
      authz: "authz-token",
      userId: "user-1",
      trackerContextRef,
      queue,
    });

    expect(outcome.role).toBe("opencode");
    expect(opencodeExecuteMock).toHaveBeenCalledTimes(1);
    expect(codexExecuteMock).toHaveBeenCalledTimes(0);
    expect(droidExecuteMock).toHaveBeenCalledTimes(0);
  });

  it("does not fail the run when AgentFS learning extraction throws (best-effort)", async () => {
    processForLearningMock.mockRejectedValueOnce(
      new Error("agentfs_db_corrupt")
    );

    const runId = "test-run-agentfs-failure";
    const taskId = "T00000002";

    const task: SubTask = {
      id: taskId,
      title: "Test AgentFS learning failure",
      requirement:
        "Learning extraction must be best-effort and never fail the run.",
      deps: [],
      priority: 1,
      acceptance: ["run completes even if learning extraction fails"],
      filesHint: [],
    };

    const spec: AgentSpec = {
      agentId: `${runId}:${taskId}`,
      subTaskId: taskId,
      sessionId: `${runId}:${taskId}`,
      workingDirectory: workspaceDir,
      environment: "agentfs",
      auto: "low",
      agentfsOverlay: true,
      execPlanPath: path.join(".agent", "plans", runId, `${taskId}.md`),
      context: {},
    };

    const mockWorkspace: AgentFSWorkspaceLike = {
      id: "mock-agentfs-2",
      kind: "agentfs",
      root: workspaceDir,
      branch: null,
      dbPath: path.join(workspaceDir, ".agentfs", "audit.db"),
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
      startSession: async () => "session",
      stopSession: async () => {},
      listSessions: async () => [],
      recordToolCall: async () => 1,
    };

    WorkspaceFactory.create = (async () =>
      mockWorkspace) as typeof WorkspaceFactory.create;

    const { runAgent } = await import("../src/orchestrator/agent");
    const tracker = createTrackerContext([task]);
    const trackerContextRef = { current: tracker };
    const queue = new AsyncQueue<WorkflowEvent>();

    const outcome = await runAgent({
      spec,
      phaseId: "phase-test",
      runId,
      workspace: workspaceDir,
      workspaceRoot: workspaceDir,
      subTaskById: new Map([[taskId, task]]),
      projectConfig: null,
      activeWorkspaces: [],
      agentFileHints: new Map(),
      rootExecPlanPath: path.join(
        workspaceDir,
        ".agent",
        "plans",
        runId,
        "root.md"
      ),
      signal: new AbortController().signal,
      authz: "authz-token",
      userId: "user-1",
      trackerContextRef,
      queue,
    });

    expect(outcome.status).toBe("completed");
    expect(processForLearningMock).toHaveBeenCalledWith(mockWorkspace.dbPath);
  });
});
