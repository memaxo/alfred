import * as projectRepo from "@alfred/db/repo/project";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProjectLifecycleSchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  batchSize?: number;
  archiveAfterDays?: number;
  logger?: Pick<Console, "info" | "warn" | "error">;
}

let schedulerHandle: NodeJS.Timeout | null = null;
let running = false;

async function tick(options: Required<ProjectLifecycleSchedulerOptions>) {
  if (running) {
    options.logger.warn?.("project_lifecycle_tick_skipped_busy");
    return;
  }

  running = true;
  try {
    const staleIds = await projectRepo.listInactiveProjectIds({
      olderThanMs: options.archiveAfterDays * DAY_MS,
      limit: options.batchSize,
    });

    if (staleIds.length === 0) {
      return;
    }

    for (const id of staleIds) {
      try {
        await projectRepo.archiveProject(id, "inactive");
      } catch (error) {
        options.logger.warn?.("project_archive_failed", {
          id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    options.logger.info?.("project_archived", { count: staleIds.length });
  } finally {
    running = false;
  }
}

export function startProjectLifecycleScheduler({
  intervalMs = 12 * 60 * 60 * 1000,
  jitterMs = 5 * 60 * 1000,
  batchSize = 100,
  archiveAfterDays = 30,
  logger = console,
}: ProjectLifecycleSchedulerOptions = {}) {
  if (process.env.SCHED_PROJECT_LIFECYCLE !== "1") {
    logger.info?.(
      "project_lifecycle_scheduler_disabled",
      "Set SCHED_PROJECT_LIFECYCLE=1 to enable"
    );
    return;
  }

  if (schedulerHandle) {
    logger.warn?.("project_lifecycle_scheduler_already_running");
    return;
  }

  const run = () =>
    tick({ intervalMs, jitterMs, batchSize, archiveAfterDays, logger });

  const scheduleNext = () => {
    const delay = intervalMs + Math.random() * jitterMs;
    schedulerHandle = setTimeout(async () => {
      await run();
      scheduleNext();
    }, delay);
    schedulerHandle.unref();
  };

  void run().then(scheduleNext, (error) => {
    logger.error?.("project_lifecycle_scheduler_start_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleNext();
  });
}

export function stopProjectLifecycleScheduler() {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}
