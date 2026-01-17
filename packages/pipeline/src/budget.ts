import { checkBudget, recordCost } from "@alfred/metrics";
import type { ModelProvider } from "@alfred/type/model";
import { createEvent } from "./events";
import type { PipelineContext } from "./pipeline";

/**
 * Budget enforcement for pipeline workflows.
 */

const DEFAULT_BUDGET_USD = 10.0; // $10 per workflow by default

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

  // Track cumulative cost in context
  const currentTotal = ctx.get<number>("cost:total") ?? 0;
  ctx.set("cost:total", currentTotal + costUsd);

  // Check budget
  const budgetUsd = getBudgetUsd(ctx);
  const budgetStatus = checkBudget(ctx.runId, budgetUsd);

  if (budgetStatus.approaching && !budgetStatus.exceeded) {
    ctx.emit(
      createEvent("budget:warning", {
        costUsd: budgetStatus.costUsd,
        budgetUsd: budgetStatus.budgetUsd,
        percentUsed: (budgetStatus.costUsd / budgetStatus.budgetUsd) * 100,
      })
    );
  }

  if (budgetStatus.exceeded) {
    ctx.emit(
      createEvent("budget:exceeded", {
        costUsd: budgetStatus.costUsd,
        budgetUsd: budgetStatus.budgetUsd,
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
