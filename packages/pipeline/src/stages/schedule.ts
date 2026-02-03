import { logger } from "@alfred/logger";

import type { PipelineContext, PipelineStage } from "../pipeline";
import type { PlanOutput, ScheduleOutput } from "./types";

import { createEvent } from "../events";

export class ScheduleStage implements PipelineStage<
  PlanOutput,
  ScheduleOutput
> {
  readonly name = "schedule" as const;

  async execute(
    input: PlanOutput,
    ctx: PipelineContext
  ): Promise<ScheduleOutput> {
    const { strategy } = input.structuredPlan.resources;
    const autonomyLevel = ctx.get<number>("autonomyLevel");
    const canParallelize =
      ctx.config.maxParallel > 1 && strategy !== "sequential";
    let executionMode: "parallel" | "sequential" = "sequential";
    if (canParallelize) {
      executionMode = "parallel";
    }
    if (typeof autonomyLevel === "number" && Number.isFinite(autonomyLevel)) {
      if (autonomyLevel < 0.65) {
        executionMode = "sequential";
      }
    }

    ctx.emit(
      createEvent("stage:progress", {
        message: `Scheduling ${input.subtasks.length} subtasks in ${executionMode} mode`,
        stage: "schedule",
      })
    );

    // Import dynamically to avoid circular dependencies
    const { planToWaves } = await import("@alfred/plan/generate");

    const plannedWaves = planToWaves(input.structuredPlan, {
      forceSequential: executionMode === "sequential",
      maxConcurrency: ctx.config.maxParallel,
    });

    // Estimate duration (rough heuristic: 2min per agent sequential, 1min parallel)
    const totalAgents = plannedWaves.reduce(
      (sum, w) => sum + w.agents.length,
      0
    );
    const estimatedDuration =
      executionMode === "sequential"
        ? totalAgents * 120_000
        : plannedWaves.length * 120_000;

    logger.info("schedule_stage_complete", {
      executionMode,
      runId: ctx.runId,
      totalAgents,
      waveCount: plannedWaves.length,
    });

    return {
      estimatedDuration,
      executionMode,
      waves: plannedWaves,
    };
  }
}
