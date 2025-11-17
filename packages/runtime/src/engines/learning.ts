/**
 * Learning Engine Wrapper
 * 
 * Wraps self-supervision functions from @alfred/learning
 * Records outcomes and generates knowledge updates
 */

import { supervise } from "@alfred/learning/self_supervision";
import { logger } from "@alfred/api/utils/logger";
import {
  runtimeKnowledgeUpdatesTotal,
  runtimeKnowledgeBatchDurationSeconds,
} from "../metrics";

/**
 * Supervision event for learning from outcomes
 */
export type SupervisionEvent = {
  input: unknown;
  output: unknown;
  expected: unknown;
  error: number; // 0 for success, 1 for failure
  context: Record<string, unknown>;
  ts: string;
};

/**
 * Knowledge update from supervision
 */
export type KnowledgeUpdate = {
  type: "fact" | "relation" | "insight";
  data: unknown;
};

/**
 * Maximum outcomes to retain in memory
 * Prevents unbounded memory growth in long-running workflows
 * ~1KB per outcome * 1000 = ~1MB max memory usage
 */
const MAX_OUTCOMES = 1000;

/**
 * Learning Engine provides self-supervision capabilities
 * 
 * Records outcomes during execution and generates knowledge updates at completion.
 * Updates are batched and persisted asynchronously (fire-and-forget).
 * 
 * Memory-bounded: Evicts oldest outcomes when MAX_OUTCOMES is reached (FIFO/LRU).
 */
export class LearningEngine {
  private outcomes: SupervisionEvent[] = [];

  /**
   * Record phase outcome for learning
   * 
   * Evicts oldest outcome if at capacity to prevent memory leaks
   */
  recordOutcome(outcome: SupervisionEvent): void {
    // Evict oldest if at capacity (FIFO)
    if (this.outcomes.length >= MAX_OUTCOMES) {
      this.outcomes.shift();
    }
    this.outcomes.push(outcome);
  }

  /**
   * Process all recorded outcomes and generate knowledge updates
   * 
   * Returns array of updates to be persisted.
   * Does NOT persist directly - caller handles persistence.
   */
  async processOutcomes(): Promise<KnowledgeUpdate[]> {
    const updates: KnowledgeUpdate[] = [];

    for (const outcome of this.outcomes) {
      const result = supervise(outcome);
      if (result) {
        // Convert supervision result to knowledge updates
        updates.push({
          type: "insight",
          data: result,
        });
      }
    }

    return updates;
  }

  /**
   * Get count of recorded outcomes
   */
  getOutcomeCount(): number {
    return this.outcomes.length;
  }

  /**
   * Clear all recorded outcomes (for testing)
   */
  clear(): void {
    this.outcomes = [];
  }
  
  /**
   * Get maximum capacity
   */
  getMaxCapacity(): number {
    return MAX_OUTCOMES;
  }

  /**
   * Persist updates in batches with metrics and logging
   * 
   * Processes updates in chunks of 100 for efficiency.
   * Non-blocking: Logs failures but doesn't throw.
   * 
   * @param updates Knowledge updates to persist
   * @param runId Workflow run ID for logging
   */
  async persistUpdatesBatch(
    updates: KnowledgeUpdate[],
    runId: string
  ): Promise<void> {
    if (updates.length === 0) return;

    const startTime = Date.now();
    const stopTimer = runtimeKnowledgeBatchDurationSeconds.startTimer({
      operation: "persist",
    });

    logger.info("runtime_knowledge_batch_start", {
      runId,
      updateCount: updates.length,
    });

    try {
      // Batch write in chunks of 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        // TODO: Integrate with actual knowledge persistence (Phase 3.6)
        // For now, just simulate batch write
        await this.writeBatch(batch);
        
        runtimeKnowledgeUpdatesTotal.inc(
          { type: "batch", status: "success" },
          batch.length
        );
      }

      const durationMs = Date.now() - startTime;
      stopTimer();

      logger.info("runtime_knowledge_batch_complete", {
        runId,
        updateCount: updates.length,
        durationMs,
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      runtimeKnowledgeUpdatesTotal.inc({ type: "batch", status: "failed" });
      stopTimer();

      logger.warn("runtime_knowledge_persistence_failed", {
        runId,
        updateCount: updates.length,
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      });

      // Don't throw - persistence failures shouldn't break workflow
    }
  }

  /**
   * Write a single batch of updates
   * 
   * TODO: Integrate with actual knowledge graph persistence
   */
  private async writeBatch(batch: KnowledgeUpdate[]): Promise<void> {
    // Placeholder for actual persistence logic
    // Will be replaced with real knowledge graph writes in Phase 3.6
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

