import { patternRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { embed } from "@alfred/rag";

import type { StructuredPlan } from "../generate/types.js";

import { syncPatternToKnowledgeGraph } from "./knowledge.js";
import { extractTrigger } from "./trigger.js";

export type WorkflowRunLike = {
  id: string;
  userId: string;
  status: string;
  projectId?: string | null;
  created: Date | null;
  completedAt: Date | null;
};

/**
 * Extract a WorkflowPattern from a successful run and plan.
 */
export async function extractPatternFromRun(
  run: WorkflowRunLike,
  plan: StructuredPlan
) {
  // 1. Extract semantic trigger
  const trigger = await extractTrigger(plan.intent);

  // 2. Extract plan template (omit dynamic fields)
  const planTemplate = {
    phases: plan.phases,
    resources: plan.resources,
    evaluationCriteria: plan.evaluationCriteria,
  };

  // 3. Calculate success rate (1.0 for completed runs)
  const successRate = run.status === "completed" ? "1.0000" : "0.5000";

  // 4. Calculate duration
  const start = run.created?.getTime() ?? Date.now();
  const end = run.completedAt?.getTime() ?? Date.now();
  const durationMs = Math.max(0, end - start);

  // 5. Create pattern in DB
  const pattern = await patternRepo.createPattern({
    userId: run.userId,
    projectId: run.projectId ?? undefined,
    trigger,
    embedding: await embed(trigger),
    planTemplate,
    successRate,
    avgDurationMs: durationMs,
    usageCount: 1,
  });

  // 6. Sync to Knowledge Graph
  await syncPatternToKnowledgeGraph(pattern);

  logger.info("workflow_pattern_extracted", {
    patternId: pattern.id,
    trigger,
    runId: run.id,
  });

  return pattern;
}
