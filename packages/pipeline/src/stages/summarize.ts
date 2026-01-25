import { logger } from "@alfred/logger";

import type { PipelineContext, PipelineStage } from "../pipeline";
import type {
  AgentOutcome,
  ATIFTrajectory,
  ExecuteOutput,
  LearnOutput,
  SummarizeOutput,
} from "./types";

import { createEvent } from "../events";

export class SummarizeStage implements PipelineStage<
  LearnOutput,
  SummarizeOutput
> {
  readonly name = "summarize" as const;

  async execute(
    _input: LearnOutput,
    ctx: PipelineContext
  ): Promise<SummarizeOutput> {
    ctx.emit(
      createEvent("stage:progress", {
        message: "Generating execution summary",
        stage: "summarize",
      })
    );

    // Import dynamically to avoid circular dependencies
    const { generateWaveSummary } =
      await import("@alfred/runtime/orchestrator/summary");

    // Get outcomes and file changes from context
    const executeOutput = ctx.get<ExecuteOutput>("executeOutput");
    const outcomes: AgentOutcome[] = executeOutput
      ? [...executeOutput.outcomes.values()]
      : [];

    const fileChanges = executeOutput
      ? {
          created: executeOutput.fileChanges
            .filter((fc) => fc.action === "create")
            .map((fc) => fc.path),
          deleted: executeOutput.fileChanges
            .filter((fc) => fc.action === "delete")
            .map((fc) => fc.path),
          modified: executeOutput.fileChanges
            .filter((fc) => fc.action === "modify")
            .map((fc) => fc.path),
        }
      : { created: [], deleted: [], modified: [] };

    // Generate summary using actual function
    const summary = await generateWaveSummary(outcomes, fileChanges);

    // Build ATIF trajectory (simplified for now)
    const trajectory: ATIFTrajectory = {
      runId: ctx.runId,
      stages: [], // Will be populated from context storage in future iterations
    };

    // Update Linear if configured
    let linearUpdated = false;
    if (ctx.config.enableLinearSync) {
      try {
        const linearIssueId = ctx.get<string>("linearIssueId");
        if (linearIssueId) {
          // Linear update happens via observer, mark as updated
          linearUpdated = true;
        }
      } catch (error) {
        logger.warn("linear_summary_update_failed", {
          error: error instanceof Error ? error.message : String(error),
          runId: ctx.runId,
        });
      }
    }

    logger.info("summarize_stage_complete", {
      linearUpdated,
      runId: ctx.runId,
      summaryLength: summary.length,
    });

    return {
      linearUpdated,
      summary,
      trajectory,
    };
  }
}
