import type { StructuredPlan } from "../generate/types.js";
import { enforceBudgets } from "./budget.js";
import { runCheck } from "./checks.js";
import { applyRubric, defaultRubric } from "./rubric.js";
import type {
  EvaluationRubric,
  PlanEvaluation,
  VerificationResult,
} from "./types.js";

/**
 * Perform verification-first deterministic evaluation of a plan
 */
export async function evaluatePlanDeterministic(
  plan: StructuredPlan,
  options?: {
    checks?: ("typecheck" | "test" | "lint" | "build")[];
    rubric?: EvaluationRubric;
  }
): Promise<PlanEvaluation> {
  // 1. Budget enforcement (fast gate)
  const budgetResult = enforceBudgets(plan);
  if (!budgetResult.success) {
    return {
      planId: plan.id,
      scores: [
        {
          judge: "budget",
          criterion: "enforcement",
          score: 0.0,
          reasoning: budgetResult.reason ?? "Budget exceeded",
        },
      ],
      aggregateScore: 0.0,
      selected: false,
    };
  }

  // 2. Run verification checks
  const checks = options?.checks ?? ["typecheck", "lint"];
  const verification = await verifyPlan(plan, checks);

  // 3. If verification fails, return zero score
  if (!verification.passes) {
    return {
      planId: plan.id,
      scores: [
        {
          judge: "verification",
          criterion: "checks",
          score: 0.0,
          reasoning: `Failed checks: ${verification.failed.join(", ")}`,
        },
      ],
      aggregateScore: 0.0,
      selected: false,
    };
  }

  // 4. If verification passes, apply rubric for quality score
  const rubric = options?.rubric ?? defaultRubric;
  const rubricScore = await applyRubric(plan, rubric);

  return {
    planId: plan.id,
    scores: [
      {
        judge: "verification",
        criterion: "checks",
        score: 1.0,
        reasoning: `Passed all checks: ${verification.passed.join(", ")}`,
      },
      {
        judge: "rubric",
        criterion: "quality",
        score: rubricScore,
        reasoning: "Rubric-based quality score",
      },
    ],
    aggregateScore: rubricScore,
    selected: true,
  };
}

/**
 * Execute multiple verification checks
 */
async function verifyPlan(
  plan: StructuredPlan,
  checks: ("typecheck" | "test" | "lint" | "build")[]
): Promise<VerificationResult> {
  const result: VerificationResult = {
    passes: true,
    passed: [],
    failed: [],
    details: {},
  };

  for (const check of checks) {
    const checkResult = await runCheck(plan, check);
    result.details[check] = checkResult;

    if (checkResult.success) {
      result.passed.push(check);
    } else {
      result.passes = false;
      result.failed.push(check);
    }
  }

  return result;
}
