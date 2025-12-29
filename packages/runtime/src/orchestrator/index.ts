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

export { assignAgentTypes } from "./agents.js";
export { convertPlanToWavePlan } from "./convert.js";
export { buildDependencyMap } from "./dependencies.js";
export { flattenPhases } from "./flatten.js";
export * from "./types.js";
export type { WavesResult } from "./waves.js";
export { runWaves } from "./waves.js";

export type OrchestratorDeps = {
  runWaves?: typeof runWaves;
  runMergePhase?: typeof runMergePhase;
  runConflictPhase?: typeof runConflictPhase;
  runMergeAnalysis?: typeof runMergeAnalysis;
  runReviewPhase?: typeof runReviewPhase;
};

export async function* runOrchestrator(
  input: RuntimeInput,
  runId: string,
  signal: AbortSignal,
  history?: WorkflowEvent[],
  projectConfig?: ProjectConfig | null,
  escalationContext?: string,
  authz?: string,
  scanContext?: ExecutionContext | null,
  userId?: string,
  deps?: OrchestratorDeps
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
    const runWavesFn = deps?.runWaves ?? runWaves;
    const runMergePhaseFn = deps?.runMergePhase ?? runMergePhase;
    const runConflictPhaseFn = deps?.runConflictPhase ?? runConflictPhase;
    const runMergeAnalysisFn = deps?.runMergeAnalysis ?? runMergeAnalysis;
    const runReviewPhaseFn = deps?.runReviewPhase ?? runReviewPhase;

    // Phase A: Multi-Agent Waves
    // Decompose task, plan waves, and execute agents in parallel
    wavesResult = yield* runWavesFn(ctx);

    if (
      wavesResult.aborted ||
      wavesResult.escalated ||
      wavesResult.interrupted ||
      wavesResult.suspended
    ) {
      if (wavesResult.suspended) {
        yield {
          _: "notice",
          message: "workflow_suspended_waiting_for_clarification",
        } as WorkflowEvent;
      }
      if (wavesResult.escalated) {
        yield {
          _: "notice",
          message: "workflow_escalated",
          reason: wavesResult.escalationReason,
        } as WorkflowEvent;
      }
      if (wavesResult.interrupted) {
        yield {
          _: "notice",
          message: "workflow_interrupted",
        } as WorkflowEvent;
      }
      return;
    }

    // Phase B: Merge Execution & Conflict Detection
    const { mergePlan, conflictScanResult } = yield* runMergePhaseFn(
      ctx,
      wavesResult
    );

    // Phase C: Conflict Analysis & Resolution
    yield* runConflictPhaseFn(ctx, conflictScanResult);

    // Phase D: Merge Analysis
    yield* runMergeAnalysisFn(ctx, mergePlan);

    // Phase E: Review & Self-Correction
    yield* runReviewPhaseFn(ctx, mergePlan);

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
