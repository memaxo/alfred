import { managePatternLifecycle } from "@alfred/plan/pattern";

export type PatternLifecycleSchedulerOptions = {
  intervalMs?: number;
  jitterMs?: number;
  logger?: Pick<Console, "info" | "warn" | "error">;
};

let schedulerHandle: NodeJS.Timeout | null = null;
let running = false;

async function tick(options: Required<PatternLifecycleSchedulerOptions>) {
  if (running) {
    options.logger.warn?.("pattern_lifecycle_tick_skipped_busy");
    return;
  }

  running = true;
  try {
    await managePatternLifecycle();
    options.logger.info?.("pattern_lifecycle_tick_complete");
  } catch (error) {
    options.logger.error?.("pattern_lifecycle_tick_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    running = false;
  }
}

export function startPatternLifecycleScheduler({
  intervalMs = 12 * 60 * 60 * 1000,
  jitterMs = 5 * 60 * 1000,
  logger = console,
}: PatternLifecycleSchedulerOptions = {}) {
  if (process.env.SCHED_PATTERN_LIFECYCLE !== "1") {
    logger.info?.(
      "pattern_lifecycle_scheduler_disabled",
      "Set SCHED_PATTERN_LIFECYCLE=1 to enable"
    );
    return;
  }

  if (schedulerHandle) {
    logger.warn?.("pattern_lifecycle_scheduler_already_running");
    return;
  }

  const run = () => tick({ intervalMs, jitterMs, logger });

  const scheduleNext = () => {
    const delay = intervalMs + Math.random() * jitterMs;
    schedulerHandle = setTimeout(async () => {
      await run();
      scheduleNext();
    }, delay);
    schedulerHandle.unref();
  };

  void run().then(scheduleNext, (error) => {
    logger.error?.("pattern_lifecycle_scheduler_start_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleNext();
  });
}

export function stopPatternLifecycleScheduler() {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}
