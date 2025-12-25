import type { StructuredPlan } from "../generate/types.js";
import { extractTrigger } from "./trigger.js";
import { syncPatternToKnowledgeGraph } from "./knowledge.js";
import { patternRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { embed } from "@alfred/rag";
import type { WorkflowRunLike } from "./extract.js";

/**
 * Extract an Anti-Pattern from a failed run and plan.
 */
export async function extractAntiPatternFromRun(
  run: WorkflowRunLike,
  plan: StructuredPlan,
  failureReason: string
) {
  // 1. Extract semantic trigger
  const trigger = await extractTrigger(plan.intent);

  // 2. Extract plan template and attach failure reason
  const planTemplate = {
    phases: plan.phases,
    resources: plan.resources,
    evaluationCriteria: plan.evaluationCriteria,
    failureReason, // Crucial for anti-patterns
  };

  // 3. Success rate is 0.0 for explicit failures
  const successRate = "0.0000";

  // 4. Calculate duration until failure
  const start = run.created?.getTime() ?? Date.now();
  const end = run.completedAt?.getTime() ?? Date.now();
  const durationMs = Math.max(0, end - start);

  // 5. Create anti-pattern in DB
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

  // 6. Sync to Knowledge Graph (as a failure node)
  await syncPatternToKnowledgeGraph(pattern);

  logger.warn("workflow_anti_pattern_extracted", {
    patternId: pattern.id,
    trigger,
    runId: run.id,
    reason: failureReason,
  });

  return pattern;
}
