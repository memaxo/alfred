import { cognitiveRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { PlanRunner } from "./plan-runner";

/**
 * Resume interrupted plans from database snapshots
 *
 * Checks for streams that were in 'executing' state but stopped.
 * Restarts PlanRunner for those streams.
 */
export async function resumeInterruptedPlans(tools: Record<string, any>) {
  logger.info("resume_interrupted_plans_started");

  try {
    const activeSnapshots = await cognitiveRepo.findActivePlans();

    if (activeSnapshots.length === 0) {
      logger.info("resume_interrupted_plans_none_found");
      return;
    }

    logger.info("resume_interrupted_plans_found", {
      count: activeSnapshots.length,
    });

    // Create a shared adapter/context for resumption
    // Note: Ideally we should restore the original context (user, runId)
    // But for now we use a generic system context

    for (const snapshot of activeSnapshots) {
      const state = snapshot.state as any;
      const plan = state.plan;
      const stepIndex = state.step;
      const streamId = snapshot.streamId;

      if (
        plan &&
        typeof stepIndex === "number" &&
        stepIndex < plan.steps.length
      ) {
        // Dead Letter Queue Check
        const retryCount = (state as any).retryCount ?? 0;
        if (retryCount > 3) {
          logger.error("plan_dead_letter_queue", {
            streamId,
            stepIndex,
            retryCount,
            reason: "Max retries exceeded",
          });
          // Mark as terminal failure in DB to prevent infinite loop
          // In a real implementation we would update the snapshot state to 'failed'
          continue;
        }

        logger.info("resume_plan_execution", {
          streamId,
          stepIndex,
          retryCount,
        });

        // Increment retry count for next crash
        // We should persist this increment immediately, but PlanRunner checkpoints anyway.
        // Ideally, we pass this to PlanRunner to persist in the next snapshot.

        const runner = new PlanRunner(streamId, tools);

        // Run in background
        runner.executePlan(plan, stepIndex).catch((error) => {
          logger.error("resumed_plan_failed", {
            streamId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      } else {
        logger.warn("resume_plan_invalid_state", { streamId, state });
      }
    }
  } catch (error) {
    logger.error("resume_interrupted_plans_error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
