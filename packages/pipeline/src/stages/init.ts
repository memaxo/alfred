import { logger } from "@alfred/logger";
import { detectProject } from "@alfred/plan";
import { createEvent } from "../events";
import type { PipelineContext, PipelineStage } from "../pipeline";
import type { InitOutput, PipelineInput } from "./types";

export class InitStage implements PipelineStage<PipelineInput, InitOutput> {
  readonly name = "init" as const;

  async execute(
    input: PipelineInput,
    ctx: PipelineContext
  ): Promise<InitOutput> {
    ctx.emit(
      createEvent("stage:progress", {
        stage: "init",
        message: "Detecting project and initializing inputs",
      })
    );

    // Detect or create project
    let projectId: string;
    try {
      const project = await detectProject(ctx.workspace, ctx.userId);
      projectId = project.id;
      ctx.set("projectId", projectId);
    } catch (error) {
      logger.warn("project_detection_failed", {
        runId: ctx.runId,
        error: error instanceof Error ? error.message : String(error),
      });
      projectId = ctx.runId; // Fallback to runId
    }

    // Initialize Linear integration if configured
    const linearProjectId =
      input.linear && ctx.config.enableLinearSync
        ? input.linear.space
        : undefined;
    const linearIssueId =
      input.linear && ctx.config.enableLinearSync
        ? input.linear.issueId
        : undefined;

    if (input.linear && ctx.config.enableLinearSync) {
      ctx.set("linearIssueId", linearIssueId ?? null);
      ctx.set("linearSessionId", input.linear.sessionId);
      ctx.set("linearSpace", input.linear.space);
      ctx.set("linearTeamId", input.linear.teamId ?? null);
    }

    return {
      projectId,
      linearProjectId,
      linearIssueId,
    };
  }
}
