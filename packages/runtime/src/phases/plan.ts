import { persistExecPlans } from "@alfred/agent/assistant/graphstore";
import { decomposeTask } from "@alfred/agent/orchestrator/multi/decompose";
import { generateSubtaskExecPlanSkeleton } from "@alfred/agent/orchestrator/multi/execplan";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import { ContextBuilder } from "../context";
import type { RuntimeInput } from "../types";

export async function* executePlanPhase(
  input: RuntimeInput,
  runId: string,
  signal: AbortSignal
): AsyncGenerator<WorkflowEvent, void, void> {
  yield { type: "notice", message: "planning_started" } as WorkflowEvent;

  if (signal.aborted) {
    throw new DOMException("Phase aborted", "AbortError");
  }

  const builder = new ContextBuilder();
  const workspace = input.workspace ?? process.cwd();

  const context = await builder.build({
    requirement: input.requirement,
    workspace,
    repoBase: input.repoBase,
    web: input.context?.web,
    topK: input.context?.topK,
    maxTokens: input.context?.maxTokens,
    exts: input.context?.exts,
    ignore: input.context?.ignore,
    seeds: input.context?.seeds,
    authz: undefined,
  });

  const subTasks = decomposeTask(input.requirement, {
    requirement: input.requirement,
    bundle: context.bundle,
  });

  yield {
    type: "context",
    phase: "plan",
    message: "subtasks_decomposed",
  } as any;
  yield { type: "event", kind: "data-subtasks", data: subTasks } as any;

  const rootPlanTitle = `Multi-agent workflow for run ${runId}`;
  const rootPlan = [
    `# ${rootPlanTitle}`,
    "",
    "This ExecPlan is a living document for the overall multi-agent workflow.",
    "",
    "See .agent/PLANS.md for methodology requirements.",
    "",
    "## Progress",
    "",
    "- [ ] (pending) Workflow initialised.",
    "",
    "## Surprises & Discoveries",
    "",
    "- Pending.",
    "",
    "## Decision Log",
    "",
    "- Pending.",
    "",
    "## Outcomes & Retrospective",
    "",
    "- Pending.",
    "",
  ].join("\n");

  const execplanRootPath = `.agent/plans/${runId}.root.md`;

  const execplanPayload = {
    type: "event",
    kind: "execplan-root-created",
    data: {
      runId,
      path: execplanRootPath,
      content: rootPlan,
      subtasks: subTasks.map((task) => ({
        id: task.id,
        path: `.agent/plans/${runId}/${task.id}.md`,
        skeleton: generateSubtaskExecPlanSkeleton(task, runId),
      })),
    },
  } as any;

  yield execplanPayload;

  // Surface trimmed context details for provenance and UX
  const bundleFiles =
    Array.isArray(context.bundle?.files) && context.bundle.files.length > 0
      ? context.bundle.files.slice(0, 10).map((file) => ({
          path: file.path,
          startLine: file.startLine,
          endLine: file.endLine,
        }))
      : [];

  yield {
    type: "event",
    kind: "runtime-context",
    data: {
      ragDocumentIds: context.ragDocumentIds ?? [],
      totalTokens: context.totalTokens,
      bundleFileCount: context.bundle?.files.length ?? 0,
      bundlePreview: bundleFiles,
    },
  } as any;

  // Best-effort ExecPlan graph persistence; failures are logged but non-fatal.
  try {
    await persistExecPlans({
      resource: workspace,
      runId,
      rootPath: execplanRootPath,
      subtasks: subTasks.map((task) => ({
        id: task.id,
        path: `.agent/plans/${runId}/${task.id}.md`,
      })),
    });
  } catch (error) {
    logger.warn("execplan_graph_persist_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  yield { type: "notice", message: "planning_completed" } as any;
}
