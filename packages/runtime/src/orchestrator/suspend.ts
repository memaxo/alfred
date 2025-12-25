import { clarificationRepo, workflowRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import type { ClarificationRequest } from "./types.js";

/**
 * Suspend a workflow run due to a clarification request.
 */
export async function suspendWorkflowForClarification(
  runId: string,
  clarification: ClarificationRequest
): Promise<void> {
  // 1. Persist clarification request
  await clarificationRepo.createRequest({
    id: clarification.id,
    runId: clarification.runId,
    phaseId: clarification.phaseId,
    agentId: clarification.agentId,
    question: clarification.question,
    options: clarification.options,
  });

  // 2. Update workflow run status to suspended
  await workflowRepo.updateRun(runId, {
    status: "suspended",
    suspendedAt: new Date(),
  });

  logger.info("workflow_suspended_for_clarification", {
    runId,
    clarificationId: clarification.id,
    agentId: clarification.agentId,
  });
}
