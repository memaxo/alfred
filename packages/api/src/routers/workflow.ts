import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, rateLimit, router } from "../trpc";
import { toTRPCError } from "../utils/error";
import { workflowCompilationRouter } from "./workflow/compilation";
import { workflowPhaseApproveAndExecuteProcedure } from "./workflow/phase/approve";
import {
  workflowPhaseExecuteByRunIdProcedure,
  workflowPhaseExecuteProcedure,
} from "./workflow/phase/execute";
import { workflowPhaseGetPlanProcedure } from "./workflow/phase/get";
import {
  workflowPhaseCachedPlanProcedure,
  workflowPhasePlanProcedure,
  workflowPhaseStreamPlanProcedure,
} from "./workflow/phase/plan";
import { workflowPhaseStatusProcedure } from "./workflow/phase/status";
import {
  workflowPhaseApplyTemplateProcedure,
  workflowPhaseListTemplatesProcedure,
  workflowPhaseSaveAsTemplateProcedure,
} from "./workflow/phase/template";
import { workflowPhaseUpdatePlanProcedure } from "./workflow/phase/update";
import { workflowReasoningProcedure } from "./workflow/reasoning";
import { workflowReplayProcedure } from "./workflow/replay";
import { workflowResumePipelineProcedure } from "./workflow/resume";
import {
  workflowEventsProcedure,
  workflowListRunsProcedure,
} from "./workflow/runs";
import { workflowStartProcedure } from "./workflow/start";
import { workflowStreamPipelineProcedure } from "./workflow/stream";

/**
 * Phase-level workflow APIs for staged execution control.
 * Enables plan preview, human-in-the-loop review, and staged execution.
 */
const workflowPhaseRouter = router({
  /**
   * Run init → context → plan → schedule stages only.
   * Returns WavePlan[] and snapshot for later execution.
   */
  plan: workflowPhasePlanProcedure,

  /**
   * Execute a previously planned workflow.
   * Takes WavePlan[] and runs execute → review → learn → summarize.
   */
  execute: workflowPhaseExecuteProcedure,

  /**
   * Execute a workflow run by runId only.
   * Derives execute inputs from the persisted snapshot context.
   */
  executeByRunId: workflowPhaseExecuteByRunIdProcedure,

  /**
   * Stream plan-only pipeline events.
   */
  streamPlan: workflowPhaseStreamPlanProcedure,

  /**
   * Get current phase status for a run.
   */
  status: workflowPhaseStatusProcedure,

  /**
   * Load a persisted plan by runId.
   * Returns the same shape as `phase.plan` (PlanPhaseOutput).
   */
  getPlan: workflowPhaseGetPlanProcedure,

  /**
   * Check whether a plan is available in Redis cache.
   * Returns the cached plan (if present) plus the cache key.
   */
  cachedPlan: workflowPhaseCachedPlanProcedure,

  /**
   * Update an existing plan with modified subtasks.
   * Optionally regenerate waves based on new dependencies.
   */
  updatePlan: workflowPhaseUpdatePlanProcedure,

  /**
   * Approve a planned workflow and transition the run to executable state.
   * Execution itself is performed via `workflow.resumePipeline` (streaming).
   */
  approveAndExecute: workflowPhaseApproveAndExecuteProcedure,

  /**
   * Save current plan as a reusable template.
   */
  saveAsTemplate: workflowPhaseSaveAsTemplateProcedure,

  /**
   * List user's plan templates.
   */
  listTemplates: workflowPhaseListTemplatesProcedure,

  /**
   * Apply template to a new requirement.
   */
  applyTemplate: workflowPhaseApplyTemplateProcedure,
});

export const workflowRouter = router({
  // Phase-level APIs for staged execution
  phase: workflowPhaseRouter,

  compilation: workflowCompilationRouter,

  start: workflowStartProcedure,

  streamPipeline: workflowStreamPipelineProcedure,

  resume: authedProcedure
    .use(rateLimit)
    .input(
      z.object({
        runId: z.string().min(1),
        clarificationId: z.string().uuid().optional(), // New: resume from clarification
        response: z.string().optional(), // New: response to clarification
        event: z
          .enum([
            "deploy-authz",
            "linear-authz",
            "bio-authz",
            "mfa-authz",
            "human-authz",
          ])
          .optional(),
        authz: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      // Handle clarification resume
      if (input.clarificationId && input.response) {
        try {
          const { resumeWorkflowAfterClarification } = await import(
            "@alfred/runtime/orchestrator/resume"
          );
          await resumeWorkflowAfterClarification(
            input.runId,
            input.clarificationId,
            input.response
          );
          return { ok: true };
        } catch (error) {
          throw toTRPCError(error, "workflow_resume_failed");
        }
      }

      // Handle existing obligation resume
      if (input.event && input.authz) {
        try {
          const { runRegistry } = await import(
            "@alfred/agent/workflow/registry"
          );
          const delivered = await runRegistry.dispatchResume(input.runId, {
            event: input.event,
            authz: input.authz,
          });

          if (!delivered) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "run_not_found",
            });
          }
        } catch (error) {
          const { StreamNotAttachedError } = await import(
            "@alfred/agent/workflow/session-recovery"
          );
          if (error instanceof StreamNotAttachedError) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "stream_not_attached",
            });
          }
          throw toTRPCError(error, "workflow_resume_failed");
        }
        {
          const run = await workflowRepo.getRun(input.runId);
          const { recordAudit } = await import("@alfred/agent/utils/audit");
          await recordAudit({
            userId: session.user.id,
            projectId: run?.projectId ?? undefined,
            action: "workflow.resume",
            resource: { kind: "workflow", id: input.runId },
            decision: "allow",
            context: { event: input.event },
          });
        }
        return { ok: true };
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "invalid_resume_payload",
      });
    }),

  get: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input }) => {
      const run = await workflowRepo.getRun(input.runId);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      return run;
    }),

  cancel: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const run = await workflowRepo.getRun(input.runId);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      if (run.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "not_owner" });
      }
      if (run.status !== "running" && run.status !== "suspended") {
        return { cancelled: false, reason: "already_finished" };
      }
      // Cancel via registry if still active
      const { runRegistry } = await import("@alfred/agent/workflow/registry");
      const handle = (
        runRegistry as { runs?: Map<string, { cancel: () => void }> }
      ).runs?.get(input.runId);
      if (handle) {
        try {
          await handle.cancel();
        } catch {
          // Ignore cancel errors - run may have already completed
        }
      }
      // Update status in DB
      await workflowRepo.updateRun(input.runId, {
        status: "cancelled",
        completedAt: new Date(),
      });
      logger.info("workflow_cancelled", {
        runId: input.runId,
        userId: ctx.session.user.id,
      });
      return { cancelled: true };
    }),

  events: workflowEventsProcedure,

  reasoning: workflowReasoningProcedure,

  listRuns: workflowListRunsProcedure,

  replay: workflowReplayProcedure,

  suspend: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { runRegistry } = await import("@alfred/agent/workflow/registry");
      const delivered = await runRegistry.dispatchSuspend(input.runId);
      if (delivered) {
        return { ok: true };
      }
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "run_not_found_or_not_suspendable",
      });
    }),

  resumePipeline: workflowResumePipelineProcedure,
});
