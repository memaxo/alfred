import type { WorkflowEvent } from "@alfred/type/plan";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { AsyncQueue } from "../src/utils/concurrency";

const workspaceCreateMock = vi.fn();
const toolCodexExecuteMock = vi.fn();
const toolOpenCodeExecuteMock = vi.fn();
const toolDroidExecuteMock = vi.fn();
const processForLearningMock = vi.fn().mockResolvedValue();

mock.module("@alfred/agent/environment/factory", () => ({
  WorkspaceFactory: {
    create: workspaceCreateMock,
  },
}));

mock.module("@alfred/agent/environment/agentfs", () => ({
  isAgentFSWorkspace: (ws: unknown) =>
    Boolean((ws as { __isAgentfs?: unknown } | null)?.__isAgentfs),
}));

mock.module("@alfred/agent/orchestrator/loops/tdd", () => ({
  runTDDLoop: vi.fn(),
}));

mock.module("@alfred/agent/orchestrator/multi/execplan", () => ({
  generateSubtaskExecPlanSkeleton: () => "execplan-skeleton",
}));

mock.module("@alfred/agent/orchestrator/multi/tracker", () => ({
  createTrackerContext: vi.fn(() => ({ state: { agents: {} } })),
  detectStuckWithContext: vi.fn(() => false),
  updateTrackerWithContext: vi.fn((ctx: unknown) => ctx),
}));

mock.module("@alfred/agent/orchestrator/tool/codex/index", () => ({
  toolCodex: {
    execute: toolCodexExecuteMock,
  },
}));

mock.module("@alfred/agent/orchestrator/tool/opencode/index", () => ({
  toolOpenCode: {
    execute: toolOpenCodeExecuteMock,
  },
}));

mock.module("@alfred/agent/orchestrator/tool/droid", () => ({
  toolDroid: {
    execute: toolDroidExecuteMock,
  },
}));

mock.module("@alfred/agent/agentfs/learning-bridge", () => ({
  processForLearning: processForLearningMock,
}));

mock.module("../src/orchestrator/execplan", () => ({
  appendDecisionEntry: vi.fn().mockResolvedValue(),
  appendPlanProgressEntry: vi.fn().mockResolvedValue(),
}));

const { runAgent } = await import("../src/orchestrator/agent");

function makeAgentfsWorkspace(args: {
  kvGet: (key: string) => Promise<unknown>;
  root: string;
}): {
  __isAgentfs: true;
  branch: string;
  dbPath: string;
  getAgent: () => { kv: { get: <T>(key: string) => Promise<T | undefined> } };
  initialize: () => Promise<void>;
  restore: () => Promise<void>;
  checkpoint: () => Promise<void>;
  root: string;
} {
  return {
    __isAgentfs: true,
    branch: "test",
    checkpoint: async () => {},
    dbPath: ".agentfs/test/agentfs.db",
    getAgent: () => ({
      kv: {
        get: async <T>(key: string) => (await args.kvGet(key)) as T | undefined,
      },
    }),
    initialize: async () => {},
    restore: async () => {},
    root: args.root,
  };
}

describe("runtime executor config precedence", () => {
  const originalDbUrl = process.env.DATABASE_URL;
  const originalTransport = process.env.ORCH_OPENCODE_TRANSPORT;

  let dir: string;

  beforeEach(async () => {
    toolCodexExecuteMock.mockReset();
    toolOpenCodeExecuteMock.mockReset();
    toolDroidExecuteMock.mockReset();
    workspaceCreateMock.mockReset();
    processForLearningMock.mockClear();

    process.env.DATABASE_URL = "sqlite://test";
    process.env.ORCH_OPENCODE_TRANSPORT = undefined;

    dir = await mkdtemp(path.join(os.tmpdir(), "alfred-runtime-executor-"));
    await writeFile(path.join(dir, "root.md"), "root", "utf8");
  });

  afterEach(async () => {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    process.env.DATABASE_URL = originalDbUrl;
    process.env.ORCH_OPENCODE_TRANSPORT = originalTransport;
  });

  it("passes opencode http config + secret password to tool input", async () => {
    const kv = new Map<string, unknown>([
      [
        "executor:opencode:config",
        {
          http: {
            baseUrl: "http://127.0.0.1:4096",
            passwordSet: true,
            username: "alfred",
          },
          kind: "opencode",
          transport: "http",
          v: 1,
        },
      ],
      [
        "executor:opencode:secrets",
        {
          http: { password: "secret" },
          kind: "opencode",
          v: 1,
        },
      ],
    ]);
    const kvGet = vi.fn(async (key: string) => kv.get(key));

    workspaceCreateMock.mockResolvedValue(
      makeAgentfsWorkspace({ kvGet, root: dir })
    );
    toolOpenCodeExecuteMock.mockResolvedValue();

    const queue = new AsyncQueue<WorkflowEvent>();
    const trackerContextRef = {
      current: { state: { agents: {} } } as unknown,
    };

    await runAgent({
      activeWorkspaces: [],
      agentFileHints: new Map(),
      authz: "authz",
      phaseId: "p1",
      projectConfig: null,
      queue,
      rootExecPlanPath: path.join(dir, "root.md"),
      runId: "run-1",
      signal: new AbortController().signal,
      spec: {
        agentId: "agent-1",
        agentType: "opencode",
        auto: "low",
        context: {},
        environment: "agentfs",
        execPlanPath: "plans/a.md",
        mandateTDD: false,
        model: "gpt-4.1-mini",
        profile: "default",
        sessionId: "s1",
        subTaskId: "t1",
        workingDirectory: dir,
      } as unknown,
      subTaskById: new Map([
        [
          "t1",
          {
            acceptance: [],
            filesHint: [],
            requirement: "do thing",
            title: "thing",
          } as unknown,
        ],
      ]),
      trackerContextRef: trackerContextRef as unknown,
      userId: undefined,
      workspace: dir,
      workspaceRoot: dir,
    });

    expect(toolOpenCodeExecuteMock).toHaveBeenCalledTimes(1);
    const call = toolOpenCodeExecuteMock.mock.calls[0]?.[0] as
      | { input?: Record<string, unknown> }
      | undefined;
    expect(call?.input).toMatchObject({
      action: "exec",
      baseUrl: "http://127.0.0.1:4096",
      password: "secret",
      transport: "http",
      username: "alfred",
    });
    expect(kvGet).toHaveBeenCalledWith("executor:opencode:config");
    expect(kvGet).toHaveBeenCalledWith("executor:opencode:secrets");
  });

  it("does not read secrets when passwordSet is false", async () => {
    const kv = new Map<string, unknown>([
      [
        "executor:opencode:config",
        {
          http: {
            baseUrl: "http://127.0.0.1:4096",
            passwordSet: false,
            username: "alfred",
          },
          kind: "opencode",
          transport: "http",
          v: 1,
        },
      ],
      [
        "executor:opencode:secrets",
        {
          http: { password: "secret" },
          kind: "opencode",
          v: 1,
        },
      ],
    ]);
    const kvGet = vi.fn(async (key: string) => kv.get(key));

    workspaceCreateMock.mockResolvedValue(
      makeAgentfsWorkspace({ kvGet, root: dir })
    );
    toolOpenCodeExecuteMock.mockResolvedValue();

    const queue = new AsyncQueue<WorkflowEvent>();
    const trackerContextRef = {
      current: { state: { agents: {} } } as unknown,
    };

    await runAgent({
      activeWorkspaces: [],
      agentFileHints: new Map(),
      authz: "authz",
      phaseId: "p1",
      projectConfig: null,
      queue,
      rootExecPlanPath: path.join(dir, "root.md"),
      runId: "run-1",
      signal: new AbortController().signal,
      spec: {
        agentId: "agent-1",
        agentType: "opencode",
        auto: "low",
        context: {},
        environment: "agentfs",
        execPlanPath: "plans/a.md",
        mandateTDD: false,
        model: "gpt-4.1-mini",
        profile: "default",
        sessionId: "s1",
        subTaskId: "t1",
        workingDirectory: dir,
      } as unknown,
      subTaskById: new Map([
        [
          "t1",
          {
            acceptance: [],
            filesHint: [],
            requirement: "do thing",
            title: "thing",
          } as unknown,
        ],
      ]),
      trackerContextRef: trackerContextRef as unknown,
      userId: undefined,
      workspace: dir,
      workspaceRoot: dir,
    });

    expect(toolOpenCodeExecuteMock).toHaveBeenCalledTimes(1);
    const call = toolOpenCodeExecuteMock.mock.calls[0]?.[0] as
      | { input?: Record<string, unknown> }
      | undefined;
    expect(call?.input).toMatchObject({
      action: "exec",
      baseUrl: "http://127.0.0.1:4096",
      transport: "http",
      username: "alfred",
    });
    expect((call?.input ?? {}).password).toBeUndefined();
    expect(kvGet).toHaveBeenCalledWith("executor:opencode:config");
    expect(kvGet).not.toHaveBeenCalledWith("executor:opencode:secrets");
  });

  it("uses ORCH_OPENCODE_TRANSPORT when no config is stored", async () => {
    process.env.ORCH_OPENCODE_TRANSPORT = "acp";

    const kvGet = vi.fn(async () => {});
    workspaceCreateMock.mockResolvedValue(
      makeAgentfsWorkspace({ kvGet, root: dir })
    );
    toolOpenCodeExecuteMock.mockResolvedValue();

    const queue = new AsyncQueue<WorkflowEvent>();
    const trackerContextRef = {
      current: { state: { agents: {} } } as unknown,
    };

    await runAgent({
      activeWorkspaces: [],
      agentFileHints: new Map(),
      authz: "authz",
      phaseId: "p1",
      projectConfig: null,
      queue,
      rootExecPlanPath: path.join(dir, "root.md"),
      runId: "run-1",
      signal: new AbortController().signal,
      spec: {
        agentId: "agent-1",
        agentType: "opencode",
        auto: "low",
        context: {},
        environment: "agentfs",
        execPlanPath: "plans/a.md",
        mandateTDD: false,
        model: "gpt-4.1-mini",
        profile: "default",
        sessionId: "s1",
        subTaskId: "t1",
        workingDirectory: dir,
      } as unknown,
      subTaskById: new Map([
        [
          "t1",
          {
            acceptance: [],
            filesHint: [],
            requirement: "do thing",
            title: "thing",
          } as unknown,
        ],
      ]),
      trackerContextRef: trackerContextRef as unknown,
      userId: undefined,
      workspace: dir,
      workspaceRoot: dir,
    });

    expect(toolOpenCodeExecuteMock).toHaveBeenCalledTimes(1);
    const call = toolOpenCodeExecuteMock.mock.calls[0]?.[0] as
      | { input?: Record<string, unknown> }
      | undefined;
    expect(call?.input).toMatchObject({
      action: "exec",
      transport: "acp",
    });
    expect((call?.input ?? {}).baseUrl).toBeUndefined();
  });

  it("passes codex profile + timeout from AgentFS config", async () => {
    const kv = new Map<string, unknown>([
      [
        "executor:codex:config",
        {
          kind: "codex",
          profile: "myprofile",
          timeoutSec: 120,
          v: 1,
        },
      ],
    ]);
    const kvGet = vi.fn(async (key: string) => kv.get(key));

    workspaceCreateMock.mockResolvedValue(
      makeAgentfsWorkspace({ kvGet, root: dir })
    );
    toolCodexExecuteMock.mockResolvedValue();

    const queue = new AsyncQueue<WorkflowEvent>();
    const trackerContextRef = {
      current: { state: { agents: {} } } as unknown,
    };

    await runAgent({
      activeWorkspaces: [],
      agentFileHints: new Map(),
      authz: "authz",
      phaseId: "p1",
      projectConfig: null,
      queue,
      rootExecPlanPath: path.join(dir, "root.md"),
      runId: "run-1",
      signal: new AbortController().signal,
      spec: {
        agentId: "agent-1",
        agentType: "codex",
        auto: "low",
        context: {},
        environment: "agentfs",
        execPlanPath: "plans/a.md",
        mandateTDD: false,
        model: "gpt-4.1-mini",
        sessionId: "s1",
        subTaskId: "t1",
        workingDirectory: dir,
      } as unknown,
      subTaskById: new Map([
        [
          "t1",
          {
            acceptance: [],
            filesHint: [],
            requirement: "do thing",
            title: "thing",
          } as unknown,
        ],
      ]),
      trackerContextRef: trackerContextRef as unknown,
      userId: undefined,
      workspace: dir,
      workspaceRoot: dir,
    });

    expect(toolCodexExecuteMock).toHaveBeenCalledTimes(1);
    const call = toolCodexExecuteMock.mock.calls[0]?.[0] as
      | { input?: Record<string, unknown> }
      | undefined;
    expect(call?.input).toMatchObject({
      action: "exec",
      profile: "myprofile",
      timeoutSec: 120,
    });
  });
});
