import { recordAudit } from "@alfred/agent/utils/audit";
import { type WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import { type StructuredPlan } from "@alfred/plan";

export interface Lifecycle {
  closeTimer: (status: "ok" | "error" | "cancel") => void;
  emitCompleteOnce: () => void;
  isCompleted: () => boolean;
  markCancelled: (runId: string | null) => Promise<void>;
  markSuspended: (runId: string | null) => Promise<void>;
  markCompleted: (runId: string | null, summary?: string) => Promise<void>;
  markFailed: (args: {
    runId: string | null;
    error: unknown;
    input: Pick<WorkflowInputPayload, "auto" | "mode">;
    notifyLinearFailure: (reason: string) => Promise<void>;
    emitError: (error: unknown) => void;
    summary?: string;
  }) => Promise<void>;
}

export function createLifecycle(args: {
  userId: string;
  projectId?: string;
  stopStreamTimer: (labels: { status: "ok" | "error" | "cancel" }) => void;
  recordEvent: (
    event: "run" | "chunk" | "progress" | "error" | "complete" | "cancel"
  ) => void;
  triggerPreferenceRefresh: (
    userId: string,
    payload: { reason: string }
  ) => void;
  emitComplete: () => void;
}): Lifecycle {
  let timerClosed = false;
  let completed = false;
  let finalizeState: "cancelled" | "suspended" | "completed" | "failed" | null =
    null;

  const closeTimer = (status: "ok" | "error" | "cancel") => {
    if (timerClosed) {
      return;
    }
    args.stopStreamTimer({ status });
    timerClosed = true;
  };

  const emitCompleteOnce = () => {
    if (completed) {
      return;
    }
    completed = true;
    args.emitComplete();
  };

  const isCompleted = () => completed;

  const markCancelled = async (runId: string | null) => {
    if (!runId) {
      return;
    }
    if (finalizeState) {
      return;
    }
    finalizeState = "cancelled";
    try {
      await workflowRepo.updateRun(runId, {
        completedAt: new Date(),
        status: "cancelled",
      });
      await recordAudit({
        action: "workflow.stream.cancel",
        decision: "allow",
        projectId: args.projectId,
        resource: { kind: "workflow", id: runId },
        userId: args.userId,
      });
      args.triggerPreferenceRefresh(args.userId, {
        reason: "workflow_stream_cancelled",
      });
    } catch (error) {
      logger.warn("workflow_cancellation_update_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId,
      });
    }
    args.recordEvent("cancel");
    closeTimer("cancel");
    emitCompleteOnce();
  };

  const markSuspended = async (runId: string | null) => {
    if (!runId) {
      return;
    }
    if (finalizeState) {
      return;
    }
    finalizeState = "suspended";
    try {
      await workflowRepo.updateRun(runId, {
        completedAt: undefined,
        status: "suspended",
      });
      await recordAudit({
        action: "workflow.stream.suspend",
        decision: "allow",
        projectId: args.projectId,
        resource: { kind: "workflow", id: runId },
        userId: args.userId,
      });
      args.triggerPreferenceRefresh(args.userId, {
        reason: "workflow_stream_suspended",
      });
    } catch (error) {
      logger.warn("workflow_suspension_update_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId,
      });
    }
    args.recordEvent("complete");
    closeTimer("ok");
    emitCompleteOnce();
  };

  const markCompleted = async (runId: string | null, summary?: string) => {
    if (!runId) {
      return;
    }
    if (finalizeState) {
      return;
    }
    finalizeState = "completed";
    try {
      await workflowRepo.updateRun(runId, {
        status: "completed",
        completedAt: new Date(),
        // Store summary in stateData for later retrieval if needed
        stateData: summary ? { executionSummary: summary } : undefined,
      });
      await recordAudit({
        action: "workflow.stream.complete",
        decision: "allow",
        projectId: args.projectId,
        resource: { kind: "workflow", id: runId },
        userId: args.userId,
      });
      args.triggerPreferenceRefresh(args.userId, {
        reason: "workflow_stream_complete",
      });
    } catch (error) {
      logger.warn("workflow_completion_update_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId,
      });
    }

    // Trigger Pattern Learning (Success)
    if (runId) {
      void (async () => {
        try {
          const run = await workflowRepo.getRun(runId);
          if (run?.status === "completed") {
            const inputData = run.inputData as Record<string, unknown>;
            const planId = inputData?.planId as string | undefined;
            if (planId) {
              const { getPlanById } = await import("@alfred/db/repo/plan");
              const savedPlan = await getPlanById(planId);
              if (savedPlan) {
                const { structuredPlanSchema } = await import("@alfred/plan");
                const parsed = structuredPlanSchema.safeParse(savedPlan.plan);
                if (!parsed.success) {
                  logger.warn("pattern_extraction_plan_invalid", {
                    planId,
                    runId,
                  });
                  return;
                }
                const plan = parsed.data as StructuredPlan;
                const { extractPatternFromRun } =
                  await import("@alfred/plan/pattern");
                await extractPatternFromRun(
                  {
                    completedAt: run.completedAt,
                    created: run.created,
                    id: run.id,
                    projectId: run.projectId,
                    status: run.status,
                    userId: run.userId,
                  },
                  plan
                );

                // Trigger Convention Learning
                if (run.projectId) {
                  const { learnProjectConventions } =
                    await import("@alfred/plan/project");
                  await learnProjectConventions(
                    {
                      completedAt: run.completedAt,
                      created: run.created,
                      id: run.id,
                      projectId: run.projectId,
                      status: run.status,
                      userId: run.userId,
                    },
                    run.projectId,
                    summary ?? savedPlan.intent ?? ""
                  );
                }
              }
            }
          }
        } catch (error) {
          logger.warn("pattern_extraction_failed", {
            error: error instanceof Error ? error.message : String(error),
            runId,
          });
        }
      })();
    }

    args.recordEvent("complete");
    closeTimer("ok");
    emitCompleteOnce();
  };

  const markFailed: Lifecycle["markFailed"] = async ({
    runId,
    error,
    input,
    notifyLinearFailure,
    emitError,
    summary,
  }) => {
    if (finalizeState) {
      return;
    }
    finalizeState = "failed";

    if (runId) {
      try {
        await recordAudit({
          action: "workflow.stream.fail",
          context: {
            auto: input.auto,
            mode: input.mode,
            message: error instanceof Error ? error.message : String(error),
          },
          decision: "allow",
          projectId: args.projectId,
          resource: { kind: "workflow", id: runId },
          userId: args.userId,
        });
      } catch (error) {
        logger.warn("workflow_failure_audit_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await notifyLinearFailure(
      error instanceof Error ? error.message : String(error)
    );
    args.recordEvent("error");
    closeTimer("error");
    if (runId) {
      try {
        await workflowRepo.updateRun(runId, {
          errorMessage: error instanceof Error ? error.message : String(error),
          stateData: summary ? { executionSummary: summary } : undefined,
          status: "failed",
        });

        // Trigger Anti-Pattern Learning (Failure)
        void (async () => {
          try {
            const run = await workflowRepo.getRun(runId);
            if (run?.status === "failed") {
              const inputData = run.inputData as Record<string, unknown>;
              const planId = inputData?.planId as string | undefined;
              if (planId) {
                const { getPlanById } = await import("@alfred/db/repo/plan");
                const savedPlan = await getPlanById(planId);
                if (savedPlan) {
                  const { structuredPlanSchema } = await import("@alfred/plan");
                  const parsed = structuredPlanSchema.safeParse(savedPlan.plan);
                  if (!parsed.success) {
                    logger.warn("anti_pattern_extraction_plan_invalid", {
                      planId,
                      runId,
                    });
                    return;
                  }
                  const plan = parsed.data as StructuredPlan;
                  const { extractAntiPatternFromRun } =
                    await import("@alfred/plan/pattern");
                  await extractAntiPatternFromRun(
                    {
                      completedAt: run.completedAt,
                      created: run.created,
                      id: run.id,
                      projectId: run.projectId,
                      status: run.status,
                      userId: run.userId,
                    },
                    plan,
                    summary ??
                      (error instanceof Error ? error.message : String(error))
                  );
                }
              }
            }
          } catch (error) {
            logger.warn("anti_pattern_extraction_failed", {
              runId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();
      } catch (error) {
        logger.warn("workflow_error_status_update_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    emitError(error);
  };

  return {
    closeTimer,
    emitCompleteOnce,
    isCompleted,
    markCancelled,
    markCompleted,
    markFailed,
    markSuspended,
  };
}
