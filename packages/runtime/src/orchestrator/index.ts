import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { ExecutionContext } from "../context";
import type { RuntimeInput } from "../types";
import { runConflictPhase } from "./conflict";
import { runMergeAnalysis, runMergePhase } from "./merge";
import { runReviewPhase } from "./review";
import type { OrchestratorContext, ProjectConfig } from "./types";
import { runWaves } from "./waves";

export async function* runOrchestrator(
  input: RuntimeInput,
  runId: string,
  signal: AbortSignal,
  history?: WorkflowEvent[],
  projectConfig?: ProjectConfig | null,
  escalationContext?: string,
  authz?: string,
  scanContext?: ExecutionContext | null,
  userId?: string
): AsyncGenerator<WorkflowEvent, void, void> {
  const workspace = input.workspace ?? process.cwd();
  const ctx: OrchestratorContext = {
    input,
    runId,
    signal,
    workspace,
    history,
    projectConfig,
    escalationContext,
    authz,
    scanContext,
    userId,
  };

  // Phase A: Multi-Agent Waves
  // Decompose task, plan waves, and execute agents in parallel
  const wavesResult = yield* runWaves(ctx);

  try {
    if (
      wavesResult.aborted ||
      wavesResult.escalated ||
      wavesResult.interrupted
    ) {
      if (wavesResult.escalated) {
        yield {
          type: "notice",
          message: "workflow_escalated",
          reason: wavesResult.escalationReason,
        } as WorkflowEvent;
      }
      if (wavesResult.interrupted) {
        yield {
          type: "notice",
          message: "workflow_interrupted",
        } as WorkflowEvent;
      }
      return;
    }

    // Phase B: Merge Execution & Conflict Detection
    const { mergePlan, conflictScanResult } = yield* runMergePhase(
      ctx,
      wavesResult
    );

    // Phase C: Conflict Analysis & Resolution
    yield* runConflictPhase(ctx, conflictScanResult);

    // Phase D: Merge Analysis
    yield* runMergeAnalysis(ctx, mergePlan);

    // Phase E: Review & Self-Correction
    yield* runReviewPhase(ctx, mergePlan);

    return; // Placeholder for result type
  } finally {
    for (const ws of wavesResult.activeWorkspaces) {
      try {
        await ws.cleanup();
      } catch (error) {
        logger.warn("workspace_cleanup_failed", {
          workspaceId: ws.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      const { worktreeManager } = await import(
        "@alfred/agent/orchestrator/tool/worktree"
      );
      await worktreeManager.cleanup(workspace, runId);
    } catch (error) {
      logger.warn("worktree_cleanup_failed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
