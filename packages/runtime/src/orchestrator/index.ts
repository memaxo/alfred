import * as fs from "node:fs/promises";
import * as path from "node:path";
import { planRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import type { StructuredPlan } from "@alfred/plan";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { ExecutionContext } from "../context";
import type { RuntimeInput } from "../types";
import { runConflictPhase } from "./conflict";
import { runMergeAnalysis, runMergePhase } from "./merge";
import { runReviewPhase } from "./review";
import type { OrchestratorContext, ProjectConfig } from "./types";
import { runWaves, type WavesResult } from "./waves";

export { assignAgentTypes, setIsolation } from "./agents.js";
export { convertPlanToWavePlan } from "./convert.js";
export { buildDependencyMap } from "./dependencies.js";
export { flattenPhases } from "./flatten.js";
export * from "./types.js";
export type { WavesResult } from "./waves.js";
export { runWaves } from "./waves.js";

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

  // Load plan if planId is provided
  let plan: StructuredPlan | null = null;
  if (input.planId) {
    const savedPlan = await planRepo.getPlanById(input.planId);
    if (savedPlan) {
      plan = savedPlan.plan as StructuredPlan;
    }
  }

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
    plan,
  };

  let wavesResult: WavesResult | null = null;
  try {
    // Phase A: Multi-Agent Waves
    // Decompose task, plan waves, and execute agents in parallel
    wavesResult = yield* runWaves(ctx);

    if (
      wavesResult.aborted ||
      wavesResult.escalated ||
      wavesResult.interrupted ||
      wavesResult.suspended
    ) {
      if (wavesResult.suspended) {
        yield {
          type: "notice",
          message: "workflow_suspended_waiting_for_clarification",
        } as WorkflowEvent;
      }
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
    const workspaces = wavesResult?.activeWorkspaces ?? [];
    for (const ws of workspaces) {
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
      const isGitWorkspace = await fs
        .stat(path.join(workspace, ".git"))
        .then(() => true)
        .catch(() => false);
      if (isGitWorkspace) {
        const { worktreeManager } = await import(
          "@alfred/agent/orchestrator/tool/worktree"
        );
        await worktreeManager.cleanup(workspace, runId);
      }
    } catch (error) {
      logger.warn("worktree_cleanup_failed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
