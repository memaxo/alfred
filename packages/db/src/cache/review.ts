/**
 * Review Caching Layer
 *
 * Redis-based caching for frequently accessed review data:
 * - Pending review counts (high frequency)
 * - Risk summaries (dashboard polling)
 * - Analytics summaries (dashboard widget)
 * - User's review queue (with pagination)
 *
 * Cache invalidation occurs on:
 * - Review creation
 * - Review submission (approve/reject/skip)
 * - Review delegation
 */

import { logger } from "@alfred/logger";
import { RedisClient } from "bun";
import { createHash } from "node:crypto";

// Cache TTLs in seconds
const CACHE_TTL = {
  PENDING_COUNT: 30, // 30 seconds - frequently polled
  RISK_SUMMARY: 60, // 1 minute
  ANALYTICS: 300, // 5 minutes - less frequently updated
  QUEUE: 60, // 1 minute - paginated results
  CYCLE_STATS: 300, // 5 minutes
  BLOCKED_REVIEWS: 60, // 1 minute
  TEMPLATES: 600, // 10 minutes - rarely changes
} as const;

const CACHE_PREFIX = {
  PENDING_COUNT: "review:pending:",
  RISK_SUMMARY: "review:risk:",
  ANALYTICS: "review:analytics:",
  QUEUE: "review:queue:",
  CYCLE_STATS: "review:cycle:",
  BLOCKED: "review:blocked:",
  TEMPLATES: "review:templates:",
} as const;

let redis: RedisClient | null = null;
let redisReady: Promise<void> | null = null;

async function getRedis(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL;
  if (!url || url === "false") {
    return null;
  }

  if (redis?.connected) {
    return redis;
  }

  if (!redis) {
    redis = new RedisClient(url, {
      connectionTimeout: 1000,
      autoReconnect: false,
      maxRetries: 0,
      enableOfflineQueue: false,
    } as Record<string, unknown>);
  }

  if (!redisReady) {
    redisReady = redis
      .connect()
      .catch(() => {})
      .finally(() => {
        redisReady = null;
      });
  }

  return redis.connected ? redis : null;
}

/**
 * Generate cache key with hash for complex inputs
 */
function hashKey(parts: string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
  }
  return hash.digest("hex").slice(0, 16);
}

// ─────────────────────────────────────────────────────────────────────────────
// PENDING COUNT CACHE
// ─────────────────────────────────────────────────────────────────────────────

export async function getCachedPendingCount(
  userId: string
): Promise<number | null> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return null;
    }

    const key = `${CACHE_PREFIX.PENDING_COUNT}${userId}`;
    const cached = await redis.get(key);
    return cached ? Number.parseInt(cached, 10) : null;
  } catch (error) {
    logger.debug("review_cache_get_failed", {
      type: "pending_count",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function cachePendingCount(
  userId: string,
  count: number
): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return;
    }

    const key = `${CACHE_PREFIX.PENDING_COUNT}${userId}`;
    await redis.setex(key, CACHE_TTL.PENDING_COUNT, String(count));
  } catch (error) {
    logger.debug("review_cache_set_failed", {
      type: "pending_count",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RISK SUMMARY CACHE
// ─────────────────────────────────────────────────────────────────────────────

export interface CachedRiskSummary {
  high: number;
  medium: number;
  low: number;
  total: number;
}

export async function getCachedRiskSummary(
  userId: string
): Promise<CachedRiskSummary | null> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return null;
    }

    const key = `${CACHE_PREFIX.RISK_SUMMARY}${userId}`;
    const cached = await redis.get(key);
    return cached ? (JSON.parse(cached) as CachedRiskSummary) : null;
  } catch (error) {
    logger.debug("review_cache_get_failed", {
      type: "risk_summary",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function cacheRiskSummary(
  userId: string,
  summary: CachedRiskSummary
): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return;
    }

    const key = `${CACHE_PREFIX.RISK_SUMMARY}${userId}`;
    await redis.setex(key, CACHE_TTL.RISK_SUMMARY, JSON.stringify(summary));
  } catch (error) {
    logger.debug("review_cache_set_failed", {
      type: "risk_summary",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS CACHE
// ─────────────────────────────────────────────────────────────────────────────

export interface CachedAnalytics {
  total: {
    reviewed: number;
    approved: number;
    rejected: number;
    skipped: number;
    approvalRate: number;
  };
  byType: Record<
    string,
    { approved: number; rejected: number; approvalRate: number }
  >;
  autoApprovePatterns: number;
}

export async function getCachedAnalytics(
  userId: string,
  days: number
): Promise<CachedAnalytics | null> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return null;
    }

    const key = `${CACHE_PREFIX.ANALYTICS}${userId}:${days}`;
    const cached = await redis.get(key);
    return cached ? (JSON.parse(cached) as CachedAnalytics) : null;
  } catch (error) {
    logger.debug("review_cache_get_failed", {
      type: "analytics",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function cacheAnalytics(
  userId: string,
  days: number,
  analytics: CachedAnalytics
): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return;
    }

    const key = `${CACHE_PREFIX.ANALYTICS}${userId}:${days}`;
    await redis.setex(key, CACHE_TTL.ANALYTICS, JSON.stringify(analytics));
  } catch (error) {
    logger.debug("review_cache_set_failed", {
      type: "analytics",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE CACHE (paginated)
// ─────────────────────────────────────────────────────────────────────────────

export async function getCachedQueue<T>(
  userId: string,
  options: {
    status?: string;
    reviewType?: string;
    limit?: number;
    offset?: number;
  }
): Promise<T[] | null> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return null;
    }

    const optionsKey = hashKey([
      options.status ?? "all",
      options.reviewType ?? "all",
      String(options.limit ?? 50),
      String(options.offset ?? 0),
    ]);
    const key = `${CACHE_PREFIX.QUEUE}${userId}:${optionsKey}`;
    const cached = await redis.get(key);
    return cached ? (JSON.parse(cached) as T[]) : null;
  } catch (error) {
    logger.debug("review_cache_get_failed", {
      type: "queue",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function cacheQueue<T>(
  userId: string,
  options: {
    status?: string;
    reviewType?: string;
    limit?: number;
    offset?: number;
  },
  queue: T[]
): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return;
    }

    const optionsKey = hashKey([
      options.status ?? "all",
      options.reviewType ?? "all",
      String(options.limit ?? 50),
      String(options.offset ?? 0),
    ]);
    const key = `${CACHE_PREFIX.QUEUE}${userId}:${optionsKey}`;
    await redis.setex(key, CACHE_TTL.QUEUE, JSON.stringify(queue));
  } catch (error) {
    logger.debug("review_cache_set_failed", {
      type: "queue",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE STATS CACHE
// ─────────────────────────────────────────────────────────────────────────────

export interface CachedCycleStats {
  avgCycleTime: number;
  codeAvg: number;
  toolAvg: number;
  memoryAvg: number;
  workflowAvg: number;
  trend: { date: string; avgMs: number }[];
  slaBreaches: number;
}

export async function getCachedCycleStats(
  userId: string,
  period: string
): Promise<CachedCycleStats | null> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return null;
    }

    const key = `${CACHE_PREFIX.CYCLE_STATS}${userId}:${period}`;
    const cached = await redis.get(key);
    return cached ? (JSON.parse(cached) as CachedCycleStats) : null;
  } catch (error) {
    logger.debug("review_cache_get_failed", {
      type: "cycle_stats",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function cacheCycleStats(
  userId: string,
  period: string,
  stats: CachedCycleStats
): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return;
    }

    const key = `${CACHE_PREFIX.CYCLE_STATS}${userId}:${period}`;
    await redis.setex(key, CACHE_TTL.CYCLE_STATS, JSON.stringify(stats));
  } catch (error) {
    logger.debug("review_cache_set_failed", {
      type: "cycle_stats",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES CACHE
// ─────────────────────────────────────────────────────────────────────────────

export async function getCachedTemplates<T>(
  userId: string,
  options?: { templateType?: string; reviewType?: string }
): Promise<T[] | null> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return null;
    }

    const optionsKey = hashKey([
      options?.templateType ?? "all",
      options?.reviewType ?? "all",
    ]);
    const key = `${CACHE_PREFIX.TEMPLATES}${userId}:${optionsKey}`;
    const cached = await redis.get(key);
    return cached ? (JSON.parse(cached) as T[]) : null;
  } catch (error) {
    logger.debug("review_cache_get_failed", {
      type: "templates",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function cacheTemplates<T>(
  userId: string,
  options: { templateType?: string; reviewType?: string } | undefined,
  templates: T[]
): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return;
    }

    const optionsKey = hashKey([
      options?.templateType ?? "all",
      options?.reviewType ?? "all",
    ]);
    const key = `${CACHE_PREFIX.TEMPLATES}${userId}:${optionsKey}`;
    await redis.setex(key, CACHE_TTL.TEMPLATES, JSON.stringify(templates));
  } catch (error) {
    logger.debug("review_cache_set_failed", {
      type: "templates",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE INVALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate all review caches for a user.
 * Call after review creation, submission, or delegation.
 */
export async function invalidateUserReviewCache(userId: string): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return;
    }

    // Delete known keys
    const keysToDelete = [
      `${CACHE_PREFIX.PENDING_COUNT}${userId}`,
      `${CACHE_PREFIX.RISK_SUMMARY}${userId}`,
    ];

    // Delete with pattern matching for keys with sub-keys
    const patterns = [
      `${CACHE_PREFIX.ANALYTICS}${userId}:*`,
      `${CACHE_PREFIX.QUEUE}${userId}:*`,
      `${CACHE_PREFIX.CYCLE_STATS}${userId}:*`,
      `${CACHE_PREFIX.BLOCKED}${userId}:*`,
    ];

    // Delete exact keys
    for (const key of keysToDelete) {
      await redis.del(key);
    }

    // For pattern-based deletion, we need to scan and delete
    for (const pattern of patterns) {
      try {
        // Use SCAN to find matching keys (safer than KEYS for large datasets)
        let cursor = "0";
        do {
          const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            pattern,
            "COUNT",
            100
          );
          cursor = nextCursor;
          for (const key of keys) {
            await redis.del(key);
          }
        } while (cursor !== "0");
      } catch {
        // SCAN might not be available, try direct deletion
        await redis.del(pattern.replace("*", ""));
      }
    }

    logger.debug("review_cache_invalidated", { userId });
  } catch (error) {
    logger.debug("review_cache_invalidate_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Invalidate template cache for a user.
 * Call after template creation, update, or deletion.
 */
export async function invalidateTemplateCache(userId: string): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) {
      return;
    }

    // Scan and delete template keys
    let cursor = "0";
    const pattern = `${CACHE_PREFIX.TEMPLATES}${userId}:*`;
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;
      for (const key of keys) {
        await redis.del(key);
      }
    } while (cursor !== "0");

    logger.debug("review_template_cache_invalidated", { userId });
  } catch (error) {
    logger.debug("review_template_cache_invalidate_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
