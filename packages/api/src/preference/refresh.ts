import { invalidatePreferenceCache } from "@alfred/agent/preference/loader";
import { preferenceCacheInvalidationsTotal } from "../metrics";
import { runPreferenceInference } from "../scheduler/preference-inference";
import { logger } from "../utils/logger";

const pendingUsers = new Set<string>();
const DEFAULT_DEBOUNCE_MS = 5_000;
let flushTimer: NodeJS.Timeout | null = null;

async function drainQueue() {
  const batch = Array.from(pendingUsers);
  if (batch.length === 0) {
    return;
  }
  pendingUsers.clear();

  for (const userId of batch) {
    try {
      await runPreferenceInference(userId);
      logger.info("preference_refresh_completed", { userId });
    } catch (error) {
      logger.warn("preference_refresh_failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function scheduleFlush(delayMs: number) {
  if (flushTimer) {
    return;
  }
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await drainQueue();
  }, delayMs);
}

export function triggerPreferenceRefresh(
  userId: string | null | undefined,
  options: { reason?: string; debounceMs?: number } = {}
): void {
  if (!userId) {
    return;
  }

  const reason = options.reason ?? "workflow";
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  pendingUsers.add(userId);
  void invalidatePreferenceCache(userId)
    .then(() => {
      preferenceCacheInvalidationsTotal.inc({ reason });
    })
    .catch((error) => {
      logger.warn("preference_cache_invalidation_failed", {
        userId,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  logger.info("preference_refresh_scheduled", { userId, reason });
  scheduleFlush(debounceMs);
}

export async function __flushPreferenceRefreshQueueForTests(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await drainQueue();
}

export function __resetPreferenceRefreshQueueForTests(): void {
  pendingUsers.clear();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
