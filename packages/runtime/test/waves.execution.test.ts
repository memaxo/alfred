import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import { subtaskPlanPath } from "@alfred/agent/orchestrator/plans";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { worktreeManager } from "@alfred/agent/orchestrator/tool/worktree";
import type { WorkflowEvent } from "@alfred/type/plan";
import { ContextBuilder } from "../src/context";
import { runOrchestrator } from "../src/orchestrator/index";
import { runWaves } from "../src/orchestrator/waves";

const codexExecute = mock(async ({ writer }: { writer: any }) => {
  await writer.write({
    type: "stdout",
    event: { type: "output", content: "first" },
  });
  await writer.write({
    type: "stdout",
    event: { type: "artifact", path: "src/task.ts", kind: "file" },
  });
});

const workspaceCleanup = mock(async () => {});

const workspaceFactoryCreate = mock(
  async (
    _env: string,
    agentId: string,
    _runId: string,
    workspacePath: string
  ) => ({
    id: agentId,
    root: workspacePath,
    branch: `agent/${agentId}`,
    initialize: async () => {},
    cleanup: workspaceCleanup,
    checkpoint: async () => {},
    restore: async () => {},
  })
);

const worktreeSafeMerge = mock(
  async () => ({ success: true, conflictFiles: [] }) as const
);

const originalCodexExecute = toolCodex.execute;
const originalWorkspaceCreate = WorkspaceFactory.create;
const originalWorktreeSafeMerge = worktreeManager.safeMerge;
const originalWorktreeCleanup = worktreeManager.cleanup;

const originalExecutionContextBuild = ContextBuilder.prototype.build;
ContextBuilder.prototype.build = async () =>
  ({
    bundle: null,
    receipts: {},
    totalTokens: 0,
  }) as any;

const tempDirs: string[] = [];

beforeEach(() => {
  toolCodex.execute = codexExecute as any;
  WorkspaceFactory.create = workspaceFactoryCreate as any;
  worktreeManager.safeMerge = worktreeSafeMerge as any;
  worktreeManager.cleanup = async () => {};
});

afterEach(async () => {
  codexExecute.mockReset();
  workspaceFactoryCreate.mockClear();
  workspaceCleanup.mockClear();
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

afterAll(() => {
  ContextBuilder.prototype.build = originalExecutionContextBuild;
  toolCodex.execute = originalCodexExecute;
  WorkspaceFactory.create = originalWorkspaceCreate;
  worktreeManager.safeMerge = originalWorktreeSafeMerge;
  worktreeManager.cleanup = originalWorktreeCleanup;
});

describe("runWaves execution", () => {
  it("streams codex output and writes exec plan progress", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "waves-exec-"));
    tempDirs.push(workspace);

    const ctx = {
      input: { requirement: "Fix issue", auto: "low", workspace },
      runId: "run-1",
      signal: new AbortController().signal,
      workspace,
    } as any;

    const iterator = runWaves(ctx);
    const events: WorkflowEvent[] = [];
    let result: any;
    // Drain generator manually to capture return value
    while (true) {
      const next = await iterator.next();
      if (next.done) {
        result = next.value;
        break;
      }
      events.push(next.value as WorkflowEvent);
    }

    expect(result.aborted).toBe(false);
    expect(codexExecute).toHaveBeenCalledTimes(1);
    expect(worktreeSafeMerge).toHaveBeenCalledTimes(0);
    const prompt = (codexExecute.mock.calls[0]?.[0]?.input?.prompt ??
      "") as string;
    const [outcome] =
      (result.allAgentOutcomes as Array<{ agentId: string }>) ?? [];
    expect(outcome).toBeTruthy();
    const subTaskId = outcome.agentId.split(":")[1];
    expect(subTaskId).toBeTruthy();
    expect(prompt).toContain(subtaskPlanPath(workspace, "run-1", subTaskId));
    const hints = result.agentFileHints as Map<string, Set<string>>;
    expect(hints.get(outcome.agentId)?.has("src/task.ts")).toBe(true);
    expect(
      events.some(
        (event) =>
          (event as any).kind === "wave-result" &&
          (event as any).data?.waveId === "wave_0"
      )
    ).toBe(true);

    const planPath = path.resolve(
      workspace,
      subtaskPlanPath(workspace, "run-1", subTaskId)
    );
    const planContent = await readFile(planPath, "utf8");
    expect(planContent).toContain("ExecPlan");
  });

  it("executes multiple agents concurrently within a wave", async () => {
    const prev = process.env.ORCHESTRATOR_MAX_PARALLEL;
    process.env.ORCHESTRATOR_MAX_PARALLEL = "2";
    const controller = new AbortController();

    try {
      let started = 0;
      let resolveBothStarted: (() => void) | null = null;
      const bothStarted = new Promise<void>((resolve) => {
        resolveBothStarted = resolve;
      });

      const abortPromise = (signal: AbortSignal | undefined) =>
        new Promise<never>((_resolve, reject) => {
          if (!signal) {
            return;
          }
          if (signal.aborted) {
            reject(new Error("aborted"));
            return;
          }
          signal.addEventListener(
            "abort",
            () => {
              reject(new Error("aborted"));
            },
            { once: true }
          );
        });

      codexExecute.mockImplementation(
        async ({ writer, signal }: { writer: any; signal?: AbortSignal }) => {
          started += 1;
          if (started === 2) {
            resolveBothStarted?.();
          }
          await Promise.race([bothStarted, abortPromise(signal)]);
          await writer.write({
            type: "stdout",
            event: { type: "output", content: "parallel" },
          });
        }
      );

      const workspace = await mkdtemp(path.join(tmpdir(), "waves-par-"));
      tempDirs.push(workspace);

      const requirement = "Parallel wave test";
      const ctx = {
        input: { requirement, auto: "low", workspace },
        runId: "run-par",
        signal: controller.signal,
        workspace,
        scanContext: {
          requirement,
          receipts: {},
          bundle: {
            maxTokens: 2000,
            estimatedTokens: 0,
            files: [
              {
                path: "packages/api/src/router.ts",
                startLine: 1,
                endLine: 10,
                tokens: 10,
                content: "export const api = 1;",
              },
              {
                path: "apps/web/src/app.tsx",
                startLine: 1,
                endLine: 10,
                tokens: 10,
                content: "export const web = 2;",
              },
            ],
            links: undefined,
            note: "integration",
          },
          totalTokens: 0,
        },
      } as any;

      const iterator = runWaves(ctx);
      const drain = (async () => {
        while (true) {
          const next = await iterator.next();
          if (next.done) {
            return next.value;
          }
        }
      })();

      try {
        await Promise.race([
          bothStarted,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("expected_concurrent_agents")),
              500
            )
          ),
        ]);
      } catch (error) {
        controller.abort();
        await drain.catch(() => {});
        throw error;
      }

      expect(started).toBe(2);
      expect(worktreeSafeMerge).toHaveBeenCalledTimes(0);
      await drain;
    } finally {
      controller.abort();
      if (prev === undefined) {
        process.env.ORCHESTRATOR_MAX_PARALLEL = undefined;
      } else {
        process.env.ORCHESTRATOR_MAX_PARALLEL = prev;
      }
    }
  }, 5000);

  it("propagates abort to agents and cleans up workspaces", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "waves-abort-"));
    tempDirs.push(workspace);

    const controller = new AbortController();
    let resolveStarted: (() => void) | null = null;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });

    codexExecute.mockImplementation(
      async ({ signal }: { signal?: AbortSignal }) => {
        resolveStarted?.();
        await new Promise<void>((_resolve, reject) => {
          if (!signal) {
            reject(new Error("missing abort signal"));
            return;
          }
          if (signal.aborted) {
            reject(new DOMException("aborted", "AbortError"));
            return;
          }
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true }
          );
        });
      }
    );

    const generator = runOrchestrator(
      { requirement: "Abort test", auto: "low", workspace },
      "run-abort",
      controller.signal
    );

    const events: WorkflowEvent[] = [];
    const drain = (async () => {
      for await (const event of generator) {
        events.push(event);
      }
    })();

    await Promise.race([
      started,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("agent_never_started")), 1000)
      ),
    ]);

    controller.abort();

    await Promise.race([
      drain,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("abort_test_timeout")), 3000)
      ),
    ]);

    expect(workspaceCleanup).toHaveBeenCalled();
    expect(
      events.some(
        (e) => e._ === "notice" && (e as any).message === "workflow_interrupted"
      )
    ).toBe(true);
  });
});
