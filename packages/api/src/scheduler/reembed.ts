/**
 * Re-embedding Scheduler
 * Background worker that re-embeds chunks when the default embedding model changes
 *
 * Gated behind SCHED_REEMBED=1 environment variable
 */

import {
  countChunksByModel,
  getStaleChunks,
  updateChunkEmbedding,
} from "@alfred/db/repo/rag";
import {
  type EmbeddingInput,
  type EmbeddingProvider,
  getRegistry,
  MODEL_IDS,
} from "@alfred/embed";
import { getCurrentModelId } from "@alfred/rag";

export interface ReembedProgress {
  processed: number;
  remaining: number;
  modelId: string;
  byModel: { modelId: string | null; count: number }[];
}

export interface ReembedOptions {
  batchSize?: number;
  targetModelId?: string;
}

/**
 * Re-embed a batch of stale chunks
 * Returns progress information
 */
export async function reembedStaleChunks(
  options: ReembedOptions = {}
): Promise<ReembedProgress> {
  const batchSize = options.batchSize ?? 100;
  const targetModelId = options.targetModelId ?? getCurrentModelId();

  // Get stale chunks
  const staleChunks = await getStaleChunks(targetModelId, batchSize);

  if (staleChunks.length === 0) {
    const byModel = await countChunksByModel();
    return {
      processed: 0,
      remaining: 0,
      modelId: targetModelId,
      byModel,
    };
  }

  // Get the embedding provider
  let provider: EmbeddingProvider;
  try {
    const registry = getRegistry();
    provider = registry.get(targetModelId);
  } catch {
    // Registry not initialized, try to use default
    throw new Error(
      `Embedding provider not found for model ID: ${targetModelId}. ` +
        "Ensure the registry is initialized with the target provider."
    );
  }

  // Ensure provider is initialized
  if (!provider.isHealthy()) {
    await provider.initialize();
  }

  // Re-embed in batch
  const inputs: EmbeddingInput[] = staleChunks.map((chunk) => ({
    type: "text" as const,
    content: chunk.content,
  }));

  const embeddings = await provider.embedMany(inputs);

  // Update each chunk
  let processed = 0;
  for (let i = 0; i < staleChunks.length; i++) {
    const chunk = staleChunks[i];
    const embedding = embeddings[i];

    if (chunk && embedding && embedding.length > 0) {
      await updateChunkEmbedding(chunk.id, embedding, targetModelId);
      processed++;
    }
  }

  // Get updated counts
  const byModel = await countChunksByModel();
  const remaining = byModel
    .filter((m) => m.modelId !== targetModelId)
    .reduce((sum, m) => sum + m.count, 0);

  return {
    processed,
    remaining,
    modelId: targetModelId,
    byModel,
  };
}

// Scheduler state
interface SchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  batchSize?: number;
  targetModelId?: string;
  logger?: Pick<Console, "info" | "warn" | "error">;
  onProgress?: (progress: ReembedProgress) => void;
}

let schedulerHandle: NodeJS.Timeout | null = null;
let running = false;

async function tick(options: Required<SchedulerOptions>): Promise<void> {
  if (running) {
    options.logger.warn?.("reembed_tick_skipped_busy");
    return;
  }

  running = true;
  try {
    const progress = await reembedStaleChunks({
      batchSize: options.batchSize,
      targetModelId: options.targetModelId,
    });

    options.onProgress?.(progress);

    if (progress.processed > 0) {
      options.logger.info?.("reembed_progress", {
        processed: progress.processed,
        remaining: progress.remaining,
        modelId: progress.modelId,
      });
    }

    // Auto-disable when complete
    if (progress.remaining === 0) {
      options.logger.info?.(
        "reembed_complete",
        "All chunks re-embedded to target model. Stopping scheduler."
      );
      stopReembedScheduler();
    }
  } catch (error) {
    options.logger.error?.("reembed_tick_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    running = false;
  }
}

/**
 * Start the re-embedding scheduler
 * Runs at regular intervals until all chunks are migrated
 */
export function startReembedScheduler({
  intervalMs = 5 * 60 * 1000, // 5 minutes
  jitterMs = 30 * 1000, // 30 seconds
  batchSize = 100,
  targetModelId = MODEL_IDS.QWEN3_VL_2B, // Default to Qwen
  logger = console,
  onProgress,
}: SchedulerOptions = {}): void {
  if (process.env.SCHED_REEMBED !== "1") {
    logger.info?.(
      "reembed_scheduler_disabled",
      "Enable SCHED_REEMBED=1 to run re-embedding scheduler"
    );
    return;
  }

  if (schedulerHandle) {
    logger.warn?.("reembed_scheduler_already_running");
    return;
  }

  logger.info?.("reembed_scheduler_started", {
    targetModelId,
    intervalMs,
    batchSize,
  });

  const run = () =>
    tick({
      intervalMs,
      jitterMs,
      batchSize,
      targetModelId,
      logger,
      onProgress: onProgress ?? (() => {}),
    });

  const scheduleNext = () => {
    if (!schedulerHandle) {
      return; // Scheduler was stopped
    }

    const delay = intervalMs + Math.random() * jitterMs;
    schedulerHandle = setTimeout(async () => {
      await run();
      scheduleNext();
    }, delay);
  };

  // Run immediately, then schedule
  schedulerHandle = setTimeout(() => {}, 0); // Placeholder to mark as running
  void run().then(scheduleNext, (error) => {
    logger.error?.("reembed_scheduler_start_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleNext();
  });
}

/**
 * Stop the re-embedding scheduler
 */
export function stopReembedScheduler(): void {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
  running = false;
}

/**
 * Check if the scheduler is running
 */
export function isReembedSchedulerRunning(): boolean {
  return schedulerHandle !== null;
}

/**
 * Get current re-embedding progress
 * Can be used for monitoring endpoints
 */
export async function getReembedProgress(
  targetModelId?: string
): Promise<ReembedProgress> {
  const modelId = targetModelId ?? getCurrentModelId();
  const byModel = await countChunksByModel();

  const targetCount = byModel.find((m) => m.modelId === modelId)?.count ?? 0;
  const remaining = byModel
    .filter((m) => m.modelId !== modelId)
    .reduce((sum, m) => sum + m.count, 0);

  return {
    processed: targetCount,
    remaining,
    modelId,
    byModel,
  };
}
