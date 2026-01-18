/**
 * Embedding Configuration
 * Reads configuration from environment variables with sensible defaults
 */

import type { QueueConfig } from "./queue";
import type { EmbedConfig } from "./types";

export type FullEmbedConfig = EmbedConfig & {
  enableQueue: boolean;
  queueConfig: Required<QueueConfig>;
};

/**
 * Parse boolean from environment variable
 */
function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  return value === "1" || value.toLowerCase() === "true";
}

/**
 * Parse integer from environment variable
 */
function parseIntValue(
  value: string | undefined,
  defaultValue: number
): number {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get embedding configuration from environment variables
 */
export function getEmbedConfig(): FullEmbedConfig {
  const isDev = process.env.NODE_ENV !== "production";

  return {
    // Pool config
    modelName:
      process.env.EMBED_MODEL ?? "tencent/KaLM-Embedding-Gemma3-12B-2511",
    device: (process.env.EMBED_DEVICE as EmbedConfig["device"]) ?? "auto",
    poolSize: parseIntValue(process.env.EMBED_POOL_SIZE, isDev ? 1 : 2),
    requestTimeout: parseIntValue(process.env.EMBED_REQUEST_TIMEOUT_MS, 30_000),

    // Queue config
    enableQueue: parseBool(process.env.EMBED_QUEUE_ENABLED, true),
    queueConfig: {
      maxQueueSize: parseIntValue(process.env.EMBED_QUEUE_MAX_SIZE, 1000),
      maxBatchSize: parseIntValue(process.env.EMBED_BATCH_SIZE, 32),
      maxTextsPerBatch: parseIntValue(process.env.EMBED_BATCH_MAX_TEXTS, 64),
      batchDelayMs: parseIntValue(process.env.EMBED_BATCH_DELAY_MS, 10),
      maxQueueTimeMs: parseIntValue(process.env.EMBED_QUEUE_TIMEOUT_MS, 60_000),
      retryCount: parseIntValue(process.env.EMBED_RETRY_COUNT, 3),
      retryDelayMs: parseIntValue(process.env.EMBED_RETRY_DELAY_MS, 100),
    },
  };
}

/**
 * Validate configuration and warn about potential issues
 */
export function validateConfig(config: FullEmbedConfig): string[] {
  const warnings: string[] = [];

  if ((config.poolSize ?? 1) < 1) {
    warnings.push("EMBED_POOL_SIZE must be at least 1");
  }

  if (config.queueConfig.maxQueueSize < 10) {
    warnings.push(
      "EMBED_QUEUE_MAX_SIZE is very low, may cause frequent rejections"
    );
  }

  if (config.queueConfig.maxBatchSize > 100) {
    warnings.push("EMBED_BATCH_SIZE > 100 may cause memory issues");
  }

  if (config.queueConfig.batchDelayMs > 1000) {
    warnings.push("EMBED_BATCH_DELAY_MS > 1000ms may cause high latency");
  }

  if (config.queueConfig.retryCount > 10) {
    warnings.push("EMBED_RETRY_COUNT > 10 may cause long delays on failures");
  }

  return warnings;
}
