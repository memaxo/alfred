import { logger } from "@alfred/logger";
import {
  redisConnectionErrorsTotal,
  redisConnectionStatus,
  redisReconnectionAttemptsTotal,
} from "@alfred/metrics/shared";
import { redis as defaultRedis, RedisClient } from "bun";

let client: RedisClient | null = null;
let status: "init" | "connecting" | "ok" | "err" = "init";
let readyPromise: Promise<void> | null = null;
let retryAttempt = 0;
let retryTimer: NodeJS.Timeout | null = null;

const REDIS_RETRY_ENABLED =
  process.env.REDIS_RETRY_ENABLED?.toLowerCase() !== "false";
const REDIS_RETRY_INITIAL_DELAY_MS = Number.parseInt(
  process.env.REDIS_RETRY_INITIAL_DELAY_MS || "100",
  10
);
const REDIS_RETRY_MAX_DELAY_MS = Number.parseInt(
  process.env.REDIS_RETRY_MAX_DELAY_MS || "5000",
  10
);
const REDIS_RETRY_MAX_ATTEMPTS = Number.parseInt(
  process.env.REDIS_RETRY_MAX_ATTEMPTS || "5",
  10
);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initializeWithRetry(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL;
  if (!url || url === "false") {
    return null;
  }

  // If retries are disabled, only attempt once
  const maxAttempts = REDIS_RETRY_ENABLED
    ? REDIS_RETRY_MAX_ATTEMPTS
    : 1;

  let delay = REDIS_RETRY_INITIAL_DELAY_MS;
  let lastError: Error | null = null;

  // Use shorter timeout when retries are disabled (typically in tests)
  const connectionTimeout = REDIS_RETRY_ENABLED ? 5000 : 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const newClient = url
        ? new RedisClient(url, {
            connectionTimeout,
            autoReconnect: true,
            maxRetries: 10,
            enableOfflineQueue: true,
          } as Record<string, unknown>)
        : defaultRedis;

      newClient.onclose = (error) => {
        status = "err";
        client = null;
        try {
          redisConnectionStatus.set(0);
          if (error) {
            redisConnectionErrorsTotal.inc();
            logger.warn("redis_connection_closed", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } catch {
          // Metrics may not be available in all environments
        }
      };

      newClient.onconnect = () => {
        status = "ok";
        retryAttempt = 0;
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        try {
          redisConnectionStatus.set(1);
        } catch {
          // Metrics may not be available in all environments
        }
      };

      const clientWithError = newClient as RedisClient & {
        onerror: ((error: Error) => void) | null;
      };
      clientWithError.onerror = (err: Error) => {
        try {
          redisConnectionErrorsTotal.inc();
        } catch {
          // Metrics may not be available in all environments
        }
        logger.error("redis_connection_error", {
          error: err instanceof Error ? err.message : String(err),
          attempt: attempt + 1,
        });
        status = "err";
      };

      // Use Promise.race to enforce connection timeout
      const connectPromise = newClient.connect();
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Connection timeout")),
          connectionTimeout
        );
        // Clear timeout if connect succeeds
        connectPromise.finally(() => clearTimeout(timer));
      });

      await Promise.race([connectPromise, timeoutPromise]);

      if (newClient.connected) {
        client = newClient;
        status = "ok";
        retryAttempt = 0;
        return newClient;
      }

      throw new Error("Connection established but client not connected");
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error ?? ""));

      // If retries are disabled, fail immediately
      if (!REDIS_RETRY_ENABLED) {
        break;
      }

      if (attempt < maxAttempts - 1) {
        logger.warn("redis_connection_retry", {
          attempt: attempt + 1,
          maxAttempts,
          delay,
          error: lastError.message,
        });

        await wait(delay);
        delay = Math.min(delay * 2, REDIS_RETRY_MAX_DELAY_MS);
      }
    }
  }

  try {
    redisConnectionErrorsTotal.inc();
    redisConnectionStatus.set(0);
  } catch {
    // Metrics may not be available in all environments
  }

  logger.error("redis_connection_failed_after_retries", {
    maxAttempts,
    error: lastError?.message ?? "Unknown error",
  });

  status = "err";
  client = null;
  return null;
}

export function getRedis(): RedisClient | null {
  const url = process.env.REDIS_URL;
  if (!url || url === "false") {
    return null;
  }

  if (client?.connected && status === "ok") {
    return client;
  }

  if (status === "err") {
    if (!REDIS_RETRY_ENABLED) {
      return null;
    }

    if (retryTimer) {
      return null;
    }

    retryAttempt++;
    if (retryAttempt > REDIS_RETRY_MAX_ATTEMPTS) {
      return null;
    }

    try {
      redisReconnectionAttemptsTotal.inc();
    } catch {
      // Metrics may not be available in all environments
    }

    const delay = Math.min(
      REDIS_RETRY_INITIAL_DELAY_MS * 2 ** (retryAttempt - 1),
      REDIS_RETRY_MAX_DELAY_MS
    );

    status = "connecting";
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void initializeWithRetry().catch(() => {
        status = "err";
      });
    }, delay);

    return null;
  }

  if (status === "connecting" && readyPromise) {
    return null;
  }

  if (status === "init" || !client || !client.connected) {
    status = "connecting";
    readyPromise = initializeWithRetry()
      .then((result) => {
        if (result) {
          status = "ok";
        } else {
          status = "err";
        }
        readyPromise = null;
      })
      .catch((error) => {
        logger.error("redis_initialization_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        status = "err";
        readyPromise = null;
      });

    return null;
  }

  return client;
}

export async function getRedisAsync(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL;
  if (!url || url === "false") {
    return null;
  }

  if (client?.connected && status === "ok") {
    return client;
  }

  if (readyPromise) {
    await readyPromise;
  } else {
    const result = getRedis();
    if (result) {
      return result;
    }
    if (readyPromise) {
      await readyPromise;
    }
  }

  if (client?.connected && status === "ok") {
    return client;
  }

  return null;
}

export async function isRedisHealthy(): Promise<boolean> {
  const redis = await getRedisAsync();
  if (!redis) {
    return false;
  }

  try {
    if (!redis.connected) {
      return false;
    }

    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
