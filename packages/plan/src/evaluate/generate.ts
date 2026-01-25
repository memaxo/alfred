import { logger } from "@alfred/logger";
import { generateObject } from "ai";

import type { StructuredPlan } from "../generate/types.js";
import type { WorkflowIntent } from "../intent/types.js";
import type { ResearchResult } from "../research/types.js";

import { getModelId, getOpenAI } from "../ai.js";
import { type PlanCritique, planCritiqueSchema } from "./types.js";

/**
 * Generate a critique for a plan using LLM
 */
export async function generateCritique(
  plan: StructuredPlan,
  intent: WorkflowIntent,
  research: ResearchResult
): Promise<PlanCritique> {
  const startTime = Date.now();

  try {
    const { object } = await generateObject({
      model: getOpenAI()(getModelId()) as any,
      schema: planCritiqueSchema,
      prompt: buildCritiquePrompt(plan, intent, research),
    });

    logger.debug("plan_critique_generated", {
      planId: plan.id,
      score: object.overallScore,
      issues: object.issues.length,
      durationMs: Date.now() - startTime,
    });

    return object;
  } catch (error) {
    logger.error("plan_critique_generation_failed", {
      planId: plan.id,
      error: error instanceof Error ? error.message : String(error),
    });
    // Return empty critique as fallback
    return {
      issues: [],
      overallScore: 1,
      strengths: ["Automatic fallback due to generation error"],
      weaknesses: [],
    };
  }
}

function buildCritiquePrompt(
  plan: StructuredPlan,
  intent: WorkflowIntent,
  research: ResearchResult
): string {
  return `Critique the following implementation plan for the given intent.
Intent: ${intent.description}

Plan:
Title: ${plan.title}
Phases:
${plan.phases
  .map(
    (p) =>
      `- ${p.name} (${p.agentType}): ${p.description}\n  Tasks: ${p.tasks
        .map((t) => t.title)
        .join(", ")}\n  Depends on: ${p.dependsOn.join(", ")}`
  )
  .join("\n")}

Internal Context:
- Existing Code: ${research.internal.existingCode.join(", ")}
- Conventions: ${research.internal.conventions.map((c) => c.description).join("; ")}

Evaluation Focus:
1. Completeness: Are all requirements from the intent covered?
2. Dependencies: Are phase dependencies correct? Are there missing dependencies?
3. Risk: Are high-risk phases identified? Is the order safe?
4. Efficiency: Can phases be parallelized?
5. Clarity: Are phase descriptions and task titles clear and actionable?

Return JSON matching the schema.`;
}
