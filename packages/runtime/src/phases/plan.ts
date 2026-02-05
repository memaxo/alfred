import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { UIMessage } from "@alfred/type/stream";
import type { LanguageModel } from "ai";

import { persistExecPlans } from "@alfred/agent/assistant/graphstore";
import { decomposeTask } from "@alfred/agent/orchestrator/multi/decompose";
import { generateSubtaskExecPlanSkeleton } from "@alfred/agent/orchestrator/multi/execplan";
import {
  rootPlanPath,
  subtaskPlanPath,
} from "@alfred/agent/orchestrator/plans";
import { logger } from "@alfred/logger";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { ExecutionContext } from "../context";
import type { RuntimeInput } from "../types";

import { AISDKAdapter, type AiAdapter } from "../adapters/ai";
import { ContextBuilder } from "../context";

async function ensureExecPlanFile(filePath: string, content: string) {
  try {
    await fs.access(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await Bun.write(filePath, content);
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
  subTasks: SubTask[],
  cognitive?: {
    autonomyLevel?: number;
    physiology?: unknown;
  }
): UIMessage[] {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const isNum = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

  const contextPreview = formatContextPreview(context);
  const subTaskPreview = subTasks
    .slice(0, 6)
    .map((task, index) => `  ${index + 1}. ${task.id}: ${task.requirement}`)
    .join("\n");

  const messageParts = [
    `Requirement:\n${input.requirement}`,
    `Auto Level: ${input.auto}`,
  ];

  if (typeof cognitive?.autonomyLevel === "number") {
    messageParts.push(
      `Cognitive autonomyLevel (0..1): ${cognitive.autonomyLevel.toFixed(2)}`
    );
  }

  const physiology = cognitive?.physiology;
  if (isRecord(physiology)) {
    const { energy } = physiology;
    const { boredom } = physiology;
    const { frustration } = physiology;
    const { entropy } = physiology;

    if (
      isNum(energy) &&
      isNum(boredom) &&
      isNum(frustration) &&
      isNum(entropy)
    ) {
      messageParts.push(
        [
          "Cognitive physiology (0..1):",
          `- energy: ${energy.toFixed(2)}`,
          `- boredom: ${boredom.toFixed(2)}`,
          `- frustration: ${frustration.toFixed(2)}`,
          `- entropy: ${entropy.toFixed(2)}`,
        ].join("\n")
      );
    }
  }

  if (
    typeof cognitive?.autonomyLevel === "number" &&
    cognitive.autonomyLevel < 0.65
  ) {
    messageParts.push(
      [
        "Steering:",
        "- Autonomy is LOW. Prefer conservative, explicit, auditable steps.",
        "- Include review gates and verification steps before risky actions.",
        "- Prefer sequential execution; avoid parallel waves unless required.",
      ].join("\n")
    );
  }

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
  prebuiltContext?: ExecutionContext | null,
  deps?: {
    userId?: string;
    projectId?: string;
    cognitive?: {
      autonomyLevel?: number;
      physiology?: unknown;
    };
    createAiAdapter?: (runId: string) => AiAdapter;
    buildContext?: (args: {
      requirement: string;
      workspace: string;
      repoBase?: string;
      web?: unknown;
      topK?: number;
      maxTokens?: number;
      exts?: string[];
      ignore?: string[];
      seeds?: string[];
      authz?: string;
    }) => Promise<ExecutionContext>;
    decomposeTask?: typeof decomposeTask;
    generateSubtaskExecPlanSkeleton?: typeof generateSubtaskExecPlanSkeleton;
    persistExecPlans?: typeof persistExecPlans;
  }
): AsyncGenerator<WorkflowEvent, string | null, void> {
  yield { _: "notice", message: "planning_started" } as WorkflowEvent;

  if (signal.aborted) {
    throw new DOMException("Phase aborted", "AbortError");
  }

  const userId = deps?.userId;
  const projectId = deps?.projectId;

  const workspace = input.workspace ?? process.cwd();

  const reusedContext = Boolean(prebuiltContext);
  const buildContext =
    deps?.buildContext ??
    ((args) =>
      new ContextBuilder().build(
        args as Parameters<ContextBuilder["build"]>[0]
      ));
  const context =
    prebuiltContext ??
    (await buildContext({
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
      _: "notice",
      message: "plan_using_cached_context",
    } as WorkflowEvent;
  }

  const decompose = deps?.decomposeTask ?? decomposeTask;
  const subTasks: SubTask[] = decompose(input.requirement, {
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

  const execplanRootPath = rootPlanPath(workspace, runId);

  const execplanPayload = {
    type: "event",
    kind: "execplan-root-created",
    data: {
      runId,
      path: execplanRootPath,
      content: rootPlan,
      subtasks: subTasks.map((task) => ({
        id: task.id,
        path: subtaskPlanPath(workspace, runId, task.id),
        skeleton: (
          deps?.generateSubtaskExecPlanSkeleton ??
          generateSubtaskExecPlanSkeleton
        )(task, runId),
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
      const absolutePath = path.resolve(
        workspace,
        subtaskPlanPath(workspace, runId, task.id)
      );
      try {
        await ensureExecPlanFile(
          absolutePath,
          (
            deps?.generateSubtaskExecPlanSkeleton ??
            generateSubtaskExecPlanSkeleton
          )(task, runId)
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
    await (deps?.persistExecPlans ?? persistExecPlans)({
      resource: workspace,
      runId,
      rootPath: execplanRootPath,
      subtasks: subTasks.map((task) => ({
        id: task.id,
        path: subtaskPlanPath(workspace, runId, task.id),
      })),
    });
  } catch (error) {
    logger.warn("execplan_graph_persist_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const createAiAdapter =
    deps?.createAiAdapter ??
    ((id: string) => new AISDKAdapter({ runId: id, userId, projectId }));
  const aiAdapter = createAiAdapter(runId);
  const planningMessages = buildPlanMessages(
    runId,
    input,
    context,
    subTasks,
    deps?.cognitive
  );
  let planSummary = "";

  try {
    yield { _: "notice", message: "planning_llm_stream_started" } as any;

    for await (const event of aiAdapter.stream({
      model,
      messages: planningMessages,
      abortSignal: signal,
      system: PLAN_SYSTEM_PROMPT,
      temperature: 0.2,
    })) {
      const kind =
        (event as { _?: unknown; type?: unknown })._ ?? (event as any).type;
      if (kind === "text-delta" && typeof (event as any).delta === "string") {
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
      _: "notice",
      message: "planning_stream_failed",
      error: error instanceof Error ? error.message : String(error),
    } as WorkflowEvent;
    throw error;
  }

  const trimmedPlanSummary = planSummary.trim();
  if (trimmedPlanSummary.length > 0) {
    yield {
      _: "event",
      kind: "plan-summary",
      data: { text: trimmedPlanSummary },
    } as any;
  }

  yield { _: "notice", message: "planning_completed" } as any;
  return trimmedPlanSummary || null;
}
