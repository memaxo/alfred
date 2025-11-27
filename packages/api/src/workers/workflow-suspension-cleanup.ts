import { unregisterRunHandle } from "@alfred/agent/workflow/session-recovery";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import { workflowSuspensionCleanupTotal } from "../metrics";

const MAX_AGE_MS = Number(
  process.env.WORKFLOW_SUSPEND_MAX_AGE_MS ?? 15 * 60 * 1000
);
const BATCH_SIZE = Number(process.env.WORKFLOW_SUSPEND_CLEANUP_BATCH ?? 100);

export async function cleanupSuspendedWorkflows(now: number = Date.now()) {
  const cutoff = new Date(now - MAX_AGE_MS);
  let cleaned = 0;

  while (true) {
    const runs = await workflowRepo.listSuspendedRunsBefore(cutoff, BATCH_SIZE);
    if (runs.length === 0) {
      break;
    }

    for (const run of runs) {
      try {
        await unregisterRunHandle(run.id).catch(() => {});
        await workflowRepo.updateRun(run.id, {
          status: "cancelled",
          completedAt: new Date(),
        });
        await workflowRepo.appendEvent({
          runId: run.id,
          eventType: "suspend",
          eventData: {
            reason: "suspension_timeout",
          },
        });
        workflowSuspensionCleanupTotal.labels("timeout").inc();
        cleaned += 1;
      } catch (error) {
        logger.warn("workflow_suspension_cleanup_failed", {
          runId: run.id,
          error: error instanceof Error ? error.message : String(error),
        });
        workflowSuspensionCleanupTotal.labels("error").inc();
      }
    }

    if (runs.length < BATCH_SIZE) {
      break;
    }
  }

  return cleaned;
}

if (import.meta.main) {
  cleanupSuspendedWorkflows()
    .then((count) => {
      logger.info("workflow_suspension_cleanup_complete", { count });
      // eslint-disable-next-line no-process-exit -- CLI utility
      process.exit(0);
    })
    .catch((error) => {
      logger.error("workflow_suspension_cleanup_uncaught", {
        error: error instanceof Error ? error.message : String(error),
      });
      // eslint-disable-next-line no-process-exit -- CLI utility
      process.exit(1);
    });
}
