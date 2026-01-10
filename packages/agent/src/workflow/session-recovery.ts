import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import type { RunHandle } from "./registry";
import { runRegistry } from "./registry";

const DEFAULT_RECOVERY_LIMIT = Math.max(
  1,
  Number(process.env.WORKFLOW_RECOVERY_MAX ?? "200")
);

const DEFAULT_RUNNING_GRACE_MS = Math.max(
  0,
  Number(process.env.WORKFLOW_RUNNING_RECOVERY_GRACE_MS ?? "60000")
);

type PlaceholderHandle = RunHandle & { __placeholder: true };

const placeholderHandles = new Map<string, PlaceholderHandle>();

export class StreamNotAttachedError extends Error {
  code = "stream_not_attached" as const;

  declare runId: string;

  constructor(runId: string) {
    super("workflow_stream_required");
    this.name = "StreamNotAttachedError";
    this.runId = runId;
  }
}

function createPlaceholderHandle(runId: string): PlaceholderHandle {
  const abortController = new AbortController();

  const handle: PlaceholderHandle = {
    __placeholder: true,
    abortController,
    async resume() {
      throw new StreamNotAttachedError(runId);
    },
    async cancel() {
      abortController.abort();
      try {
        await workflowRepo.updateRun(runId, {
          status: "cancelled",
          completedAt: new Date(),
          errorMessage: "cancelled_during_recovery",
        });
      } catch (error) {
        logger.warn("workflow_recovery_cancel_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };

  return handle;
}

export async function rehydrateSuspendedRuns(options?: {
  limit?: number;
}): Promise<void> {
  const limit = Math.max(1, options?.limit ?? DEFAULT_RECOVERY_LIMIT);

  try {
    const runs = await workflowRepo.listRunsByStatuses(["suspended"], {
      limit,
      order: "asc",
    });

    if (runs.length === 0) {
      return;
    }

    for (const run of runs) {
      if (!run?.id || placeholderHandles.has(run.id)) {
        continue;
      }
      const handle = createPlaceholderHandle(run.id);
      placeholderHandles.set(run.id, handle);
      try {
        await runRegistry.register(run.id, handle);
      } catch (error) {
        placeholderHandles.delete(run.id);
        logger.warn("workflow_rehydrate_register_failed", {
          runId: run.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("workflow_rehydrate_complete", {
      recoveredRuns: runs.length,
    });
  } catch (error) {
    logger.error("workflow_rehydrate_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function failOrphanedRunningRuns(options?: {
  limit?: number;
  graceMs?: number;
  now?: number;
}): Promise<void> {
  const backend = (process.env.RUN_REGISTRY_BACKEND ?? "memory").toLowerCase();
  // In Redis mode, another instance may legitimately own an in-flight run, so we
  // default to skipping fail-fast cleanup unless explicitly enabled later.
  if (backend === "redis") {
    return;
  }

  const limit = Math.max(1, options?.limit ?? DEFAULT_RECOVERY_LIMIT);
  const graceMs = Math.max(0, options?.graceMs ?? DEFAULT_RUNNING_GRACE_MS);
  const now = options?.now ?? Date.now();

  try {
    const runs = await workflowRepo.listRunsByStatuses(["running"], {
      limit,
      order: "asc",
    });

    if (runs.length === 0) {
      return;
    }

    let failed = 0;
    for (const run of runs) {
      if (!run?.id) {
        continue;
      }
      const createdAt = run.created?.getTime?.();
      if (typeof createdAt === "number" && now - createdAt < graceMs) {
        continue;
      }

      try {
        await workflowRepo.updateRun(run.id, {
          status: "failed",
          completedAt: new Date(now),
          errorMessage: "workflow_interrupted_restart",
        });
        failed += 1;
      } catch (error) {
        logger.warn("workflow_running_recovery_failed", {
          runId: run.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (failed > 0) {
      logger.info("workflow_running_recovery_complete", { failed });
    }
  } catch (error) {
    logger.error("workflow_running_recovery_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function registerRunHandle(
  runId: string,
  handle: RunHandle
): Promise<void> {
  if (placeholderHandles.has(runId)) {
    placeholderHandles.delete(runId);
  }
  await runRegistry.register(runId, handle);
}

export async function unregisterRunHandle(runId: string): Promise<void> {
  placeholderHandles.delete(runId);
  await runRegistry.unregister(runId);
}

export function __resetWorkflowRecoveryStateForTests() {
  placeholderHandles.clear();
}
