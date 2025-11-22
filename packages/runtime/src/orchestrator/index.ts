import type { WorkflowEvent } from "@alfred/type/plan";
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
  authz?: string
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
  };

  // Phase A: Multi-Agent Waves
  // Decompose task, plan waves, and execute agents in parallel
  const wavesResult = yield* runWaves(ctx);

  if (wavesResult.aborted) {
    // Waves aborted due to high failure rate, skip remainder
    return;
  }

  // Phase B: Merge Execution & Conflict Detection
  // Consolidate results, attempt git merge, and scan for conflicts
  const { mergePlan, conflictScanResult } = yield* runMergePhase(
    ctx,
    wavesResult
  );

  // Phase C: Conflict Analysis & Resolution
  // If conflicts detected, analyze and attempt to resolve them
  yield* runConflictPhase(ctx, conflictScanResult);

  // Phase D: Merge Analysis
  // Analyze the semantic implications of the merge (post-resolution)
  yield* runMergeAnalysis(ctx, mergePlan);

  // Phase E: Review & Self-Correction
  // Plan validation checks (lint, test) and auto-fix if they fail
  yield* runReviewPhase(ctx, mergePlan);

  return; // Placeholder for result type
}
