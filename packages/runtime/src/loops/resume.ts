import { cognitiveRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import { AISDKAdapter } from "../adapters/ai";
import { PlanRunner } from "./plan-runner";

/**
 * Resume interrupted plans from database snapshots
 *
 * Checks for streams that were in 'executing' state but stopped.
 * Restarts PlanRunner for those streams.
 */
export async function resumeInterruptedPlans() {
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
    const ai = new AISDKAdapter({ runId: "resume-worker" });

    const ctx: RuntimeContext = {
      ai: ai as any, // cast to AIAdapter interface
      // Mock other required fields if necessary
    } as unknown as RuntimeContext;

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
        logger.info("resume_plan_execution", { streamId, stepIndex });

        const runner = new PlanRunner(ctx, ai as any, streamId);

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
