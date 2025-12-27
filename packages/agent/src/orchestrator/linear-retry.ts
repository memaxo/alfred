import { logger } from "@alfred/logger";
import pRetry, { AbortError } from "p-retry";
import type { LinearRateLimitCategory } from "./linear-rate-limiter";
import { linearRateLimiter } from "./linear-rate-limiter";

export type WithLinearRetryOptions = {
  category: LinearRateLimitCategory;
  requireStartupBuffer?: boolean;
  logPrefix?: string;
  logContext?: Record<string, unknown>;
};

const RETRY_CONFIG = {
  retries: 3,
  minTimeout: 1000,
  maxTimeout: 10_000,
  factor: 2,
} as const;

type ErrorWithStatusCode = {
  statusCode?: number;
};

type ErrorWithRetry = {
  retryAfterMs?: number;
  retryAfter?: number;
  headers?: Headers | Record<string, string>;
  response?: {
    headers?: Headers | Record<string, string>;
    get?: (key: string) => string | null;
  };
};

export function getStatusCode(error: unknown): number | undefined {
  const err = error as ErrorWithStatusCode;
  return err?.statusCode;
}

export function resolveRetryAfterMs(error: unknown): number | undefined {
  const err = error as ErrorWithRetry;
  const candidate =
    err?.retryAfterMs ??
    err?.retryAfter ??
    (err?.headers instanceof Headers
      ? err.headers.get("retry-after")
      : err?.headers?.["retry-after"]) ??
    (err?.response?.headers instanceof Headers
      ? err.response.headers.get("retry-after")
      : err?.response?.headers?.["retry-after"]);

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate >= 1000 ? candidate : candidate * 1000;
  }

  if (typeof candidate === "string" && candidate.trim().length > 0) {
    const parsed = Number.parseInt(candidate.trim(), 10);
    if (!Number.isNaN(parsed)) {
      return parsed >= 1000 ? parsed : parsed * 1000;
    }
  }

  return;
}

function isRetryableStatusCode(statusCode: number): boolean {
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

export async function withLinearRetry<T>(
  operation: () => Promise<T>,
  options: WithLinearRetryOptions
): Promise<T> {
  const throttleOptions =
    options.requireStartupBuffer === false
      ? { requireStartupBuffer: false }
      : undefined;

  return pRetry(
    async () => {
      await linearRateLimiter.throttle(options.category, throttleOptions);
      return operation();
    },
    {
      ...RETRY_CONFIG,
      onFailedAttempt: async (error) => {
        const statusCode = getStatusCode(error);
        if (statusCode && isRetryableStatusCode(statusCode)) {
          if (options.logPrefix && options.logContext) {
            logger?.warn?.(`${options.logPrefix}_retry`, {
              ...options.logContext,
              attempt: error.attemptNumber,
              retriesLeft: error.retriesLeft,
            });
          }
          if (statusCode === 429) {
            const retryAfterMs = resolveRetryAfterMs(error);
            await linearRateLimiter.handle429(retryAfterMs);
          }
          return;
        }
        throw new AbortError(error);
      },
    }
  );
}
