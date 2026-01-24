import { logger } from "@alfred/logger";

import { createEvent } from "../events";
import { type PipelineContext, type PipelineStage } from "../pipeline";
import { type LearnOutput, type ReviewOutput } from "./types";

export class LearnStage implements PipelineStage<ReviewOutput, LearnOutput> {
  readonly name = "learn" as const;

  async execute(
    _input: ReviewOutput,
    ctx: PipelineContext
  ): Promise<LearnOutput> {
    if (!ctx.config.enableLearning) {
      return {
        graphUpdates: 0,
        insights: [],
        mistakes: [],
      };
    }

    ctx.emit(
      createEvent("stage:progress", {
        message: "Learning worker will process run asynchronously",
        stage: "learn",
      })
    );

    // Learning is polling-based via background worker, not on-demand
    // The learning worker polls for completed runs and extracts knowledge
    // We just ensure the worker is started; it will process this run when ready
    try {
      // Import dynamically to avoid circular dependencies
      const { startLearningWorker } =
        await import("@alfred/agent/orchestrator/learning-worker");

      startLearningWorker({
        enabled: true,
        intervalMs: 60_000, // Check every minute
        batchSize: 10,
      });

      logger.info("learn_stage_complete", {
        message: "Learning worker will process run asynchronously",
        runId: ctx.runId,
      });

      // Return empty results since learning happens asynchronously
      // The worker will process this run and update the knowledge graph
      return {
        graphUpdates: 0,
        insights: [],
        mistakes: [],
      };
    } catch (error) {
      logger.warn("learning_worker_start_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId: ctx.runId,
      });

      return {
        graphUpdates: 0,
        insights: [],
        mistakes: [],
      };
    }
  }
}
