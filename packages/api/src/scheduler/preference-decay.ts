import { invalidatePreferenceCache } from "@alfred/agent/preference/loader";
import * as conversationRepo from "@alfred/db/repo/conversation";
import * as userRepo from "@alfred/db/repo/user";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PreferenceDecayOptions {
  decayWindowDays?: number;
  decayStep?: number;
}

export async function decayPreferenceConfidence(
  userId: string,
  options: PreferenceDecayOptions = {}
): Promise<void> {
  const windowDays = options.decayWindowDays ?? 30;
  const decayStep = options.decayStep ?? 0.1;
  const now = Date.now();

  const preferences = await userRepo.getPreferences(userId);
  let mutated = false;

  for (const pref of preferences) {
    if (pref.source !== "inferred") {
      continue;
    }

    const updated = pref.updated ?? pref.created;
    if (!updated) {
      continue;
    }
    const ageDays = (now - updated.getTime()) / DAY_MS;
    const steps = Math.floor(ageDays / windowDays);
    if (steps <= 0) {
      continue;
    }

    const current = typeof pref.confidence === "number" ? pref.confidence : 1;
    const decayed = Math.max(0, current - steps * decayStep);
    if (decayed < 0.3) {
      await userRepo.deletePreference(pref.userId, pref.key);
      mutated = true;
      continue;
    }

    if (decayed < current) {
      await userRepo.setPreference(
        pref.userId,
        pref.key,
        pref.value,
        decayed,
        pref.source
      );
      mutated = true;
    }
  }

  if (mutated) {
    await invalidatePreferenceCache(userId);
  }
}

interface SchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  batchSize?: number;
  decayWindowDays?: number;
  logger?: Pick<Console, "info" | "warn" | "error">;
}

let schedulerHandle: NodeJS.Timeout | null = null;
let running = false;

async function tick(options: Required<SchedulerOptions>) {
  if (running) {
    options.logger.warn?.("preference_decay_tick_skipped_busy");
    return;
  }

  running = true;
  try {
    const userIds = await conversationRepo.getActiveUserIds({
      days: options.decayWindowDays,
      limit: options.batchSize,
    });

    for (const userId of userIds) {
      try {
        await decayPreferenceConfidence(userId, {
          decayWindowDays: options.decayWindowDays,
        });
      } catch (error) {
        options.logger.warn?.("preference_decay_run_failed", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    running = false;
  }
}

export function startPreferenceDecayScheduler({
  intervalMs = 12 * 60 * 60 * 1000,
  jitterMs = 5 * 60 * 1000,
  batchSize = 25,
  decayWindowDays = 30,
  logger = console,
}: SchedulerOptions = {}) {
  if (process.env.SCHED_PREFERENCE_INFERENCE !== "1") {
    logger.info?.(
      "preference_decay_scheduler_disabled",
      "Enable SCHED_PREFERENCE_INFERENCE=1 to run decay scheduler"
    );
    return;
  }

  if (schedulerHandle) {
    logger.warn?.("preference_decay_scheduler_already_running");
    return;
  }

  const run = () =>
    tick({ intervalMs, jitterMs, batchSize, decayWindowDays, logger });

  const scheduleNext = () => {
    const delay = intervalMs + Math.random() * jitterMs;
    schedulerHandle = setTimeout(async () => {
      await run();
      scheduleNext();
    }, delay);
  };

  void run().then(scheduleNext, (error) => {
    logger.error?.("preference_decay_scheduler_start_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleNext();
  });
}

export function stopPreferenceDecayScheduler() {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}
