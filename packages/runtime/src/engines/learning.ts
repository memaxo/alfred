/**
 * Learning Engine Wrapper
 *
 * Wraps self-supervision functions from @alfred/learning
 * Records outcomes and generates knowledge updates
 */

import {
  type SupervisionEvent as LearningSupervisionEvent,
  supervise,
} from "@alfred/learning/self_supervision";
import { logger } from "@alfred/logger";
import type { KnowledgeUpdate } from "@alfred/type/knowledge";
import {
  runtimeKnowledgeBatchDurationSeconds,
  runtimeKnowledgeUpdatesTotal,
} from "../metrics";
import { RuntimeKnowledgeBridge } from "./bridge";

/**
 * Supervision event for learning from outcomes.
 *
 * Thin alias to the canonical SupervisionEvent from @alfred/learning.
 */
export type SupervisionEvent = LearningSupervisionEvent;

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
  private readonly bridges = new Map<string, RuntimeKnowledgeBridge>();

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
      if (Array.isArray(result) && result.length > 0) {
        updates.push(...result);
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
    if (updates.length === 0) {
      return;
    }

    const startTime = Date.now();
    const stopTimer = runtimeKnowledgeBatchDurationSeconds.startTimer({
      operation: "persist",
    });

    logger.info("runtime_knowledge_batch_start", {
      runId,
      updateCount: updates.length,
    });

    try {
      const bridge = this.getBridge(runId);
      bridge.applyUpdates(updates);

      runtimeKnowledgeUpdatesTotal.inc(
        { type: "batch", status: "success" },
        updates.length
      );

      await bridge.persist();

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
   * Get or create the knowledge bridge for a given run.
   *
   * Bridges maintain a per-run hypergraph that is flushed to the
   * durable knowledge graph via persistHypergraphToDb.
   */
  private getBridge(runId: string): RuntimeKnowledgeBridge {
    let bridge = this.bridges.get(runId);
    if (!bridge) {
      const resource = `runtime:${runId}`;
      bridge = new RuntimeKnowledgeBridge({ runId, resource });
      this.bridges.set(runId, bridge);
    }
    return bridge;
  }
}
