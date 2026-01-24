import type { StructuredPlan } from "../generate/types.js";
import type { WorkflowIntent } from "../intent/types.js";
import type { ResearchResult } from "../research/types.js";
import type { CritiqueOptions, PlanCritiqueResult } from "./types.js";

import { generateCritique } from "./generate.js";
import { revisePlan } from "./revise.js";
import { validatePlan } from "./validate.js";

/**
 * Perform an iterative critique and revision loop for a plan
 */
export async function critiquePlan(
  plan: StructuredPlan,
  intent: WorkflowIntent,
  research: ResearchResult,
  options?: CritiqueOptions
): Promise<PlanCritiqueResult> {
  let currentPlan = plan;
  let iterations = 0;
  let lastCritique = await generateCritique(plan, intent, research);

  const maxRevisions = options?.maxRevisions ?? 2;

  while (iterations < maxRevisions) {
    // Check abort signal
    if (options?.abortSignal?.aborted) {
      break;
    }

    // If critique finds no issues or score is high enough, we can stop
    if (lastCritique.issues.length === 0 || lastCritique.overallScore >= 0.9) {
      return {
        critique: lastCritique,
        revisedPlan: currentPlan,
        iterations,
      };
    }

    // Generate revision
    const revised = await revisePlan(currentPlan, lastCritique, intent);

    // Validate revision
    if (!validatePlan(revised)) {
      // Revision invalid, return last valid plan and its critique
      return {
        critique: lastCritique,
        revisedPlan: currentPlan,
        iterations,
      };
    }

    currentPlan = revised;
    iterations++;

    // Generate new critique for the revised plan
    lastCritique = await generateCritique(currentPlan, intent, research);
  }

  return {
    critique: lastCritique,
    revisedPlan: currentPlan,
    iterations,
  };
}
