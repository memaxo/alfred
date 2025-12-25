import { clarificationRepo, workflowRepo } from "@alfred/db";
import { logger } from "@alfred/logger";

/**
 * Resume a workflow run after a clarification response has been provided.
 */
export async function resumeWorkflowAfterClarification(
  runId: string,
  clarificationId: string,
  response: string
): Promise<void> {
  // 1. Update clarification with response
  await clarificationRepo.updateResponse(clarificationId, response);

  // 2. Fetch the run to get existing inputData
  const run = await workflowRepo.getRun(runId);
  if (run) {
    const inputData = (run.inputData as Record<string, unknown>) ?? {};
    const clarifications = (inputData.clarifications as any[]) ?? [];

    // Store response in inputData so agents can see it in their prompt
    await workflowRepo.updateRun(runId, {
      status: "running",
      resumedAt: new Date(),
      inputData: {
        ...inputData,
        clarifications: [
          ...clarifications,
          { id: clarificationId, response, timestamp: new Date() },
        ],
      },
    });
  } else {
    // Fallback if run not found
    await workflowRepo.updateRun(runId, {
      status: "running",
      resumedAt: new Date(),
    });
  }

  logger.info("workflow_resumed_after_clarification", {
    runId,
    clarificationId,
  });
}
