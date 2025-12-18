import { recordAudit } from "@alfred/agent/utils/audit";
import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";

export type Lifecycle = {
  closeTimer: (status: "ok" | "error" | "cancel") => void;
  emitCompleteOnce: () => void;
  isCompleted: () => boolean;
  markCancelled: (runId: string | null) => Promise<void>;
  markSuspended: (runId: string | null) => Promise<void>;
  markCompleted: (runId: string | null) => Promise<void>;
  markFailed: (args: {
    runId: string | null;
    error: unknown;
    input: Pick<WorkflowInputPayload, "auto" | "mode">;
    notifyLinearFailure: (reason: string) => Promise<void>;
    emitError: (error: unknown) => void;
  }) => Promise<void>;
};

export function createLifecycle(args: {
  userId: string;
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
        status: "cancelled",
        completedAt: new Date(),
      });
      await recordAudit({
        userId: args.userId,
        action: "workflow.stream.cancel",
        resource: { kind: "workflow", id: runId },
        decision: "allow",
      });
      args.triggerPreferenceRefresh(args.userId, {
        reason: "workflow_stream_cancelled",
      });
    } catch (error) {
      logger.warn("workflow_cancellation_update_failed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
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
        status: "suspended",
        completedAt: undefined,
      });
      await recordAudit({
        userId: args.userId,
        action: "workflow.stream.suspend",
        resource: { kind: "workflow", id: runId },
        decision: "allow",
      });
      args.triggerPreferenceRefresh(args.userId, {
        reason: "workflow_stream_suspended",
      });
    } catch (error) {
      logger.warn("workflow_suspension_update_failed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    args.recordEvent("complete");
    closeTimer("ok");
    emitCompleteOnce();
  };

  const markCompleted = async (runId: string | null) => {
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
      });
      await recordAudit({
        userId: args.userId,
        action: "workflow.stream.complete",
        resource: { kind: "workflow", id: runId },
        decision: "allow",
      });
      args.triggerPreferenceRefresh(args.userId, {
        reason: "workflow_stream_complete",
      });
    } catch (error) {
      logger.warn("workflow_completion_update_failed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
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
  }) => {
    if (finalizeState) {
      return;
    }
    finalizeState = "failed";

    if (runId) {
      try {
        await recordAudit({
          userId: args.userId,
          action: "workflow.stream.fail",
          resource: { kind: "workflow", id: runId },
          decision: "allow",
          context: {
            auto: input.auto,
            mode: input.mode,
            message: error instanceof Error ? error.message : String(error),
          },
        });
      } catch (auditError) {
        logger.warn("workflow_failure_audit_failed", {
          runId,
          error:
            auditError instanceof Error
              ? auditError.message
              : String(auditError),
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
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      } catch (updateError) {
        logger.warn("workflow_error_status_update_failed", {
          runId,
          error:
            updateError instanceof Error
              ? updateError.message
              : String(updateError),
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
    markSuspended,
    markCompleted,
    markFailed,
  };
}
