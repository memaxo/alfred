import * as assistantRepo from "@alfred/db/repo/assistant";

type Reminder = Awaited<ReturnType<typeof assistantRepo.getReminders>>[number];

export interface ReminderSchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  batchSize?: number;
  logger?: Pick<Console, "info" | "error" | "warn">;
  onFire?: (reminder: Reminder) => Promise<void> | void;
  now?: () => Date;
}

let schedulerHandle: NodeJS.Timeout | null = null;
let running = false;

async function tick(
  options: Required<Omit<ReminderSchedulerOptions, "onFire">> & {
    onFire?: ReminderSchedulerOptions["onFire"];
  }
) {
  if (running) {
    options.logger.warn?.(
      "Reminder scheduler tick skipped because previous run is still in progress."
    );
    return;
  }

  running = true;
  try {
    const now = options.now();
    const reminders = await assistantRepo.getDueRemindersAll(
      now,
      options.batchSize
    );

    for (const reminder of reminders) {
      await assistantRepo.markReminderFired(reminder.id);
      if (options.onFire) {
        await options.onFire(reminder);
      } else {
        options.logger.info?.(
          `[assistant-remind] Fired reminder ${reminder.id} for user ${reminder.userId} at ${now.toISOString()}`
        );
      }
    }
  } catch (error) {
    options.logger.error?.("[assistant-remind] Scheduler tick failed", error);
  } finally {
    running = false;
  }
}

export function startReminderScheduler({
  intervalMs = 30_000,
  jitterMs = 5000,
  batchSize = 100,
  logger = console,
  onFire,
  now = () => new Date(),
}: ReminderSchedulerOptions = {}) {
  if (process.env.SCHED_REMIND !== "1") {
    logger.info?.(
      "[assistant-remind] Scheduler disabled (set SCHED_REMIND=1 to enable)."
    );
    return;
  }

  if (schedulerHandle) {
    logger.warn?.("[assistant-remind] Scheduler already running.");
    return;
  }

  const run = () =>
    tick({
      intervalMs,
      jitterMs,
      batchSize,
      logger,
      onFire,
      now,
    });

  const scheduleNext = () => {
    const delay = intervalMs + Math.random() * jitterMs;
    schedulerHandle = setTimeout(async () => {
      await run();
      scheduleNext();
    }, delay);
  };

  void run().then(scheduleNext, (error) => {
    logger.error?.("[assistant-remind] Initial scheduler run failed", error);
    scheduleNext();
  });
}

export function stopReminderScheduler() {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}
