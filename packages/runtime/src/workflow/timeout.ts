import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";

import type { Lifecycle } from "./lifecycle";

export function startTimeout(args: {
  ms: number;
  lifecycle: Pick<Lifecycle, "isCompleted" | "closeTimer">;
  recordEvent: (
    event: "run" | "chunk" | "progress" | "error" | "complete" | "cancel"
  ) => void;
  abortController: AbortController;
  markCancelled: () => void;
  getRunId: () => string | null;
  emitError: (error: unknown) => void;
}): { stop: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (!timeoutId) {
      return;
    }
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  timeoutId = setTimeout(() => {
    if (args.lifecycle.isCompleted()) {
      return;
    }
    args.markCancelled();
    args.abortController.abort();
    const runId = args.getRunId();
    logger.error("workflow_global_timeout", { runId: runId ?? "unknown" });
    args.recordEvent("error");
    args.lifecycle.closeTimer("error");
    if (runId) {
      workflowRepo
        .updateRun(runId, {
          status: "failed",
          completedAt: new Date(),
          errorMessage: "workflow_global_timeout",
        })
        .catch((error) => {
          logger.warn("workflow_timeout_update_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }
    try {
      args.emitError(new Error("workflow_global_timeout"));
    } catch (error) {
      logger.error("workflow_timeout_emit_error_failed", {
        runId: runId ?? "unknown",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, args.ms);

  return { stop };
}
