import { unregisterRunHandle } from "@alfred/agent/workflow/session-recovery";
import { getRedis } from "@alfred/auth/redis";
import { logger } from "@alfred/logger";
import { droidPendingCleanupTotal, droidPendingRunsGauge } from "../metrics";

const KEY_PREFIX = "droid:pending:";
const MAX_AGE_MS = Number(
  process.env.DROID_PENDING_MAX_AGE_MS ?? 30 * 60 * 1000
);
const SCAN_COUNT = Number(process.env.DROID_PENDING_SCAN_COUNT ?? 200);

type PendingRunRecord = {
  type: "run" | "stream";
  input: Record<string, unknown>;
  createdAt: number;
};

async function scanKeys(redis: ReturnType<typeof getRedis>): Promise<string[]> {
  if (!redis) {
    return [];
  }
  let cursor = "0";
  const keys: string[] = [];
  do {
    // Bun Redis client has different scan signature than node-redis
    const result = await (redis as any).scan(cursor, {
      MATCH: `${KEY_PREFIX}*`,
      COUNT: SCAN_COUNT,
    });
    const [nextCursor, batch] = result as [string, string[]];
    cursor = nextCursor;
    if (Array.isArray(batch)) {
      keys.push(...batch);
    }
  } while (cursor !== "0");
  return keys;
}

export async function cleanupDroidPendingRuns(now: number = Date.now()) {
  const redis = getRedis();
  if (!redis) {
    logger.debug("droid_cleanup_skipped_no_redis");
    return;
  }

  const keys = await scanKeys(redis);
  droidPendingRunsGauge.set(keys.length);
  if (keys.length === 0) {
    return;
  }

  for (const key of keys) {
    const runId = key.slice(KEY_PREFIX.length);
    if (!runId) {
      continue;
    }
    try {
      const raw = await redis.get(key);
      if (!raw) {
        continue;
      }
      let record: PendingRunRecord | null = null;
      try {
        record = JSON.parse(raw) as PendingRunRecord;
      } catch (error) {
        logger.warn("droid_cleanup_parse_failed", { runId, error });
        await redis.del(key);
        continue;
      }
      const createdAt = Number(record?.createdAt ?? 0);
      if (!Number.isFinite(createdAt)) {
        await redis.del(key);
        continue;
      }
      const ageMs = now - createdAt;
      if (ageMs > MAX_AGE_MS) {
        await redis.del(key);
        await unregisterRunHandle(runId);
        droidPendingCleanupTotal.inc({ result: "stale" });
      }
    } catch (error) {
      logger.warn("droid_cleanup_error", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      droidPendingCleanupTotal.inc({ result: "error" });
    }
  }
}

if (import.meta.main) {
  cleanupDroidPendingRuns()
    .then(() => {
      // eslint-disable-next-line no-process-exit -- CLI utility
      process.exit(0);
    })
    .catch((error) => {
      logger.error("droid_cleanup_uncaught", {
        error: error instanceof Error ? error.message : String(error),
      });
      // eslint-disable-next-line no-process-exit -- CLI utility
      process.exit(1);
    });
}
