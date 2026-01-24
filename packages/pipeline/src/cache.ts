/**
 * Plan Caching
 *
 * Redis-based caching for workflow plans to speed up repeated requests.
 * Cache key is based on requirement, workspace, and file tree hash.
 */

import { logger } from "@alfred/logger";
import { createHash } from "node:crypto";

import type { PlanPhaseOutput } from "./schemas";

const PLAN_CACHE_TTL_SECONDS = 3600; // 1 hour
const PLAN_CACHE_PREFIX = "plan:cache:";

/**
 * Generate cache key from plan inputs.
 * Includes file tree snapshot to invalidate on workspace changes.
 */
export function getPlanCacheKey(input: {
  runId: string;
  requirement: string;
  workspace: string;
  fileTreeHash?: string;
}): string {
  const hash = createHash("sha256");
  hash.update(input.runId);
  hash.update(input.requirement);
  hash.update(input.workspace);
  if (input.fileTreeHash) {
    hash.update(input.fileTreeHash);
  }
  return `${PLAN_CACHE_PREFIX}${hash.digest("hex")}`;
}

/**
 * Retrieve cached plan from Redis.
 * Returns null if not found or expired.
 */
export async function getCachedPlan(
  key: string
): Promise<PlanPhaseOutput | null> {
  try {
    const { getRedis } = await import("@alfred/auth/redis");
    const redis = getRedis();
    if (!redis) {
      return null;
    }

    const cached = await redis.get(key);
    if (!cached) {
      return null;
    }

    return JSON.parse(cached) as PlanPhaseOutput;
  } catch (error) {
    logger.warn("plan_cache_get_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Store plan in Redis cache.
 * TTL defaults to 1 hour.
 */
export async function cachePlan(
  key: string,
  plan: PlanPhaseOutput,
  ttlSeconds: number = PLAN_CACHE_TTL_SECONDS
): Promise<void> {
  try {
    const { getRedis } = await import("@alfred/auth/redis");
    const redis = getRedis();
    if (!redis) {
      return;
    }

    await redis.setex(key, ttlSeconds, JSON.stringify(plan));
  } catch (error) {
    logger.warn("plan_cache_set_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Invalidate all cached plans for a workspace.
 * Useful when workspace structure changes significantly.
 */
export async function invalidatePlanCache(workspace: string): Promise<void> {
  try {
    const { getRedis } = await import("@alfred/auth/redis");
    const redis = getRedis();
    if (!redis) {
      return;
    }

    // Find all keys matching this workspace
    // Note: This is a simple implementation - for production, consider using SCAN
    const pattern = `${PLAN_CACHE_PREFIX}*`;
    const keys = await redis.keys(pattern);

    // Filter keys by workspace (requires storing workspace in value)
    // For now, delete all plan cache keys
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.warn("plan_cache_invalidate_failed", {
      workspace,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Compute simple hash of file tree structure.
 * Used to detect workspace changes that should invalidate cache.
 */
export async function computeFileTreeHash(
  workspace: string
): Promise<string | undefined> {
  try {
    const { readdir } = await import("node:fs/promises");

    // Get top-level files/dirs (shallow scan)
    const entries = await readdir(workspace, { withFileTypes: true });
    const names = entries.map((e) => `${e.name}:${e.isDirectory()}`).sort();

    const hash = createHash("sha256");
    hash.update(names.join(","));
    return hash.digest("hex");
  } catch (error) {
    logger.warn("plan_cache_treehash_failed", {
      workspace,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
}
