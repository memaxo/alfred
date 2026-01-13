import { logger } from "@alfred/logger";
import { createEvent } from "../events";
import type { PipelineContext, PipelineStage } from "../pipeline";
import type { PlanOutput, ScheduleOutput } from "./types";

export class ScheduleStage
  implements PipelineStage<PlanOutput, ScheduleOutput>
{
  readonly name = "schedule" as const;

  async execute(
    input: PlanOutput,
    ctx: PipelineContext
  ): Promise<ScheduleOutput> {
    const executionMode =
      ctx.config.maxParallel > 1 ? "parallel" : "sequential";

    ctx.emit(
      createEvent("stage:progress", {
        stage: "schedule",
        message: `Scheduling ${input.subtasks.length} subtasks in ${executionMode} mode`,
      })
    );

    // Import dynamically to avoid circular dependencies
    const { planWaves } = await import(
      "@alfred/agent/orchestrator/multi/spawn"
    );

    // Use existing wave planning
    const plannedWaves = planWaves(input.subtasks, {
      maxParallel: ctx.config.maxParallel,
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
      runId: ctx.runId,
      waveCount: plannedWaves.length,
      totalAgents,
      executionMode,
    });

    return {
      waves: plannedWaves,
      executionMode,
      estimatedDuration,
    };
  }
}
