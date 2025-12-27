/**
 * ALFRED Idle Loop Scheduler
 * Background task processing during user idle time
 */

import {
  getDefaultIdleLoopConfig,
  type IdleLoopConfig,
  processIdleQueue,
} from "@alfred/cognitive/queue";
import * as conversationRepo from "@alfred/db/repo/conversation";
import * as queueRepo from "@alfred/db/repo/queue";
import { logger } from "@alfred/logger";

// ============================================================================
// Types
// ============================================================================

export type IdleLoopSchedulerOptions = {
  intervalMs?: number;
  jitterMs?: number;
  batchSize?: number;
  config?: Partial<IdleLoopConfig>;
  logger?: Pick<Console, "info" | "warn" | "error">;
};

// ============================================================================
// Scheduler State
// ============================================================================

let schedulerHandle: NodeJS.Timeout | null = null;
let running = false;

// ============================================================================
// Scheduler Implementation
// ============================================================================

/**
 * Single tick of the idle loop
 */
async function tick(
  options: Required<Omit<IdleLoopSchedulerOptions, "config">> & {
    config: IdleLoopConfig;
  }
) {
  if (running) {
    options.logger.warn?.(
      "Idle loop tick skipped because previous run is still in progress."
    );
    return;
  }

  running = true;
  const startTime = Date.now();

  try {
    // Get active users who might have pending tasks
    // We use conversation activity as a proxy for "active users"
    const activeUserIds = await conversationRepo.getActiveUserIds({
      days: 7,
      limit: options.batchSize,
    });

    let totalTasksProcessed = 0;
    let totalTasksFailed = 0;

    for (const userId of activeUserIds) {
      try {
        // Check if user has pending tasks
        const counts = await queueRepo.getTaskCounts(userId);
        if (counts.pending === 0) {
          continue;
        }

        // Process idle queue for this user
        const results = await processIdleQueue(userId, options.config);

        for (const result of results) {
          if (result.status === "completed") {
            totalTasksProcessed++;
          } else {
            totalTasksFailed++;
          }
        }
      } catch (error) {
        options.logger.warn?.("idle_loop_user_failed", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const durationMs = Date.now() - startTime;

    if (totalTasksProcessed > 0 || totalTasksFailed > 0) {
      options.logger.info?.("idle_loop_tick_complete", {
        usersChecked: activeUserIds.length,
        tasksProcessed: totalTasksProcessed,
        tasksFailed: totalTasksFailed,
        durationMs,
      });
    }
  } catch (error) {
    options.logger.error?.("idle_loop_tick_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    running = false;
  }
}

/**
 * Start the idle loop scheduler
 */
export function startIdleLoopScheduler({
  intervalMs = 60_000,
  jitterMs = 10_000,
  batchSize = 25,
  config: configOverrides,
  logger: customLogger = console,
}: IdleLoopSchedulerOptions = {}) {
  // Check if enabled via environment
  if (process.env.IDLE_LOOP_ENABLED !== "1") {
    customLogger.info?.(
      "[idle-loop] Scheduler disabled (set IDLE_LOOP_ENABLED=1 to enable)."
    );
    return;
  }

  if (schedulerHandle) {
    customLogger.warn?.("[idle-loop] Scheduler already running.");
    return;
  }

  // Merge config
  const baseConfig = getDefaultIdleLoopConfig();
  const config: IdleLoopConfig = {
    ...baseConfig,
    ...configOverrides,
  };

  customLogger.info?.("[idle-loop] Starting scheduler", {
    intervalMs,
    jitterMs,
    batchSize,
    config,
  });

  const run = () =>
    tick({
      intervalMs,
      jitterMs,
      batchSize,
      config,
      logger: customLogger,
    });

  const scheduleNext = () => {
    const delay = intervalMs + Math.random() * jitterMs;
    schedulerHandle = setTimeout(async () => {
      await run();
      scheduleNext();
    }, delay);
  };

  // Run immediately, then schedule
  void run().then(scheduleNext, (error) => {
    customLogger.error?.("[idle-loop] Initial scheduler run failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleNext();
  });
}

/**
 * Stop the idle loop scheduler
 */
export function stopIdleLoopScheduler() {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
    logger.info("idle_loop_scheduler_stopped");
  }
}

/**
 * Check if scheduler is running
 */
export function isIdleLoopSchedulerRunning(): boolean {
  return schedulerHandle !== null;
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Reset stale running tasks (called periodically)
 */
export function resetStaleTasks(): Promise<number> {
  const staleMinutes = Number.parseInt(
    process.env.IDLE_LOOP_STALE_MINUTES ?? "30",
    10
  );
  return queueRepo.resetStaleTasks(staleMinutes);
}

/**
 * Cleanup old completed tasks (called periodically)
 */
export function cleanupOldTasks(): Promise<number> {
  const retentionDays = Number.parseInt(
    process.env.IDLE_LOOP_RETENTION_DAYS ?? "7",
    10
  );
  return queueRepo.cleanupOldTasks(retentionDays);
}
