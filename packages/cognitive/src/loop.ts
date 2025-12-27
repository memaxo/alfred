/**
 * Embedding-Centric Loop Detection
 *
 * 4-layer detection ordered by cost:
 * - Layer 0: COUNT (O(1), 0ns) - Hard cap on transitions
 * - Layer 1: TIME (O(1), 0ns) - Stall detection
 * - Layer 2: HASH (O(n), ~1µs) - Exact string match via FNV-1a
 * - Layer 3: QUANTIZED (O(n), ~10µs) - Semantic similarity via quantized embeddings
 */

import {
  type QuantizedEmbedding,
  quantizedCosineSimilarity,
  quantizeToInt8,
} from "@alfred/embed";

/**
 * Configuration for loop detection thresholds
 */
export type LoopConfig = {
  /** Layer 0: Maximum transitions before forced termination (default: 500) */
  maxTransitions: number;
  /** Layer 1: Milliseconds without activity before stall detection (default: 60000) */
  stallMs: number;
  /** Layers 2-3: Number of entries in sliding window (default: 8) */
  windowSize: number;
  /** Layer 3: Cosine similarity threshold for semantic loop detection (default: 0.92) */
  similarityThreshold: number;
};

const DEFAULT_CONFIG: LoopConfig = {
  maxTransitions: 500,
  stallMs: 60_000,
  windowSize: 8,
  similarityThreshold: 0.92,
};

type WindowEntry = {
  hash: string;
  quantized: QuantizedEmbedding | null;
  ts: number;
};

export type LoopResult =
  | { loop: false }
  | { loop: true; reason: string; layer: number };

/**
 * Unified loop detector using layered, cost-ordered checks.
 *
 * Embeddings are the "juice" - all other checks are cheap prefilters.
 */
export class LoopDetector {
  private window: WindowEntry[] = [];
  private transitionCount = 0;
  private lastTs = Date.now();
  private readonly config: LoopConfig;

  constructor(config: Partial<LoopConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check for loop conditions. Layers are checked in order of cost.
   *
   * @param content - Text content to check (thought, command, etc.)
   * @param embedding - Optional pre-computed embedding vector
   * @returns Loop result with reason and layer if detected
   */
  check(content: string, embedding: number[] | null = null): LoopResult {
    const now = Date.now();
    this.transitionCount++;

    // Layer 0: COUNT (O(1), 0ns)
    if (this.transitionCount > this.config.maxTransitions) {
      return { loop: true, reason: "max_transitions", layer: 0 };
    }

    // Layer 1: TIME (O(1), 0ns)
    // Only check stall if we have previous activity
    if (this.lastTs > 0 && now - this.lastTs > this.config.stallMs) {
      return { loop: true, reason: "stall", layer: 1 };
    }
    this.lastTs = now;

    // Layer 2: HASH (O(n), ~1µs)
    const hash = this.fastHash(content);
    for (const entry of this.window) {
      if (entry.hash === hash) {
        return { loop: true, reason: "exact_match", layer: 2 };
      }
    }

    // Layer 3: QUANTIZED EMBEDDING (O(n), ~10µs)
    let quantized: QuantizedEmbedding | null = null;
    if (embedding && embedding.length > 0) {
      quantized = quantizeToInt8(embedding);

      for (const entry of this.window) {
        if (!entry.quantized) {
          continue;
        }
        const sim = quantizedCosineSimilarity(quantized, entry.quantized);
        if (sim > this.config.similarityThreshold) {
          return {
            loop: true,
            reason: `semantic_similarity:${sim.toFixed(3)}`,
            layer: 3,
          };
        }
      }
    }

    // Update sliding window
    this.window.push({ hash, quantized, ts: now });
    if (this.window.length > this.config.windowSize) {
      this.window.shift();
    }

    return { loop: false };
  }

  /**
   * FNV-1a hash for fast exact-match detection.
   * Chosen for speed and good distribution on short strings.
   */
  private fastHash(s: string): string {
    let h = 2_166_136_261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16_777_619) >>> 0;
    }
    return h.toString(36);
  }

  /** Reset all state (transition count, window, timestamps) */
  reset(): void {
    this.window = [];
    this.transitionCount = 0;
    this.lastTs = Date.now();
  }

  /** Get current transition count for observability */
  getTransitionCount(): number {
    return this.transitionCount;
  }

  /** Get current window size for observability */
  getWindowSize(): number {
    return this.window.length;
  }
}
