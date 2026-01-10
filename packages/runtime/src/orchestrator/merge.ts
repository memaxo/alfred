import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ConflictScanResult } from "@alfred/agent/orchestrator/multi/conflict";
import {
  aggregateConflictMarkers,
  countConflictMarkers,
} from "@alfred/agent/orchestrator/multi/conflict";
import {
  buildMergePlan,
  generateMergeExecPlanSkeleton,
  type AgentOutcome as MergeAgentOutcome,
  type MergePlan,
} from "@alfred/agent/orchestrator/multi/merge";
import { executeMergePlan } from "@alfred/agent/orchestrator/multi/merge-executor";
import { plansPath } from "@alfred/agent/orchestrator/plans";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { toolGit } from "@alfred/agent/orchestrator/tool/git";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import { formatCodexRuntimeError } from "../utils/codex-error";
import { resolveAgentfsContainer, resolveAgentfsContainerCw } from "./agentfs";
import type { OrchestratorContext } from "./types";
import type { WavesResult } from "./waves";

async function isGitWorkspace(workspace: string): Promise<boolean> {
  try {
    await fs.stat(path.join(workspace, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function resolveTargetBranch(
  workspace: string,
  authz: string | undefined
): Promise<string> {
  const forced = process.env.ORCH_TARGET_BRANCH?.trim();
  if (forced) {
    return forced;
  }
  if (!(await isGitWorkspace(workspace))) {
    return "dev";
  }

  try {
    const status = await toolGit.execute({
      input: {
        action: "status",
        cw: workspace,
        authz,
        timeoutSec: 30,
      },
    });
    const raw = status.details?.status ?? "";
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith("# branch.head ")) {
        const head = line.slice("# branch.head ".length).trim();
        if (head && head !== "(detached)" && head !== "(unknown)") {
          return head;
        }
      }
    }
  } catch (error) {
    logger.warn("merge_target_branch_probe_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return "dev";
}

export async function* runMergePhase(
  ctx: OrchestratorContext,
  wavesResult: WavesResult
): AsyncGenerator<
  WorkflowEvent,
  { mergePlan: MergePlan; conflictScanResult: ConflictScanResult | null },
  void
> {
  const { runId, workspace, authz, input, userId, plan } = ctx;
  const {
    allAgentOutcomes,
    agentFileHints,
    activeWorkspaces: _activeWorkspaces,
  } = wavesResult;
  const planId = plan?.id ?? runId;

  yield { type: "merge-start", planId } as unknown as WorkflowEvent;
  yield {
    type: "merge-progress",
    planId,
    progress: 0.1,
  } as unknown as WorkflowEvent;

  const mergeOutcomes: MergeAgentOutcome[] = allAgentOutcomes.map((outcome) => {
    const parts = outcome.agentId.split(":");
    const subTaskId =
      parts.length > 1 ? (parts.at(-1) ?? "unknown") : "unknown";
    const status: MergeAgentOutcome["status"] =
      outcome.stuck === true
        ? "stuck"
        : outcome.status === "failed"
          ? "failed"
          : outcome.status === "completed"
            ? "completed"
            : "completed";

    const result = outcome.result
      ? {
          summary: outcome.result.summary,
          artifacts: outcome.result.artifacts.map((p) => ({
            path: p,
            kind: "file",
          })),
          changes: outcome.result.changes,
          notes: outcome.result.notes,
          branch: outcome.result.branch,
        }
      : undefined;

    return {
      agentId: outcome.agentId,
      subTaskId,
      status,
      result,
    };
  });

  // Note: Poof overlay handling has been removed.
  // AgentFS workspaces manage state internally via SQLite.
  // Changes are tracked in the agentfs database for audit/learning.

  // Add fallback for Tier 1 agents
  for (const o of mergeOutcomes) {
    o.result ??= {
      summary: "codex agent execution",
      artifacts: [],
      changes: [],
      notes: [],
    };
    if (!o.result.changes || o.result.changes.length === 0) {
      const hints = agentFileHints.get(o.agentId);
      if (hints) {
        o.result.changes = Array.from(hints);
      }
    }
  }

  const targetBranch = await resolveTargetBranch(workspace, authz);
  const mergePlan = buildMergePlan(mergeOutcomes, { targetBranch });

  yield {
    type: "merge-progress",
    planId,
    progress: 0.3,
  } as unknown as WorkflowEvent;

  logger.info("multi_agent_merge_plan", {
    runId,
    expectedFiles: mergePlan.expectedFiles ?? [],
    summary: mergePlan.summary,
    branches: mergePlan.branches,
    targetBranch: mergePlan.targetBranch,
    changedPackages: mergePlan.changedPackages,
  });

  // Phase 9: Automated Merge Execution
  if (
    mergePlan.branches &&
    mergePlan.branches.length > 0 &&
    (await isGitWorkspace(workspace))
  ) {
    yield {
      type: "notice",
      message: "merge_execution_started",
    } as unknown as WorkflowEvent;
    yield {
      type: "merge-progress",
      planId,
      progress: 0.5,
    } as unknown as WorkflowEvent;

    const mergeResult = await executeMergePlan(
      mergePlan,
      workspace,
      toolGit,
      {
        write: (chunk: unknown) => {
          if (
            chunk &&
            typeof chunk === "object" &&
            (chunk as { type?: unknown }).type &&
            (((chunk as { type?: unknown }).type as unknown) === "stdout" ||
              ((chunk as { type?: unknown }).type as unknown) === "stderr")
          ) {
            // passthrough for observability
          }
        },
      },
      {
        authz,
        runId,
        userId,
        auto: input.auto,
      }
    ).catch((err) => {
      logger.error("merge_execution_error", { error: String(err) });
      return {
        status: "failed",
        mergedBranches: [],
        targetBranch,
        error: String(err),
      } as const;
    });

    if (mergeResult.status === "completed") {
      yield {
        type: "notice",
        message: "merge_execution_completed",
      } as unknown as WorkflowEvent;
    } else if (mergeResult.status === "conflict") {
      yield {
        type: "notice",
        message: "merge_execution_conflict",
        branch: mergeResult.conflictBranch,
        files: mergeResult.conflictFiles,
        reason: mergeResult.error,
      } as unknown as WorkflowEvent;
      if (mergeResult.error?.startsWith("arbiter_failed:")) {
        yield {
          type: "error",
          message: "merge_execution_conflict_arbiter_failed",
          branch: mergeResult.conflictBranch,
          files: mergeResult.conflictFiles,
          reason: mergeResult.error,
        } as unknown as WorkflowEvent;
      }
    } else {
      logger.warn("merge_execution_failed", { error: mergeResult.error });
      yield {
        type: "error",
        message: "merge_execution_failed",
        reason: mergeResult.error,
      } as unknown as WorkflowEvent;
    }
  }

  // Passive conflict detection
  let conflictScanResult: ConflictScanResult | null = null;
  try {
    const expectedFiles = mergePlan.expectedFiles ?? [];
    const counts: Record<string, number> = {};
    for (const rel of expectedFiles) {
      const abs = path.resolve(workspace, rel);
      try {
        const file = Bun.file(abs);
        if (await file.exists()) {
          const content = await file.text();
          counts[rel] = countConflictMarkers(content);
        }
      } catch {
        // Ignore unreadable or missing files
      }
    }
    conflictScanResult = aggregateConflictMarkers(
      mergePlan.expectedFiles ?? [],
      counts
    );
  } catch (error) {
    logger.warn("merge_conflict_scan_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  yield {
    type: "merge-complete",
    planId,
    result: {
      status: "completed",
      conflicts: conflictScanResult?.totalMarkers ?? 0,
    },
  } as unknown as WorkflowEvent;

  return { mergePlan, conflictScanResult };
}

export async function* runMergeAnalysis(
  ctx: OrchestratorContext,
  mergePlan: MergePlan
): AsyncGenerator<WorkflowEvent, void, void> {
  const { runId, workspace, authz, signal, userId } = ctx;
  const { containerName, containerBaseCw } = await resolveAgentfsContainer({
    runId,
    workspace,
    userId,
  });
  const containerCw = resolveAgentfsContainerCw({
    workspaceRoot: workspace,
    workingDirectory: workspace,
    containerBaseCw,
  });

  yield {
    type: "event",
    kind: "merge-plan",
    data: mergePlan,
  } as unknown as WorkflowEvent;

  // Merge analysis agent (analysis-only)
  const mergeExecPlanPath = plansPath(workspace, runId, "merge.md");
  const mergeExecPlanAbsPath = path.resolve(workspace, mergeExecPlanPath);
  try {
    const dir = path.dirname(mergeExecPlanAbsPath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(mergeExecPlanAbsPath);
    } catch {
      const skeleton = generateMergeExecPlanSkeleton(runId, mergePlan);
      await Bun.write(mergeExecPlanAbsPath, skeleton);
    }

    const promptLines = [
      "You are a merge analysis agent.",
      "",
      `ExecPlan path: ${mergeExecPlanPath}`,
      "",
      "Instructions:",
      "- Read the ExecPlan at the given path and the merge-plan summary.",
      "- Do NOT run git commands or mutate the repository; stay analysis-only.",
      "- Identify overlapping or conflicting edits and areas needing targeted tests.",
      ...(mergePlan.branches && mergePlan.branches.length > 0
        ? [
            "- NOTE: Feature branches exist. Recommend a strategy to merge them (e.g. git merge origin/branch).",
            "- Check for semantic conflicts between these branches.",
          ]
        : []),
      "- Update the Progress and Decision Log sections as you reason.",
      "- Summarise your conclusions at the end.",
    ];
    const prompt = promptLines.join("\n");

    const startedAt = Date.now();
    const mergeEvents: WorkflowEvent[] = [];

    const writer = {
      write: (chunk: unknown): Promise<void> => {
        if (!chunk || typeof chunk !== "object") {
          return Promise.resolve();
        }
        const payload = chunk as Record<string, unknown>;
        const type = typeof payload.type === "string" ? payload.type : "";
        if (type === "stdout" || type === "stderr") {
          const text = typeof payload.text === "string" ? payload.text : "";
          mergeEvents.push({ type, text } as unknown as WorkflowEvent);
        } else if (type === "notice") {
          mergeEvents.push({
            type: "notice",
            message:
              typeof payload.message === "string"
                ? payload.message
                : "merge_agent_notice",
          } as unknown as WorkflowEvent);
        }
        return Promise.resolve();
      },
    } as const;

    try {
      await toolCodex.execute({
        input: {
          action: "exec",
          prompt,
          out: "text",
          auto: "read", // Enforce read-only for analysis agents
          cw: workspace,
          containerName,
          containerCw,
          sessionId: `${runId}:merge`,
          model: undefined,
          profile: undefined,
          authz,
          context: {},
          userId,
        },
        writer,
        signal,
      });

      const finishedAt = Date.now();
      const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);

      for (const ev of mergeEvents) {
        yield ev;
      }

      yield {
        type: "event",
        kind: "merge-agent-result",
        data: {
          role: "merge",
          status: "completed",
          durationSeconds,
        },
      } as unknown as WorkflowEvent;
    } catch (error) {
      const finishedAt = Date.now();
      const durationSeconds = Math.max(0, (finishedAt - startedAt) / 1000);
      const { userMessage, rawMessage, code, needsElevation, limitExceeded } =
        formatCodexRuntimeError(error);
      logger.warn("merge_agent_execution_failed", {
        runId,
        error: rawMessage,
        code,
        needsElevation,
        limitExceeded,
      });
      mergeEvents.push({
        type: "notice",
        message: userMessage,
      } as unknown as WorkflowEvent);
      for (const ev of mergeEvents) {
        yield ev;
      }
      yield {
        type: "event",
        kind: "merge-agent-result",
        data: {
          role: "merge",
          status: "failed",
          durationSeconds,
        },
      } as unknown as WorkflowEvent;
    }
  } catch (error) {
    const { userMessage, rawMessage, code, needsElevation, limitExceeded } =
      formatCodexRuntimeError(error);
    logger.warn("merge_agent_initialisation_failed", {
      runId,
      error: rawMessage,
      code,
      needsElevation,
      limitExceeded,
    });
    yield {
      type: "notice",
      message: userMessage,
    } as unknown as WorkflowEvent;
  }
}
