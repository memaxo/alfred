import { generateObject } from "ai";
import { getOpenAI, getModelId } from "@alfred/agent/v6";
import { logger } from "@alfred/logger";
import {
  structuredPlanSchema,
  type StructuredPlan,
} from "../generate/types.js";
import type { WorkflowIntent } from "../intent/types.js";
import type { PlanCritique } from "./types.js";

/**
 * Revise a plan based on a critique
 */
export async function revisePlan(
  plan: StructuredPlan,
  critique: PlanCritique,
  intent: WorkflowIntent
): Promise<StructuredPlan> {
  const startTime = Date.now();

  try {
    const { object } = await generateObject({
      model: getOpenAI()(getModelId()),
      schema: structuredPlanSchema,
      prompt: buildRevisionPrompt(plan, critique, intent),
    });

    logger.debug("plan_revised", {
      planId: plan.id,
      originalPhases: plan.phases.length,
      revisedPhases: object.phases.length,
      durationMs: Date.now() - startTime,
    });

    return object;
  } catch (error) {
    logger.error("plan_revision_failed", {
      planId: plan.id,
      error: error instanceof Error ? error.message : String(error),
    });
    // Return original plan as fallback
    return plan;
  }
}

function buildRevisionPrompt(
  plan: StructuredPlan,
  critique: PlanCritique,
  intent: WorkflowIntent
): string {
  return `Revise the following implementation plan based on the provided critique.
User Intent: ${intent.description}

Original Plan:
${JSON.stringify(plan, null, 2)}

Critique:
- Score: ${critique.overallScore}
- Strengths: ${critique.strengths.join(", ")}
- Weaknesses: ${critique.weaknesses.join(", ")}
- Issues to Address:
${critique.issues
  .map(
    (i) =>
      `  * [${i.severity}] ${i.phaseId ? `(Phase ${i.phaseId}) ` : ""}${i.description}. Suggestion: ${i.suggestion}`
  )
  .join("\n")}

Guidelines for revision:
1. Address all high and medium severity issues.
2. Ensure the plan remains structurally valid (no cycles, non-empty phases).
3. Keep the same plan ID.
4. Improve descriptions and task titles where suggested.

Return the complete revised plan JSON matching the schema.`;
}
