import type { StructuredPlan } from "../generate/types.js";
import type { EvaluationRubric } from "./types.js";

/**
 * Apply a rubric to a plan for tie-breaking
 */
export async function applyRubric(
  plan: StructuredPlan,
  rubric: EvaluationRubric
): Promise<number> {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const criterion of rubric.criteria) {
    const score = await criterion.evaluate(plan);
    weightedSum += score * criterion.weight;
    totalWeight += criterion.weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Default rubric for plan evaluation
 */
export const defaultRubric: EvaluationRubric = {
  criteria: [
    {
      name: "completeness",
      weight: 0.4,
      evaluate: (plan) => {
        // Higher score for more tasks (heuristic for detail)
        const taskCount = plan.phases.reduce(
          (sum, p) => sum + p.tasks.length,
          0
        );
        return Math.min(1, taskCount / 10);
      },
    },
    {
      name: "efficiency",
      weight: 0.3,
      evaluate: (plan) => {
        // Higher score for parallel strategy
        return plan.resources.strategy === "parallel"
          ? 1
          : (plan.resources.strategy === "mixed"
            ? 0.7
            : 0.4);
      },
    },
    {
      name: "risk",
      weight: 0.3,
      evaluate: (plan) => {
        // Lower score for high agent count (heuristic for complexity/risk)
        return Math.max(0, 1 - (plan.resources.agentCount - 1) * 0.2);
      },
    },
  ],
};
