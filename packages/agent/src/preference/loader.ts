import { getPreferences as getUserPreferences } from "@alfred/db/repo/user";
import { logger } from "@alfred/metrics";
import {
  type DomainName,
  type PreferenceDetail,
  type PreferenceKey,
  preferenceKeySchema,
  preferenceSourceSchema,
  preferenceValueSchema,
} from "@alfred/type/preference";
import { RedisClient } from "bun";
import { LRUCache } from "lru-cache";

import { loadDomainDefaults } from "./defaults";

const L1_CAPACITY = 1000;
const L1_TTL_MS = 5 * 60 * 1000; // 5 minutes
const L2_TTL_SECONDS = 10 * 60; // 10 minutes
const CACHE_CHANNEL = "preference:invalidate";
const CACHE_PREFIX = "pref:";

const l1Cache = new LRUCache<string, Map<PreferenceKey, PreferenceDetail>>({
  max: L1_CAPACITY,
  ttl: L1_TTL_MS,
});

let redisCmd: RedisClient | null = null;
let redisSub: RedisClient | null = null;
let redisCmdReady = false;
let redisSubReady = false;
let redisSubscribed = false;
let redisInitPromise: Promise<void> | null = null;

async function initializeRedis(): Promise<void> {
  const url = process.env.REDIS_URL?.trim();
  if (!url || url === "false") {
    return;
  }

  if (redisCmd && redisSub && redisCmdReady && redisSubReady) {
    return;
  }

  if (redisInitPromise) {
    return redisInitPromise;
  }

  redisInitPromise = (async () => {
    try {
      const cmd = new RedisClient(url);
      const sub = new RedisClient(url);

      cmd.onclose = () => {
        redisCmdReady = false;
        redisCmd = null;
      };
      sub.onclose = () => {
        redisSubReady = false;
        redisSub = null;
        redisSubscribed = false;
      };

      await cmd.connect();
      await sub.connect();

      redisCmd = cmd;
      redisSub = sub;
      redisCmdReady = true;
      redisSubReady = true;

      if (!redisSubscribed) {
        await redisSub.subscribe(CACHE_CHANNEL, (message) => {
          if (typeof message === "string" && message.length > 0) {
            l1Cache.delete(message);
          }
        });
        redisSubscribed = true;
      }
    } catch (error) {
      logger.warn("preference_redis_init_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      redisCmd = null;
      redisSub = null;
      redisCmdReady = false;
      redisSubReady = false;
      redisSubscribed = false;
    } finally {
      redisInitPromise = null;
    }
  })();

  return redisInitPromise;
}

function getRedisClient(): RedisClient | null {
  if (redisCmd && redisCmdReady) {
    return redisCmd;
  }
  return null;
}

function redisKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

export async function loadPreferences(
  userId: string
): Promise<Map<PreferenceKey, PreferenceDetail>> {
  await initializeRedis().catch(() => {
    // Initialization failures are logged inside initializeRedis(); fallback to L1/DB
  });

  const cached = l1Cache.get(userId);
  if (cached) {
    return cached;
  }

  const redis = getRedisClient();
  if (redis) {
    try {
      const serialized = await redis.get(redisKey(userId));
      if (serialized) {
        const prefs = deserializePreferences(serialized);
        if (prefs) {
          l1Cache.set(userId, prefs);
          return prefs;
        }
      }
    } catch (error) {
      logger.warn("preference_redis_get_failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const rows = await getUserPreferences(userId);
  const prefs = new Map<PreferenceKey, PreferenceDetail>();

  for (const row of rows) {
    const keyResult = preferenceKeySchema.safeParse(row.key);
    if (!keyResult.success) {
      logger.warn("preference_key_invalid", {
        userId,
        key: row.key,
      });
      continue;
    }

    const valueResult = preferenceValueSchema.safeParse(row.value);
    if (!valueResult.success) {
      logger.warn("preference_value_invalid", {
        userId,
        key: row.key,
      });
      continue;
    }

    const sourceResult = preferenceSourceSchema.safeParse(row.source);
    const confidenceValue =
      typeof row.confidence === "number" ? clampConfidence(row.confidence) : 1;

    prefs.set(keyResult.data, {
      value: valueResult.data,
      source: sourceResult.success ? sourceResult.data : "user",
      confidence: confidenceValue,
      evidence: undefined,
    });
  }

  l1Cache.set(userId, prefs);

  if (redis && prefs.size > 0) {
    try {
      await redis.set(
        redisKey(userId),
        serializePreferences(prefs),
        "EX",
        L2_TTL_SECONDS
      );
    } catch (error) {
      logger.warn("preference_redis_set_failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return prefs;
}

export async function loadPreferencesWithDefaults(
  userId: string,
  domain?: DomainName | null
): Promise<Map<PreferenceKey, PreferenceDetail>> {
  const base = await loadPreferences(userId);
  if (!domain) {
    return base;
  }

  const defaults = loadDomainDefaults(domain);
  if (defaults.size === 0) {
    return base;
  }

  const merged = new Map(base);
  for (const [key, detail] of defaults.entries()) {
    if (!merged.has(key)) {
      merged.set(key, detail);
    }
  }

  return merged;
}

export async function invalidatePreferenceCache(userId: string): Promise<void> {
  l1Cache.delete(userId);

  await initializeRedis().catch(() => {
    // Ignore initialization failure; cache invalidation already happened locally
  });

  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.del(redisKey(userId));
    await redis.publish(CACHE_CHANNEL, userId);
  } catch (error) {
    logger.warn("preference_redis_invalidate_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function resetPreferenceCache(): void {
  l1Cache.clear();
}

function serializePreferences(
  prefs: Map<PreferenceKey, PreferenceDetail>
): string {
  return JSON.stringify(Array.from(prefs.entries()));
}

function deserializePreferences(
  serialized: string
): Map<PreferenceKey, PreferenceDetail> | null {
  try {
    const entries = JSON.parse(serialized) as [
      PreferenceKey,
      PreferenceDetail,
    ][];
    const result = new Map<PreferenceKey, PreferenceDetail>();
    for (const [key, detail] of entries) {
      const parsedKey = preferenceKeySchema.safeParse(key);
      if (!parsedKey.success) {
        continue;
      }
      result.set(parsedKey.data, detail);
    }
    return result;
  } catch (error) {
    logger.warn("preference_cache_deserialize_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
