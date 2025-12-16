import * as fs from "node:fs/promises";
import * as path from "node:path";
import { persistExecPlans } from "@alfred/agent/assistant/graphstore";
import { decomposeTask } from "@alfred/agent/orchestrator/multi/decompose";
import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import { generateSubtaskExecPlanSkeleton } from "@alfred/agent/orchestrator/multi/execplan";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { UIMessage } from "@alfred/type/stream";
import type { LanguageModel } from "ai";
import { AISDKAdapter } from "../adapters/ai";
import type { ExecutionContext } from "../context";
import { ContextBuilder } from "../context";
import type { RuntimeInput } from "../types";

async function ensureExecPlanFile(filePath: string, content: string) {
  try {
    await fs.access(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
  }
}

const PLAN_SYSTEM_PROMPT = [
  "You are Alfred's orchestration planner.",
  "Break the requirement into concrete, auditable steps that downstream agents can execute.",
  "Reference repository paths and acceptance criteria precisely.",
  "Prefer deterministic work sequences (scan → modify → test → review).",
  "List risks, unknowns, and required tools before execution.",
].join("\n");

const MAX_CONTEXT_FILES = 8;
const MAX_RECEIPTS = 5;

function formatContextPreview(context: ExecutionContext): string {
  const files = context.bundle?.files ?? [];
  const fileLines = files
    .slice(0, MAX_CONTEXT_FILES)
    .map((file) => `- ${file.path}:${file.startLine}-${file.endLine}`);

  const receiptLines = (context.receipts.code ?? [])
    .slice(0, MAX_RECEIPTS)
    .map(
      (item) =>
        `- ${item.path ?? item.id} (score ${(item.score * 100).toFixed(0)}%)`
    );

  const webLines = (context.receipts.web ?? [])
    .slice(0, 3)
    .map((item) => `- ${item.title ?? item.url ?? item.id}`);

  const sections = [] as string[];
  if (fileLines.length > 0) {
    sections.push(["Top Context Files:", ...fileLines].join("\n"));
  }
  if (receiptLines.length > 0) {
    sections.push(["Highest Scoring Matches:", ...receiptLines].join("\n"));
  }
  if (webLines.length > 0) {
    sections.push(["Relevant Web Sources:", ...webLines].join("\n"));
  }

  return sections.join("\n\n");
}

function buildPlanMessages(
  runId: string,
  input: RuntimeInput,
  context: ExecutionContext,
  subTasks: SubTask[]
): UIMessage[] {
  const contextPreview = formatContextPreview(context);
  const subTaskPreview = subTasks
    .slice(0, 6)
    .map((task, index) => `  ${index + 1}. ${task.id}: ${task.requirement}`)
    .join("\n");

  const messageParts = [
    `Requirement:\n${input.requirement}`,
    `Auto Level: ${input.auto}`,
  ];

  if (contextPreview) {
    messageParts.push(contextPreview);
  }

  if (subTasks.length > 0) {
    messageParts.push(`Proposed subtask seeds:\n${subTaskPreview}`);
  }

  const text = messageParts.join("\n\n");
  return [
    {
      id: `user-plan-${runId}-${Date.now().toString(36)}`,
      role: "user",
      parts: [{ type: "text", text }],
    },
  ] satisfies UIMessage[];
}

export async function* executePlanPhase(
  input: RuntimeInput,
  runId: string,
  signal: AbortSignal,
  model: LanguageModel,
  prebuiltContext?: ExecutionContext | null
): AsyncGenerator<WorkflowEvent, string | null, void> {
  yield { type: "notice", message: "planning_started" } as WorkflowEvent;

  if (signal.aborted) {
    throw new DOMException("Phase aborted", "AbortError");
  }

  const workspace = input.workspace ?? process.cwd();

  const reusedContext = Boolean(prebuiltContext);
  const context =
    prebuiltContext ??
    (await new ContextBuilder().build({
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
    }));

  if (reusedContext) {
    yield {
      type: "notice",
      message: "plan_using_cached_context",
    } as WorkflowEvent;
  }

  const subTasks: SubTask[] = decomposeTask(input.requirement, {
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

  // Materialise ExecPlan files on disk for downstream agents.
  const rootPlanAbsolutePath = path.resolve(workspace, execplanRootPath);
  try {
    await ensureExecPlanFile(rootPlanAbsolutePath, rootPlan);
  } catch (error) {
    logger.warn("execplan_root_write_failed", {
      runId,
      path: rootPlanAbsolutePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await Promise.all(
    subTasks.map(async (task) => {
      const relativePath = `.agent/plans/${runId}/${task.id}.md`;
      const absolutePath = path.resolve(workspace, relativePath);
      try {
        await ensureExecPlanFile(
          absolutePath,
          generateSubtaskExecPlanSkeleton(task, runId)
        );
      } catch (error) {
        logger.warn("execplan_subtask_write_failed", {
          runId,
          subTaskId: task.id,
          path: absolutePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })
  );

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

  const aiAdapter = new AISDKAdapter({ runId });
  const planningMessages = buildPlanMessages(runId, input, context, subTasks);
  let planSummary = "";

  try {
    yield { type: "notice", message: "planning_llm_stream_started" } as any;

    for await (const event of aiAdapter.stream({
      model,
      messages: planningMessages,
      abortSignal: signal,
      system: PLAN_SYSTEM_PROMPT,
      temperature: 0.2,
    })) {
      if (
        event.type === "text-delta" &&
        typeof (event as any).delta === "string"
      ) {
        planSummary += (event as any).delta;
      }

      const enriched = {
        ...(event as WorkflowEvent),
        phase: (event as any).phase ?? "plan",
      } as WorkflowEvent;
      yield enriched;
    }
  } catch (error) {
    logger.error("runtime_plan_ai_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });

    yield {
      type: "notice",
      message: "planning_stream_failed",
      error: error instanceof Error ? error.message : String(error),
    } as WorkflowEvent;
    throw error;
  }

  const trimmedPlanSummary = planSummary.trim();
  if (trimmedPlanSummary.length > 0) {
    yield {
      type: "event",
      kind: "plan-summary",
      data: { text: trimmedPlanSummary },
    } as any;
  }

  yield { type: "notice", message: "planning_completed" } as any;
  return trimmedPlanSummary || null;
}
