/**
 * Public API for @alfred/embed
 * Provides embed() and embedMany() functions matching @alfred/rag interface
 */

import { EmbedPool } from "./pool.js";
import type { QueueStats } from "./queue.js";

// Configuration
export {
  type FullEmbedConfig,
  getEmbedConfig,
  validateConfig,
} from "./config.js";
export { EMBEDDING_DIM } from "./dim.js";
// Embedding system initialization
export {
  type EmbedInitOptions,
  getDefaultModelId,
  initEmbedding,
  isEmbeddingInitialized,
  shutdownEmbedding,
} from "./init.js";
// Metrics
export {
  embedBatchesProcessed,
  embedBatchSize,
  embedProcessingMs,
  embedQueueCapacity,
  embedQueueLength,
  embedQueueWaitMs,
  embedRequestsDropped,
  embedRequestsProcessed,
  embedRequestsQueued,
  embedRetries,
  embedWorkersActive,
  embedWorkersBusy,
  embedWorkersError,
  getEmbedMetricsRegistry,
  recordBatch,
  updateQueueMetrics,
  updateWorkerMetrics,
} from "./metrics.js";
export { EmbedPool, type PoolConfig } from "./pool.js";
export { EmbedProcess } from "./process.js";
// Embedding providers
export {
  createKalmProvider,
  createQwenProvider,
  KalmProvider,
  QwenProvider,
} from "./providers/index.js";
// Int8 quantization for 4x storage reduction with 97%+ accuracy retention
export {
  computeScale,
  cosineSimilarity,
  dequantizeBatch,
  dequantizeFromInt8,
  deserializeQuantized,
  type QuantizationMetadata,
  type QuantizedEmbedding,
  quantizeBatch,
  quantizedCosineSimilarity,
  quantizeToInt8,
  serializeQuantized,
  storageRatio,
} from "./quantize.js";
export {
  EmbedQueue,
  type QueueConfig,
  type QueuedRequest,
  type QueueStats,
} from "./queue.js";
// Embedding registry for heterogeneous model support
export {
  type EmbeddingCapabilities,
  type EmbeddingInput,
  type EmbeddingModelConfig,
  type EmbeddingProvider,
  EmbeddingRegistry,
  type EmbeddingResult,
  getRegistry,
  MODEL_CONFIGS,
  MODEL_IDS,
  type ModelId,
  resetRegistry,
} from "./registry.js";
export type {
  EmbedConfig,
  EmbedRequest,
  EmbedResponse,
  ProcessHealth,
} from "./types.js";

// Singleton pool instance
let pool: EmbedPool | null = null;

/**
 * Get or create the singleton pool instance
 */
async function getPool(): Promise<EmbedPool> {
  if (!pool) {
    pool = EmbedPool.fromEnv();
    await pool.initialize();
  }
  return pool;
}

/**
 * Embed a single text and return 1024-dimensional vector (MRL truncated from 3840)
 */
export async function embed(text: string): Promise<number[]> {
  const p = await getPool();
  const embeddings = await p.embed([text]);
  const embedding = embeddings[0];

  if (!embedding) {
    throw new Error("Failed to generate embedding");
  }

  return embedding;
}

/**
 * Embed multiple texts and return array of 1024-dimensional vectors (MRL truncated from 3840)
 */
export async function embedMany(texts: string[]): Promise<number[][]> {
  const p = await getPool();
  return p.embed(texts);
}

/**
 * Shutdown the embedding pool (cleanup)
 * @param graceful If true, waits for in-flight requests (default: true)
 */
export async function shutdown(graceful = true): Promise<void> {
  if (pool) {
    await pool.shutdown(graceful);
    pool = null;
  }
}

/**
 * Get health status of embedding workers
 */
export function getHealth(): unknown[] {
  if (!pool) {
    return [];
  }
  return pool.getHealth();
}

/**
 * Get queue statistics
 */
export function getQueueStats(): QueueStats | null {
  if (!pool) {
    return null;
  }
  return pool.getQueueStats();
}

/**
 * Check if pool has capacity for more requests
 */
export function hasCapacity(): boolean {
  if (!pool) {
    return true;
  }
  return pool.hasCapacity();
}
