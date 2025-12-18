import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import type { OrchestratorContext } from "@alfred/runtime/src/orchestrator/types";
import { withWorkflowRuntime } from "@alfred/test-kit/workflow/runtime-fixture";
import type { ContextBundle, WorkflowEvent } from "@alfred/type/plan";

const agentScripts = new Map<string, WriterChunk[]>();

mock.module("@alfred/agent/environment/factory", () => ({
  WorkspaceFactory: {
    create: async (
      _env: string,
      agentId: string,
      runId: string,
      workspace: string
    ) => ({
      id: `${runId}-${agentId}`,
      root: workspace,
      initialize: async () => {},
      cleanup: async () => {},
      checkpoint: async () => {},
      restore: async () => {},
    }),
  },
}));

mock.module("@alfred/agent/orchestrator/tool/codex/index", () => ({
  toolCodex: {
    execute: async ({ input, writer }: { input: { sessionId: string } }) => {
      const script = agentScripts.get(input.sessionId) ?? defaultScript();
      for (const chunk of script) {
        await writer.write(chunk);
      }
    },
  },
}));

const mergeExecutorMock = mock(() =>
  Promise.resolve({
    status: "completed" as const,
    mergedBranches: ["agent/run"],
    targetBranch: "main",
  })
);

mock.module("@alfred/agent/orchestrator/multi/merge-executor", () => ({
  executeMergePlan: mergeExecutorMock,
}));

const toolRunnerExecute = mock(() =>
  Promise.resolve({
    stdout: "ok",
    stderr: "",
    exitCode: 0,
    durationMs: 10,
  })
);

mock.module("@alfred/agent/orchestrator/tool/runner", () => ({
  toolRunner: {
    execute: toolRunnerExecute,
  },
}));

const smokeVerifyMock = mock(() =>
  Promise.resolve({
    success: true,
    message: "ok",
  })
);

mock.module("@alfred/agent/orchestrator/verification/smoke", () => ({
  smokeTester: {
    verify: smokeVerifyMock,
  },
}));

const { runWaves } = await import("../../runtime/src/orchestrator/waves.ts");
const { runMergePhase, runMergeAnalysis } = await import(
  "../../runtime/src/orchestrator/merge.ts"
);
const { runReviewPhase } = await import(
  "../../runtime/src/orchestrator/review.ts"
);
const { decomposeTask } = await import(
  "@alfred/agent/orchestrator/multi/decompose"
);

type AgentEventDef =
  | { kind: "thought"; text: string }
  | {
      kind: "command";
      command: string;
      status?: "running" | "completed" | "failed";
    }
  | { kind: "artifact"; path: string };

type WriterChunk = {
  type: "stdout";
  event: {
    type: "thought" | "command" | "artifact";
    content?: string;
    command?: string;
    status?: string;
    path?: string;
    kind?: string;
    timestamp: number;
  };
};

const tempDirs: string[] = [];

beforeEach(() => {
  agentScripts.clear();
  mergeExecutorMock.mockClear();
  toolRunnerExecute.mockClear();
  smokeVerifyMock.mockClear();
});

afterEach(async () => {
  agentScripts.clear();
  const dirs = tempDirs.splice(0, tempDirs.length);
  await Promise.all(
    dirs.map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("multi-agent orchestrator integration", () => {
  it("executes a single wave and persists exec plans", async () => {
    await withWorkflowRuntime(async () => {
      const workspace = await createWorkspace();
      const requirement = "Address CLI bug";
      const bundle = makeBundle([]);
      const previewTasks = tasksFor(bundle, requirement);

      const { events, result, runId, tasks } = await runScenario({
        requirement,
        workspace,
        bundle,
        scripts: {
          [previewTasks[0]?.id ?? ""]: [
            { kind: "thought", text: "starting" },
            { kind: "command", command: "bun test", status: "completed" },
            { kind: "artifact", path: "src/cli.ts" },
          ],
        },
      });

      expect(events.some((evt) => evt.kind === "wave-result")).toBe(true);
      expect(result.aborted).toBe(false);
      expect(result.allAgentOutcomes).toHaveLength(1);
      expect(
        result.agentFileHints.get(`${runId}:${tasks[0]?.id}`)?.has("src/cli.ts")
      ).toBe(true);

      const rootPlan = resolve(workspace, `.agent/plans/${runId}.root.md`);
      const subPlan = resolve(
        workspace,
        `.agent/plans/${runId}/${tasks[0]?.id}.md`
      );
      const rootContent = await readFile(rootPlan, "utf8");
      expect(rootContent).toContain("Wave wave_0 started");
      await readFile(subPlan, "utf8");
    });
  });

  it("runs multiple waves respecting dependencies", async () => {
    await withWorkflowRuntime(async () => {
      const workspace = await createWorkspace();
      const requirement = "Ship full stack flow";
      const bundle = makeBundle([
        "packages/api/src/router.ts",
        "packages/api/src/router.test.ts",
        "apps/web/src/app/page.tsx",
      ]);

      const initialTasks = tasksFor(bundle, requirement);
      const scripts: Record<string, AgentEventDef[]> = {};
      for (const task of initialTasks) {
        scripts[task.id] = [
          { kind: "thought", text: task.title },
          { kind: "command", command: "bun fmt", status: "completed" },
          { kind: "artifact", path: `${task.id}.ts` },
        ];
      }

      const { events, result } = await runScenario({
        requirement,
        workspace,
        bundle,
        scripts,
      });

      const wavePlanEvents = events.filter(
        (evt) => evt.kind === "data-wave-plan"
      );
      expect(wavePlanEvents.length).toBeGreaterThan(1);
      expect(
        events.some(
          (evt) => evt.type === "notice" && evt.message === "wave_wave_1_start"
        )
      ).toBe(true);
      expect(result.trackerState.waves).toMatchObject({
        wave_0: { status: "completed" },
        wave_1: { status: "completed" },
      });
    });
  });

  it("executes merge and review phases end-to-end", async () => {
    await withWorkflowRuntime(async () => {
      const prevTarget = process.env.ORCH_TARGET_BRANCH;
      process.env.ORCH_TARGET_BRANCH = "main";
      try {
        const workspace = await createWorkspace();
        const requirement = "Validate merge and review";
        const bundle = makeBundle([
          "packages/runtime/src/orchestrator/waves.ts",
          "packages/runtime/src/orchestrator/merge.ts",
          "apps/web/src/app/page.tsx",
        ]);

        const initialTasks = tasksFor(bundle, requirement);
        const scripts: Record<string, AgentEventDef[]> = {};
        for (const task of initialTasks) {
          scripts[task.id] = [
            { kind: "thought", text: task.title },
            { kind: "command", command: "bun fmt", status: "completed" },
            { kind: "artifact", path: `${task.id}/result.ts` },
          ];
        }

        const scenario = await runScenario({
          requirement,
          workspace,
          bundle,
          scripts,
          auto: "low",
        });

        await materializeAgentFiles(workspace, scenario.result.agentFileHints);

        const mergeDrain = await drainGenerator(
          runMergePhase(scenario.ctx, scenario.result)
        );
        expect(mergeDrain.value.mergePlan.expectedFiles.length).toBeGreaterThan(
          0
        );

        await drainGenerator(
          runMergeAnalysis(scenario.ctx, mergeDrain.value.mergePlan)
        );
        const mergePlanPath = resolve(
          `.agent/plans/${scenario.runId}/merge.md`
        );
        const mergePlanContent = await readFile(mergePlanPath, "utf8");
        expect(mergePlanContent).toContain("# Merge ExecPlan");

        const reviewDir = resolve(`.agent/plans/${scenario.runId}`);
        await mkdir(reviewDir, { recursive: true });
        const reviewSeedPath = join(reviewDir, "review.md");
        await writeFile(
          reviewSeedPath,
          [
            "# Seed Review Plan",
            "",
            "## Progress",
            "",
            "## Outcomes & Retrospective",
            "",
          ].join("\n")
        );

        try {
          await drainGenerator(
            runReviewPhase(scenario.ctx, mergeDrain.value.mergePlan)
          );
          const reviewPlanPath = resolve(
            `.agent/plans/${scenario.runId}/review.md`
          );
          const reviewContent = await readFile(reviewPlanPath, "utf8");
          expect(reviewContent.length).toBeGreaterThan(0);
        } finally {
          await rm(reviewDir, {
            recursive: true,
            force: true,
          });
        }
      } finally {
        if (prevTarget === undefined) {
          process.env.ORCH_TARGET_BRANCH = undefined;
        } else {
          process.env.ORCH_TARGET_BRANCH = prevTarget;
        }
      }
    });
  });

  it("aborts when stuck agents exceed thresholds", async () => {
    await withWorkflowRuntime(async () => {
      const workspace = await createWorkspace();
      const requirement = "Stress test stuck detection";
      const bundle = makeBundle([
        "packages/api/src/router.ts",
        "apps/web/src/app/page.tsx",
      ]);

      const initialTasks = tasksFor(bundle, requirement);
      const stuckScript: AgentEventDef[] = Array.from({ length: 6 }, () => ({
        kind: "command",
        command: "bun test",
        status: "running",
      }));
      const scripts: Record<string, AgentEventDef[]> = {};
      for (const task of initialTasks) {
        scripts[task.id] = stuckScript;
      }

      const { events, result } = await runScenario({
        requirement,
        workspace,
        bundle,
        scripts,
      });

      expect(result.aborted).toBe(true);
      expect(events.some((evt) => evt.kind === "wave-aborted")).toBe(true);
    });
  });
});

function defaultScript(): WriterChunk[] {
  return toChunks([
    { kind: "thought", text: "idle" },
    { kind: "command", command: "echo done", status: "completed" },
  ]);
}

function makeBundle(paths: string[]): ContextBundle {
  return {
    maxTokens: 2000,
    estimatedTokens: 200,
    files: paths.map((path) => ({
      path,
      startLine: 1,
      endLine: 50,
      tokens: 10,
      content: undefined,
    })),
    links: undefined,
    note: "integration",
  };
}

function toChunks(defs: AgentEventDef[]): WriterChunk[] {
  return defs.map((def, index) => {
    if (def.kind === "thought") {
      return {
        type: "stdout",
        event: {
          type: "thought",
          content: def.text,
          timestamp: Date.now() + index,
        },
      };
    }
    if (def.kind === "command") {
      return {
        type: "stdout",
        event: {
          type: "command",
          command: def.command,
          status: def.status ?? "running",
          timestamp: Date.now() + index,
        },
      };
    }
    return {
      type: "stdout",
      event: {
        type: "artifact",
        path: def.path,
        kind: "file",
        timestamp: Date.now() + index,
      },
    };
  });
}

function registerScripts(
  runId: string,
  subTasks: SubTask[],
  scripts: Record<string, AgentEventDef[]>
) {
  agentScripts.clear();
  for (const task of subTasks) {
    const defs = scripts[task.id];
    agentScripts.set(
      `${runId}:${task.id}`,
      defs ? toChunks(defs) : defaultScript()
    );
  }
}

function tasksFor(bundle: ContextBundle, requirement: string): SubTask[] {
  return decomposeTask(requirement, { requirement, bundle });
}

async function runScenario(options: {
  requirement: string;
  workspace: string;
  bundle: ContextBundle;
  scripts: Record<string, AgentEventDef[]>;
  auto?: "read" | "low" | "medium" | "high";
}) {
  const runId = randomUUID();
  const tasks = tasksFor(options.bundle, options.requirement);
  registerScripts(runId, tasks, options.scripts);

  const ctx: OrchestratorContext = {
    input: {
      requirement: options.requirement,
      auto: options.auto ?? "low",
      workspace: options.workspace,
    },
    runId,
    signal: new AbortController().signal,
    workspace: options.workspace,
    scanContext: {
      requirement: options.requirement,
      receipts: { created: new Date() } as any,
      bundle: options.bundle,
      totalTokens: 0,
    },
  };

  const events: WorkflowEvent[] = [];
  const iterator = runWaves(ctx);
  let result;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = await iterator.next();
    if (next.done) {
      result = next.value;
      break;
    }
    events.push(next.value as WorkflowEvent);
  }

  return { events, result, runId, tasks, ctx };
}

async function drainGenerator<T>(
  generator: AsyncGenerator<WorkflowEvent, T, void>
): Promise<{ events: WorkflowEvent[]; value: T }> {
  const events: WorkflowEvent[] = [];
  while (true) {
    const next = await generator.next();
    if (next.done) {
      return { events, value: next.value };
    }
    events.push(next.value as WorkflowEvent);
  }
}

async function materializeAgentFiles(
  workspace: string,
  agentFileHints: Map<string, Set<string>>
) {
  for (const files of agentFileHints.values()) {
    for (const file of files) {
      const fullPath = resolve(workspace, file);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, "// stub");
    }
  }
}

async function createWorkspace() {
  const dir = await mkdtemp(join(tmpdir(), "multi-agent-"));
  tempDirs.push(dir);
  return dir;
}
