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
        message: "Detecting project and initializing Linear integration",
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
    let linearProjectId: string | undefined;
    let linearIssueId: string | undefined;

    if (input.linear && ctx.config.enableLinearSync) {
      try {
        // Import dynamically to avoid circular dependencies
        const { ensureLinearTicket } = await import(
          "@alfred/agent/workflow/linear"
        );

        const ticketResult = await ensureLinearTicket({
          linear: input.linear,
          authzLinear: input.linear.authz,
          requirement: ctx.requirement,
        });

        linearIssueId = ticketResult.ticket?.issueId;
        linearProjectId = ticketResult.linear?.space;

        ctx.set("linearIssueId", linearIssueId);
        ctx.set("linearSessionId", input.linear.sessionId);

        ctx.emit(
          createEvent("stage:progress", {
            stage: "init",
            message: `Linear issue ${linearIssueId ?? "created"}`,
          })
        );
      } catch (error) {
        logger.warn("linear_init_failed", {
          runId: ctx.runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      projectId,
      linearProjectId,
      linearIssueId,
    };
  }
}
