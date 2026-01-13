import { logger } from "@alfred/logger";
import { createEvent } from "../events";
import type { PipelineContext, PipelineStage } from "../pipeline";
import type { ExecuteOutput, ReviewCheck, ReviewOutput } from "./types";

export class ReviewStage implements PipelineStage<ExecuteOutput, ReviewOutput> {
  readonly name = "review" as const;

  async execute(input: ExecuteOutput, ctx: PipelineContext): Promise<ReviewOutput> {
    ctx.emit(
      createEvent("stage:progress", {
        stage: "review",
        message: "Running quality checks",
      })
    );

    const checks: ReviewCheck[] = [];
    let allPassed = true;
    const fixAttempts = 0;

    try {
      // Simplified review: check if all agents succeeded
      for (const outcome of input.outcomes.values()) {
        const check: ReviewCheck = {
          name: `Agent ${outcome.agentId}`,
          passed: outcome.status === "success",
          message: outcome.escalation ?? outcome.result?.summary,
        };
        checks.push(check);
        if (!check.passed) {
          allPassed = false;
        }

        // Emit individual check results
        ctx.emit(createEvent("review:check", { check }));
      }

      // Additional quality checks could be added here:
      // - Linting
      // - Type checking
      // - Test execution
      // - Security scans

      logger.info("review_stage_complete", {
        runId: ctx.runId,
        allPassed,
        fixAttempts,
        checkCount: checks.length,
      });
    } catch (error) {
      logger.error("review_phase_failed", {
        runId: ctx.runId,
        error: error instanceof Error ? error.message : String(error),
      });
      allPassed = false;
    }

    return {
      checks,
      allPassed,
      fixAttempts,
    };
  }
}
