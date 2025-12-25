import type { StructuredPlan } from "../generate/types.js";
import { estimateTextTokens } from "../research/token.js";

const PHASE_TOKEN_BUDGET = 100_000;
const MAX_WORKFLOW_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Enforce token and duration budgets for a plan
 */
export function enforceBudgets(plan: StructuredPlan): {
  success: boolean;
  reason?: string;
} {
  // 1. Check token budgets per phase
  for (const phase of plan.phases) {
    let phaseTokens = estimateTextTokens(phase.name + phase.description);
    for (const task of phase.tasks) {
      phaseTokens += estimateTextTokens(task.title + task.requirement);
    }

    if (phaseTokens > PHASE_TOKEN_BUDGET) {
      return {
        success: false,
        reason: `Phase "${phase.name}" exceeds token budget (${phaseTokens} > ${PHASE_TOKEN_BUDGET})`,
      };
    }
  }

  // 2. Check total duration
  const totalDuration = plan.phases.reduce(
    (sum, p) => sum + p.estimatedDurationMs,
    0
  );
  if (totalDuration > MAX_WORKFLOW_DURATION_MS) {
    return {
      success: false,
      reason: `Plan exceeds total duration budget (${totalDuration}ms > ${MAX_WORKFLOW_DURATION_MS}ms)`,
    };
  }

  return { success: true };
}
