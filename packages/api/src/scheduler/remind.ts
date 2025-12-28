import * as assistantRepo from "@alfred/db/repo/assistant";
import { bridgeReminder } from "../webhooks/cognitive-bridge";

type Reminder = Awaited<ReturnType<typeof assistantRepo.getReminders>>[number];

/**
 * Default reminder fire handler - bridges to cognitive system
 */
async function defaultOnFire(
  reminder: Reminder,
  logger: Pick<Console, "info" | "warn" | "error">
): Promise<void> {
  try {
    // Get intent data from reminder metadata if available
    const metadata = reminder.metadata as {
      intentType?: string;
      intentData?: unknown;
    } | null;

    const result = await bridgeReminder(reminder.userId, {
      type: "reminder",
      id: reminder.id,
      title: reminder.title,
      when: reminder.remindAt?.toISOString() ?? new Date().toISOString(),
      description: reminder.description ?? undefined,
      intentType: metadata?.intentType,
      intentData: metadata?.intentData,
    });

    logger.info?.(
      `[assistant-remind] Reminder ${reminder.id} bridged to cognitive system`,
      {
        action: result.action,
        taskId: result.taskId,
      }
    );
  } catch (error) {
    logger.warn?.(
      `[assistant-remind] Failed to bridge reminder ${reminder.id}`,
      {
        error: error instanceof Error ? error.message : String(error),
      }
    );
    // Don't throw - reminder was already marked as fired
  }
}

export type ReminderSchedulerOptions = {
  intervalMs?: number;
  jitterMs?: number;
  batchSize?: number;
  logger?: Pick<Console, "info" | "error" | "warn">;
  onFire?: (reminder: Reminder) => Promise<void> | void;
  now?: () => Date;
};

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
        // Default behavior: bridge to cognitive system
        await defaultOnFire(reminder, options.logger);
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
