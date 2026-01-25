import type { ModelProvider } from "@alfred/type/model";

import { getOrCreateTracker } from "@alfred/history";
import { checkBudget, recordCost } from "@alfred/metrics";

import type { PipelineContext } from "./pipeline";

import { createEvent } from "./events";

/**
 * Budget enforcement for pipeline workflows.
 */

const DEFAULT_BUDGET_USD = 10; // $10 per workflow by default

export function getBudgetUsd(ctx: PipelineContext): number {
  return ctx.get<number>("budget:limit") ?? DEFAULT_BUDGET_USD;
}

export function setBudgetUsd(ctx: PipelineContext, budgetUsd: number): void {
  ctx.set("budget:limit", budgetUsd);
}

/**
 * Record token usage and cost for a model call within pipeline.
 */
export function recordPipelineCost(
  ctx: PipelineContext,
  provider: ModelProvider,
  modelId: string,
  promptTokens: number,
  completionTokens: number
): void {
  const costUsd = recordCost(
    provider,
    modelId,
    promptTokens,
    completionTokens,
    ctx.runId
  );

  // Also record in unified history tracker for metrics
  try {
    const tracker = getOrCreateTracker({
      budgetUsd: getBudgetUsd(ctx),
      modelId,
      sessionId: ctx.runId,
    });
    tracker.record({
      inputTokens: promptTokens,
      latencyMs: 0,
      modelId,
      outputTokens: completionTokens, // Not tracked at pipeline level
    });
  } catch {
    // Don't fail pipeline if tracking fails
    // Error is logged by tracker internally
  }

  // Track cumulative cost in context
  const currentTotal = ctx.get<number>("cost:total") ?? 0;
  ctx.set("cost:total", currentTotal + costUsd);

  // Check budget
  const budgetUsd = getBudgetUsd(ctx);
  const budgetStatus = checkBudget(ctx.runId, budgetUsd);

  if (budgetStatus.approaching && !budgetStatus.exceeded) {
    ctx.emit(
      createEvent("budget:warning", {
        budgetUsd: budgetStatus.budgetUsd,
        costUsd: budgetStatus.costUsd,
        percentUsed: (budgetStatus.costUsd / budgetStatus.budgetUsd) * 100,
      })
    );
  }

  if (budgetStatus.exceeded) {
    ctx.emit(
      createEvent("budget:exceeded", {
        budgetUsd: budgetStatus.budgetUsd,
        costUsd: budgetStatus.costUsd,
      })
    );
  }
}

/**
 * Get total cost for current run from context.
 */
export function getTotalCost(ctx: PipelineContext): number {
  return ctx.get<number>("cost:total") ?? 0;
}
