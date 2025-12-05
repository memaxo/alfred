/**
 * ADWIN (ADaptive WINdowing) Algorithm for Concept Drift Detection
 *
 * Detects changes in the underlying distribution of streaming data
 * by maintaining a variable-length window that automatically shrinks
 * when a change is detected.
 *
 * Reference: albert-memory-review.md - "ADWIN for concept drift detection"
 * Paper: "Learning from Time-Changing Data with Adaptive Windowing" (Bifet & Gavalda, 2007)
 *
 * Key properties:
 * 1. No prior knowledge of drift timing required
 * 2. Provides statistical guarantees on false positive/negative rates
 * 3. Adapts window size automatically based on data characteristics
 * 4. Memory-efficient using exponential histogram compression
 */

/**
 * Bucket in the exponential histogram
 * Each bucket stores statistics for a contiguous subsequence
 */
type Bucket = {
  total: number; // Sum of values in bucket
  variance: number; // Variance of values (for improved detection)
  count: number; // Number of elements
};

/**
 * ADWIN configuration options
 */
export type AdwinConfig = {
  /** Confidence parameter delta (default: 0.002) */
  delta?: number;
  /** Maximum number of buckets per level (default: 5) */
  maxBuckets?: number;
  /** Minimum window size before detection (default: 10) */
  minWindowSize?: number;
  /** Clock for timestamps (default: Date.now) */
  clock?: () => number;
};

/**
 * Drift detection result
 */
export type DriftResult = {
  /** Whether drift was detected */
  driftDetected: boolean;
  /** Current window mean */
  mean: number;
  /** Current window size */
  windowSize: number;
  /** Current window variance */
  variance: number;
  /** Number of elements dropped due to drift */
  droppedCount: number;
  /** Timestamp of detection */
  timestamp: number;
};

/**
 * Snapshot of ADWIN state for persistence
 */
export type AdwinSnapshot = {
  buckets: Bucket[][];
  total: number;
  count: number;
  variance: number;
  lastDriftTime: number | null;
  driftCount: number;
};

/**
 * ADWIN change detector
 *
 * Maintains an adaptive sliding window over a stream of numeric values.
 * Automatically detects distribution changes and shrinks the window.
 */
export class Adwin {
  private buckets: Bucket[][] = []; // Exponential histogram levels
  private total = 0; // Sum of all values in window
  private count = 0; // Total count in window
  private variance = 0; // Running variance estimate
  private lastDriftTime: number | null = null;
  private driftCount = 0;

  private readonly delta: number;
  private readonly maxBuckets: number;
  private readonly minWindowSize: number;
  private readonly clock: () => number;

  constructor(config: AdwinConfig = {}) {
    this.delta = config.delta ?? 0.002;
    this.maxBuckets = config.maxBuckets ?? 5;
    this.minWindowSize = config.minWindowSize ?? 10;
    this.clock = config.clock ?? (() => Date.now());
  }

  /**
   * Add a new observation to the window.
   * Returns drift detection result.
   */
  add(value: number): DriftResult {
    // Update running statistics
    this.count++;
    const oldMean = this.count > 1 ? this.total / (this.count - 1) : 0;
    this.total += value;
    const newMean = this.total / this.count;

    // Welford's online variance algorithm
    if (this.count > 1) {
      this.variance += (value - oldMean) * (value - newMean);
    }

    // Add to first bucket level
    this.insertBucket(value);

    // Compress buckets if needed
    this.compressBuckets();

    // Check for drift
    let droppedCount = 0;
    let driftDetected = false;

    if (this.count >= this.minWindowSize) {
      const result = this.detectAndRemoveDrift();
      droppedCount = result.dropped;
      driftDetected = result.detected;

      if (driftDetected) {
        this.lastDriftTime = this.clock();
        this.driftCount++;
      }
    }

    return {
      driftDetected,
      mean: this.getMean(),
      windowSize: this.count,
      variance: this.getVariance(),
      droppedCount,
      timestamp: this.clock(),
    };
  }

  /**
   * Get current window mean
   */
  getMean(): number {
    return this.count > 0 ? this.total / this.count : 0;
  }

  /**
   * Get current window variance
   */
  getVariance(): number {
    return this.count > 1 ? this.variance / (this.count - 1) : 0;
  }

  /**
   * Get current window standard deviation
   */
  getStdDev(): number {
    return Math.sqrt(this.getVariance());
  }

  /**
   * Get current window size
   */
  getWindowSize(): number {
    return this.count;
  }

  /**
   * Get number of drifts detected
   */
  getDriftCount(): number {
    return this.driftCount;
  }

  /**
   * Get time since last drift (ms)
   */
  getTimeSinceLastDrift(): number | null {
    if (this.lastDriftTime === null) {
      return null;
    }
    return this.clock() - this.lastDriftTime;
  }

  /**
   * Reset the detector to initial state
   */
  reset(): void {
    this.buckets = [];
    this.total = 0;
    this.count = 0;
    this.variance = 0;
    this.lastDriftTime = null;
    this.driftCount = 0;
  }

  /**
   * Export state for persistence
   */
  snapshot(): AdwinSnapshot {
    return {
      buckets: this.buckets.map((level) => level.map((b) => ({ ...b }))),
      total: this.total,
      count: this.count,
      variance: this.variance,
      lastDriftTime: this.lastDriftTime,
      driftCount: this.driftCount,
    };
  }

  /**
   * Restore state from snapshot
   */
  restore(snapshot: AdwinSnapshot): void {
    this.buckets = snapshot.buckets.map((level) =>
      level.map((b) => ({ ...b }))
    );
    this.total = snapshot.total;
    this.count = snapshot.count;
    this.variance = snapshot.variance;
    this.lastDriftTime = snapshot.lastDriftTime;
    this.driftCount = snapshot.driftCount;
  }

  /**
   * Insert value as a new bucket at level 0
   */
  private insertBucket(value: number): void {
    if (this.buckets.length === 0) {
      this.buckets.push([]);
    }

    const firstLevel = this.buckets[0];
    if (firstLevel) {
      firstLevel.push({
        total: value,
        variance: 0,
        count: 1,
      });
    }
  }

  /**
   * Compress buckets to maintain exponential histogram structure
   */
  private compressBuckets(): void {
    for (let level = 0; level < this.buckets.length; level++) {
      const bucketLevel = this.buckets[level];
      if (!bucketLevel) continue;

      while (bucketLevel.length > this.maxBuckets) {
        // Merge two oldest buckets
        const b1 = bucketLevel.shift();
        const b2 = bucketLevel.shift();

        if (b1 && b2) {
          const merged = this.mergeBuckets(b1, b2);

          // Push to next level
          if (this.buckets.length <= level + 1) {
            this.buckets.push([]);
          }
          this.buckets[level + 1]?.push(merged);
        }
      }
    }
  }

  /**
   * Merge two buckets into one
   */
  private mergeBuckets(b1: Bucket, b2: Bucket): Bucket {
    const combinedCount = b1.count + b2.count;
    const combinedTotal = b1.total + b2.total;

    // Parallel variance formula
    const mean1 = b1.count > 0 ? b1.total / b1.count : 0;
    const mean2 = b2.count > 0 ? b2.total / b2.count : 0;

    const delta = mean1 - mean2;
    const combinedVariance =
      b1.variance +
      b2.variance +
      (delta * delta * (b1.count * b2.count)) / combinedCount;

    return {
      total: combinedTotal,
      variance: combinedVariance,
      count: combinedCount,
    };
  }

  /**
   * Detect drift and remove old data if found
   * Returns number of elements dropped
   */
  private detectAndRemoveDrift(): { detected: boolean; dropped: number } {
    let dropped = 0;
    let detected = false;

    // Try to cut the window at each possible position
    const windowSize = this.count;
    let prefixTotal = 0;
    let prefixCount = 0;

    // Iterate through buckets from oldest to newest
    for (let level = this.buckets.length - 1; level >= 0; level--) {
      const bucketLevel = this.buckets[level];
      if (!bucketLevel) continue;

      for (let i = 0; i < bucketLevel.length; i++) {
        const bucket = bucketLevel[i];
        if (!bucket) continue;

        prefixTotal += bucket.total;
        prefixCount += bucket.count;

        const suffixCount = windowSize - prefixCount;
        if (prefixCount < 1 || suffixCount < 1) {
          continue;
        }

        const prefixMean = prefixTotal / prefixCount;
        const suffixTotal = this.total - prefixTotal;
        const suffixMean = suffixTotal / suffixCount;

        // ADWIN cut criterion
        const cutValue = this.calculateCutValue(
          prefixCount,
          suffixCount,
          prefixMean,
          suffixMean
        );

        if (cutValue > 0) {
          // Drift detected - remove prefix
          detected = true;
          dropped += prefixCount;

          // Remove buckets
          this.removeBucketsUpTo(level, i);

          // Update statistics
          this.total = suffixTotal;
          this.count = suffixCount;
          // Variance is harder to update, approximate
          this.variance *= suffixCount / windowSize;

          return { detected, dropped };
        }
      }
    }

    return { detected, dropped };
  }

  /**
   * Calculate ADWIN cut criterion
   * Returns positive value if cut should be made
   */
  private calculateCutValue(
    n0: number,
    n1: number,
    mean0: number,
    mean1: number
  ): number {
    const deltaP = Math.abs(mean0 - mean1);

    // Hoeffding bound approximation
    const m = 1 / n0 + 1 / n1;
    const epsilon = Math.sqrt((2 / m) * Math.log(2 / this.delta));

    return deltaP - epsilon;
  }

  /**
   * Remove buckets from oldest up to specified position
   */
  private removeBucketsUpTo(level: number, index: number): void {
    // Remove all buckets older than (level, index)
    for (let l = this.buckets.length - 1; l > level; l--) {
      this.buckets[l] = [];
    }

    const bucketLevel = this.buckets[level];
    if (bucketLevel) {
      this.buckets[level] = bucketLevel.slice(index + 1);
    }

    // Clean up empty levels
    while (
      this.buckets.length > 0 &&
      (this.buckets[this.buckets.length - 1]?.length ?? 0) === 0
    ) {
      this.buckets.pop();
    }
  }
}

/**
 * Create a new ADWIN detector with default configuration
 */
export function createAdwin(config?: AdwinConfig): Adwin {
  return new Adwin(config);
}
