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
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
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
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
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

  it("passes execProfile=server to toolCodex when spec.profile is server", async () => {
    const runId = "test-run-agentfs-codex-server";
    const taskId = "T00000005";

    const task: SubTask = {
      id: taskId,
      title: "Test agent dispatch (codex server profile)",
      requirement: "Verify runAgent passes execProfile=server to toolCodex.",
      deps: [],
      priority: 1,
      acceptance: ["toolCodex.execute receives execProfile=server"],
      filesHint: [],
    };

    const spec: AgentSpec = {
      agentId: `${runId}:${taskId}`,
      subTaskId: taskId,
      sessionId: `${runId}:${taskId}`,
      workingDirectory: workspaceDir,
      environment: "agentfs",
      auto: "low",
      agentType: "codex",
      profile: "server",
      execPlanPath: path.join(".agent", "plans", runId, `${taskId}.md`),
      context: {},
    };

    const mockWorkspace: AgentFSWorkspaceLike = {
      id: "mock-agentfs-codex-server",
      kind: "agentfs",
      root: workspaceDir,
      branch: null,
      dbPath: path.join(workspaceDir, ".agentfs", "audit.db"),
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
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

    await runAgent({
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

    expect(codexExecuteMock).toHaveBeenCalledTimes(1);
    const call = codexExecuteMock.mock.calls[0]?.[0] as
      | { input?: { execProfile?: string; profile?: string } }
      | undefined;

    expect(call?.input?.execProfile).toBe("server");
    expect(call?.input?.profile).toBeUndefined();
  });

  it("defaults execProfile=server to toolCodex when spec.profile is unset", async () => {
    const runId = "test-run-agentfs-codex-default-server";
    const taskId = "T00000007";

    const task: SubTask = {
      id: taskId,
      title: "Test codex default execProfile",
      requirement:
        "Verify runAgent defaults execProfile=server for codex when profile is unset inside AgentFS.",
      deps: [],
      priority: 1,
      acceptance: ["toolCodex.execute receives execProfile=server"],
      filesHint: [],
    };

    const spec: AgentSpec = {
      agentId: `${runId}:${taskId}`,
      subTaskId: taskId,
      sessionId: `${runId}:${taskId}`,
      workingDirectory: workspaceDir,
      environment: "agentfs",
      auto: "low",
      agentType: "codex",
      execPlanPath: path.join(".agent", "plans", runId, `${taskId}.md`),
      context: {},
    };

    const mockWorkspace: AgentFSWorkspaceLike = {
      id: "mock-agentfs-codex-default-server",
      kind: "agentfs",
      root: workspaceDir,
      branch: null,
      dbPath: path.join(workspaceDir, ".agentfs", "audit.db"),
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
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

    await runAgent({
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

    expect(codexExecuteMock).toHaveBeenCalledTimes(1);
    const call = codexExecuteMock.mock.calls[0]?.[0] as
      | { input?: { execProfile?: string } }
      | undefined;
    expect(call?.input?.execProfile).toBe("server");
  });

  it("falls back to default execProfile when codex server start fails", async () => {
    codexExecuteMock.mockImplementationOnce(async () => {
      throw new Error("codex_server_start_failed");
    });

    const runId = "test-run-agentfs-codex-fallback";
    const taskId = "T00000008";

    const task: SubTask = {
      id: taskId,
      title: "Test codex server fallback",
      requirement:
        "Verify runAgent retries with default profile when codex server start fails.",
      deps: [],
      priority: 1,
      acceptance: ["server failure triggers fallback notice + default retry"],
      filesHint: [],
    };

    const spec: AgentSpec = {
      agentId: `${runId}:${taskId}`,
      subTaskId: taskId,
      sessionId: `${runId}:${taskId}`,
      workingDirectory: workspaceDir,
      environment: "agentfs",
      auto: "low",
      agentType: "codex",
      execPlanPath: path.join(".agent", "plans", runId, `${taskId}.md`),
      context: {},
    };

    const mockWorkspace: AgentFSWorkspaceLike = {
      id: "mock-agentfs-codex-fallback",
      kind: "agentfs",
      root: workspaceDir,
      branch: null,
      dbPath: path.join(workspaceDir, ".agentfs", "audit.db"),
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
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

    const captured: WorkflowEvent[] = [];
    const queue = new AsyncQueue<WorkflowEvent>();
    const enqueue = queue.enqueue.bind(queue);
    queue.enqueue = (value: WorkflowEvent) => {
      captured.push(value);
      enqueue(value);
    };

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
    expect(codexExecuteMock).toHaveBeenCalledTimes(2);

    const first = codexExecuteMock.mock.calls[0]?.[0] as
      | { input?: { execProfile?: string } }
      | undefined;
    const second = codexExecuteMock.mock.calls[1]?.[0] as
      | { input?: { execProfile?: string } }
      | undefined;

    expect(first?.input?.execProfile).toBe("server");
    expect(second?.input?.execProfile).toBe("default");
    expect(
      captured.some(
        (e) => (e as any).message === "executor_server_fallback_default"
      )
    ).toBe(true);
  });

  it("treats unknown spec.profile as Codex CLI profile (not execProfile)", async () => {
    const runId = "test-run-agentfs-codex-cli-profile";
    const taskId = "T00000006";

    const task: SubTask = {
      id: taskId,
      title: "Test codex CLI profile passthrough",
      requirement:
        "Verify runAgent passes spec.profile through as Codex CLI profile when not default/server.",
      deps: [],
      priority: 1,
      acceptance: ["toolCodex.execute receives profile passthrough"],
      filesHint: [],
    };

    const spec: AgentSpec = {
      agentId: `${runId}:${taskId}`,
      subTaskId: taskId,
      sessionId: `${runId}:${taskId}`,
      workingDirectory: workspaceDir,
      environment: "agentfs",
      auto: "low",
      agentType: "codex",
      profile: "myprofile",
      execPlanPath: path.join(".agent", "plans", runId, `${taskId}.md`),
      context: {},
    };

    const mockWorkspace: AgentFSWorkspaceLike = {
      id: "mock-agentfs-codex-cli-profile",
      kind: "agentfs",
      root: workspaceDir,
      branch: null,
      dbPath: path.join(workspaceDir, ".agentfs", "audit.db"),
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
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

    await runAgent({
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

    expect(codexExecuteMock).toHaveBeenCalledTimes(1);
    const call = codexExecuteMock.mock.calls[0]?.[0] as
      | { input?: { execProfile?: string; profile?: string } }
      | undefined;

    expect(call?.input?.execProfile).toBeUndefined();
    expect(call?.input?.profile).toBe("myprofile");
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
      profile: "server",
      execPlanPath: path.join(".agent", "plans", runId, `${taskId}.md`),
      context: {},
    };

    const mockWorkspace: AgentFSWorkspaceLike = {
      id: "mock-agentfs-opencode",
      kind: "agentfs",
      root: workspaceDir,
      branch: null,
      dbPath: path.join(workspaceDir, ".agentfs", "audit.db"),
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
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
    const call = opencodeExecuteMock.mock.calls[0]?.[0] as
      | { input?: { execProfile?: string } }
      | undefined;
    expect(call?.input?.execProfile).toBe("server");
    expect(codexExecuteMock).toHaveBeenCalledTimes(0);
    expect(droidExecuteMock).toHaveBeenCalledTimes(0);
  });

  it("defaults execProfile=server to toolOpenCode when spec.profile is unset", async () => {
    const runId = "test-run-agentfs-opencode-default-server";
    const taskId = "T00000009";

    const task: SubTask = {
      id: taskId,
      title: "Test opencode default execProfile",
      requirement:
        "Verify runAgent defaults execProfile=server for opencode when profile is unset inside AgentFS.",
      deps: [],
      priority: 1,
      acceptance: ["toolOpenCode.execute receives execProfile=server"],
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
      id: "mock-agentfs-opencode-default-server",
      kind: "agentfs",
      root: workspaceDir,
      branch: null,
      dbPath: path.join(workspaceDir, ".agentfs", "audit.db"),
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
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
    const call = opencodeExecuteMock.mock.calls[0]?.[0] as
      | { input?: { execProfile?: string } }
      | undefined;
    expect(call?.input?.execProfile).toBe("server");
  });

  it("falls back to default execProfile when opencode server start fails", async () => {
    opencodeExecuteMock.mockImplementationOnce(async () => {
      throw new Error("opencode_server_start_failed");
    });

    const runId = "test-run-agentfs-opencode-fallback";
    const taskId = "T00000010";

    const task: SubTask = {
      id: taskId,
      title: "Test opencode server fallback",
      requirement:
        "Verify runAgent retries with default profile when opencode server start fails.",
      deps: [],
      priority: 1,
      acceptance: ["server failure triggers fallback notice + default retry"],
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
      id: "mock-agentfs-opencode-fallback",
      kind: "agentfs",
      root: workspaceDir,
      branch: null,
      dbPath: path.join(workspaceDir, ".agentfs", "audit.db"),
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
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

    const captured: WorkflowEvent[] = [];
    const queue = new AsyncQueue<WorkflowEvent>();
    const enqueue = queue.enqueue.bind(queue);
    queue.enqueue = (value: WorkflowEvent) => {
      captured.push(value);
      enqueue(value);
    };

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
    expect(outcome.status).toBe("completed");
    expect(opencodeExecuteMock).toHaveBeenCalledTimes(2);

    const first = opencodeExecuteMock.mock.calls[0]?.[0] as
      | { input?: { execProfile?: string } }
      | undefined;
    const second = opencodeExecuteMock.mock.calls[1]?.[0] as
      | { input?: { execProfile?: string } }
      | undefined;

    expect(first?.input?.execProfile).toBe("server");
    expect(second?.input?.execProfile).toBe("default");
    expect(
      captured.some(
        (e) => (e as any).message === "executor_server_fallback_default"
      )
    ).toBe(true);
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
      containerName: "alfred-agentfs-test",
      containerCw: "/workspace",
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
