import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  aggregateConflictMarkers,
  countConflictMarkers,
} from "@alfred/agent/orchestrator/multi/conflict";
import {
  buildMergePlan,
  generateMergeExecPlanSkeleton,
} from "@alfred/agent/orchestrator/multi/merge";
import { executeMergePlan } from "@alfred/agent/orchestrator/multi/merge-executor";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { toolGit } from "@alfred/agent/orchestrator/tool/git";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import { formatCodexRuntimeError } from "../utils/codex-error";
import type { OrchestratorContext } from "./types";
import type { WavesResult } from "./waves";

async function runGitCommand(
  cwd: string,
  args: string[]
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(""),
    proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(""),
    proc.exited,
  ]);

  return {
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function resolveTargetBranch(workspace: string): Promise<string> {
  const forced = process.env.ORCH_TARGET_BRANCH?.trim();
  if (forced) {
    return forced;
  }
  const res = await runGitCommand(workspace, [
    "rev-parse",
    "--abbrev-ref",
    "HEAD",
  ]);
  if (res.exitCode === 0 && res.stdout && res.stdout !== "HEAD") {
    return res.stdout;
  }
  return "dev";
}

export async function* runMergePhase(
  ctx: OrchestratorContext,
  wavesResult: WavesResult
): AsyncGenerator<
  WorkflowEvent,
  { mergePlan: any; conflictScanResult: any },
  void
> {
  const { input, runId, workspace } = ctx;
  const { allAgentOutcomes, agentFileHints } = wavesResult;

  const mergeOutcomes = allAgentOutcomes.map((outcome) => ({
    agentId: outcome.agentId,
    subTaskId: (outcome as any).subTaskId ?? "unknown",
    status: outcome.status,
    result: (outcome as any).result ?? {
      summary: "codex agent execution",
      artifacts: [],
      changes: [],
      notes: [],
    },
  }));

  // Add fallback for Tier 1 agents
  for (const o of mergeOutcomes) {
    if (!o.result.changes || o.result.changes.length === 0) {
      const hints = agentFileHints.get(o.agentId);
      if (hints) {
        o.result.changes = Array.from(hints);
      }
    }
  }

  const targetBranch = await resolveTargetBranch(workspace);
  const mergePlan = buildMergePlan(mergeOutcomes as any, { targetBranch });

  logger.info("multi_agent_merge_plan", {
    runId,
    expectedFiles: mergePlan.expectedFiles ?? [],
    summary: mergePlan.summary,
    branches: mergePlan.branches,
    targetBranch: mergePlan.targetBranch,
    changedPackages: mergePlan.changedPackages,
  });

  // Phase 9: Automated Merge Execution
  if (mergePlan.branches && mergePlan.branches.length > 0) {
    yield { type: "notice", message: "merge_execution_started" } as any;

    const mergeResult = await executeMergePlan(
      mergePlan,
      workspace,
      toolGit,
      {
        write: (chunk: any) => {
          if (chunk?.type === "stdout" || chunk?.type === "stderr") {
            // passthrough for observability
          }
        },
      },
      {
        authz: input.linear?.authz,
        runId,
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
      yield { type: "notice", message: "merge_execution_completed" } as any;
    } else if (mergeResult.status === "conflict") {
      yield {
        type: "notice",
        message: "merge_execution_conflict",
        branch: mergeResult.conflictBranch,
        files: mergeResult.conflictFiles,
      } as any;
    } else {
      logger.warn("merge_execution_failed", { error: mergeResult.error });
      yield { type: "error", message: "merge_execution_failed" } as any;
    }
  }

  // Passive conflict detection
  let conflictScanResult: {
    files: string[];
    totalMarkers: number;
    counts: Record<string, number>;
  } | null = null;
  try {
    const expectedFiles = mergePlan.expectedFiles ?? [];
    const counts: Record<string, number> = {};
    for (const rel of expectedFiles) {
      const abs = path.resolve(workspace, rel);
      try {
        const content = await fs.readFile(abs, "utf8");
        counts[rel] = countConflictMarkers(content);
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

  return { mergePlan, conflictScanResult };
}

export async function* runMergeAnalysis(
  ctx: OrchestratorContext,
  mergePlan: any
): AsyncGenerator<WorkflowEvent, void, void> {
  const { runId, workspace } = ctx;

  yield {
    type: "event",
    kind: "merge-plan",
    data: mergePlan,
  } as any;

  // Merge analysis agent (analysis-only)
  const mergeExecPlanPath = `.agent/plans/${runId}/merge.md`;
  try {
    const dir = path.dirname(mergeExecPlanPath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(mergeExecPlanPath);
    } catch {
      const skeleton = generateMergeExecPlanSkeleton(runId, mergePlan);
      await fs.writeFile(mergeExecPlanPath, skeleton, "utf8");
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
      write: async (chunk: unknown) => {
        const payload = chunk as { type?: string; event?: unknown };
        if (!payload || typeof payload !== "object") {
          return;
        }
        const type = (payload as any).type;
        if (type === "stdout" || type === "stderr") {
          const text = (payload as any).text ?? "";
          mergeEvents.push({ type, text } as any);
        } else if (type === "notice") {
          mergeEvents.push({
            type: "notice",
            message: (payload as any).message ?? "merge_agent_notice",
          } as any);
        }
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
          sessionId: `${runId}:merge`,
          model: undefined,
          profile: undefined,
          context: {},
        },
        writer,
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
      } as any;
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
      } as any);
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
      } as any;
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
    } as any;
  }
}
