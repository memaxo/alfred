import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { WorkflowEvent } from "@alfred/type/plan";
import { ContextBuilder } from "../src/context";

const codexExecute = mock(async ({ writer }: { writer: any }) => {
  await writer.write({
    type: "stdout",
    event: {
      type: "thought",
      content: "starting",
      timestamp: Date.now(),
    },
  });
  await writer.write({
    type: "stdout",
    event: {
      type: "artifact",
      path: "src/task.ts",
      kind: "file",
      timestamp: Date.now(),
    },
  });
});

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
    cleanup: async () => {},
    checkpoint: async () => {},
    restore: async () => {},
  })
);

mock.module("@alfred/agent/orchestrator/tool/codex/index", () => ({
  toolCodex: {
    execute: codexExecute,
  },
}));

mock.module("@alfred/agent/environment/factory", () => ({
  WorkspaceFactory: {
    create: workspaceFactoryCreate,
  },
}));

mock.module("@alfred/agent/orchestrator/multi/decompose", () => ({
  decomposeTask: () => [
    {
      id: "task-main",
      title: "Main Task",
      requirement: "Fix issue",
      deps: [],
      priority: 1,
      acceptance: ["Tests passing"],
      filesHint: ["src"],
    },
  ],
}));

mock.module("@alfred/agent/orchestrator/multi/spawn", () => ({
  planWaves: () => [{ id: "wave_0", agents: ["task-main"], dependsOn: [] }],
  buildAgentSpec: () => ({
    agentId: "run-1:task-main",
    subTaskId: "task-main",
    sessionId: "run-1:task-main",
    workingDirectory: "",
    environment: "worktree",
    auto: "low",
    execPlanPath: ".agent/plans/run-1/task-main.md",
    context: { relevantFiles: ["src/task.ts"] },
  }),
}));

mock.module("@alfred/agent/orchestrator/tool/worktree", () => ({
  worktreeManager: {
    safeMerge: async () => ({ success: true, conflictFiles: [] }),
    cleanup: async () => {},
  },
}));

const { runWaves } = await import("../src/orchestrator/waves");

const originalExecutionContextBuild = ContextBuilder.prototype.build;
ContextBuilder.prototype.build = async () =>
  ({
    bundle: null,
    receipts: {},
    totalTokens: 0,
  }) as any;

const tempDirs: string[] = [];

afterEach(async () => {
  codexExecute.mockReset();
  workspaceFactoryCreate.mockReset();
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

afterAll(() => {
  ContextBuilder.prototype.build = originalExecutionContextBuild;
  mock.restore();
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
    const prompt = (codexExecute.mock.calls[0]?.[0]?.input?.prompt ??
      "") as string;
    expect(prompt).toContain(".agent/plans/run-1/task-main.md");
    const hints = result.agentFileHints as Map<string, Set<string>>;
    expect(hints.get("run-1:task-main")?.has("src/task.ts")).toBe(true);
    expect(
      events.some(
        (event) =>
          (event as any).kind === "wave-result" &&
          (event as any).data?.waveId === "wave_0"
      )
    ).toBe(true);

    const planPath = path.join(workspace, ".agent/plans/run-1/task-main.md");
    const planContent = await readFile(planPath, "utf8");
    expect(planContent).toContain("ExecPlan");
  });
});
