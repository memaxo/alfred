/**
 * Learning Engine Wrapper
 * 
 * Wraps self-supervision functions from @alfred/learning
 * Records outcomes and generates knowledge updates
 */

import { supervise } from "@alfred/learning/self_supervision";

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
}

