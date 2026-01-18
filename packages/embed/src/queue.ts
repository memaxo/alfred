/**
 * Embedding Request Queue with Batching
 * Provides queueing, batching, backpressure, and retry logic for embedding requests
 */

export type QueuedRequest = {
  id: string;
  texts: string[];
  resolve: (embeddings: number[][]) => void;
  reject: (error: Error) => void;
  queuedAt: number;
  priority: number;
};

export type QueueConfig = {
  /** Maximum queue size before rejecting requests (default: 1000) */
  maxQueueSize?: number;
  /** Maximum batch size for combining requests (default: 32) */
  maxBatchSize?: number;
  /** Maximum texts per batch (default: 64) */
  maxTextsPerBatch?: number;
  /** Time to wait for more requests before processing batch (ms, default: 10) */
  batchDelayMs?: number;
  /** Maximum time a request can wait in queue (ms, default: 60000) */
  maxQueueTimeMs?: number;
  /** Number of retry attempts for failed batches (default: 3) */
  retryCount?: number;
  /** Initial retry delay in ms, doubles each retry (default: 100) */
  retryDelayMs?: number;
};

export type QueueStats = {
  queueLength: number;
  totalQueued: number;
  totalProcessed: number;
  totalDropped: number;
  totalBatched: number;
  totalRetries: number;
  avgBatchSize: number;
  avgQueueTimeMs: number;
};

export class EmbedQueue {
  private readonly queue: QueuedRequest[] = [];
  private readonly config: Required<QueueConfig>;
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;
  private isShuttingDown = false;
  private readonly stats = {
    totalQueued: 0,
    totalProcessed: 0,
    totalDropped: 0,
    totalBatched: 0,
    totalRetries: 0,
    batchSizeSum: 0,
    queueTimeSum: 0,
  };

  constructor(
    private readonly processCallback: (texts: string[]) => Promise<number[][]>,
    config: QueueConfig = {}
  ) {
    this.config = {
      maxQueueSize: config.maxQueueSize ?? 1000,
      maxBatchSize: config.maxBatchSize ?? 32,
      maxTextsPerBatch: config.maxTextsPerBatch ?? 64,
      batchDelayMs: config.batchDelayMs ?? 10,
      maxQueueTimeMs: config.maxQueueTimeMs ?? 60_000,
      retryCount: config.retryCount ?? 3,
      retryDelayMs: config.retryDelayMs ?? 100,
    };
  }

  /**
   * Add texts to the queue for embedding
   * Returns a promise that resolves with embeddings
   */
  async enqueue(texts: string[], priority = 0): Promise<number[][]> {
    // Check queue capacity
    if (this.queue.length >= this.config.maxQueueSize) {
      this.stats.totalDropped++;
      throw new Error(
        `Queue full (${this.config.maxQueueSize} requests). Try again later.`
      );
    }

    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: crypto.randomUUID(),
        texts,
        resolve,
        reject,
        queuedAt: Date.now(),
        priority,
      };

      // Insert by priority (higher priority first)
      const insertIndex = this.queue.findIndex((r) => r.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.stats.totalQueued++;

      // Schedule batch processing
      this.scheduleBatch();
    });
  }

  /**
   * Schedule batch processing with debouncing
   */
  private scheduleBatch(): void {
    if (this.batchTimer) {
      return; // Already scheduled
    }

    // Process immediately if queue is large enough
    if (this.shouldProcessImmediately()) {
      this.processBatch();
      return;
    }

    // Otherwise wait for more requests
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.processBatch();
    }, this.config.batchDelayMs);
  }

  /**
   * Check if we should process immediately without waiting
   */
  private shouldProcessImmediately(): boolean {
    if (this.queue.length >= this.config.maxBatchSize) {
      return true;
    }

    const totalTexts = this.queue.reduce((sum, r) => sum + r.texts.length, 0);
    if (totalTexts >= this.config.maxTextsPerBatch) {
      return true;
    }

    return false;
  }

  /**
   * Process a batch of queued requests
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    // Collect requests for this batch (outside try so catch can access)
    const batch: QueuedRequest[] = [];
    let totalTexts = 0;
    const now = Date.now();

    while (this.queue.length > 0 && batch.length < this.config.maxBatchSize) {
      const next = this.queue[0];
      if (!next) {
        break;
      }

      // Check if request has timed out
      if (now - next.queuedAt > this.config.maxQueueTimeMs) {
        this.queue.shift();
        next.reject(new Error("Request timed out in queue"));
        this.stats.totalDropped++;
        continue;
      }

      // Check if adding this request exceeds text limit
      if (
        totalTexts + next.texts.length > this.config.maxTextsPerBatch &&
        batch.length > 0
      ) {
        break; // Process what we have
      }

      this.queue.shift();
      batch.push(next);
      totalTexts += next.texts.length;
    }

    if (batch.length === 0) {
      this.isProcessing = false;
      return;
    }

    // Combine all texts
    const allTexts: string[] = [];
    const textRanges: { start: number; end: number }[] = [];

    for (const req of batch) {
      const start = allTexts.length;
      allTexts.push(...req.texts);
      textRanges.push({ start, end: allTexts.length });
    }

    // Update stats
    this.stats.totalBatched++;
    this.stats.batchSizeSum += batch.length;
    for (const req of batch) {
      this.stats.queueTimeSum += now - req.queuedAt;
    }

    // Process with retry logic
    let lastError: Error | null = null;
    let allEmbeddings: number[][] | null = null;

    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      try {
        allEmbeddings = await this.processCallback(allTexts);
        break; // Success
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Processing failed");

        if (attempt < this.config.retryCount) {
          this.stats.totalRetries++;
          // Exponential backoff: 100ms, 200ms, 400ms, ...
          const delay = this.config.retryDelayMs * 2 ** attempt;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    if (allEmbeddings) {
      // Distribute results back to individual requests
      for (let i = 0; i < batch.length; i++) {
        const req = batch[i];
        const range = textRanges[i];
        if (!(req && range)) {
          continue;
        }

        const embeddings = allEmbeddings.slice(range.start, range.end);
        req.resolve(embeddings);
        this.stats.totalProcessed++;
      }
    } else {
      // All retries failed, reject all requests in this batch
      const errorMessage =
        lastError?.message ?? "Processing failed after retries";
      for (const req of batch) {
        req.reject(new Error(errorMessage));
        this.stats.totalDropped++;
      }
    }

    this.isProcessing = false;

    // Process more if queue has items
    if (this.queue.length > 0 && !this.isShuttingDown) {
      this.scheduleBatch();
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return {
      queueLength: this.queue.length,
      totalQueued: this.stats.totalQueued,
      totalProcessed: this.stats.totalProcessed,
      totalDropped: this.stats.totalDropped,
      totalBatched: this.stats.totalBatched,
      totalRetries: this.stats.totalRetries,
      avgBatchSize:
        this.stats.totalBatched > 0
          ? this.stats.batchSizeSum / this.stats.totalBatched
          : 0,
      avgQueueTimeMs:
        this.stats.totalProcessed > 0
          ? this.stats.queueTimeSum / this.stats.totalProcessed
          : 0,
    };
  }

  /**
   * Check if queue has capacity
   */
  hasCapacity(): boolean {
    return this.queue.length < this.config.maxQueueSize;
  }

  /**
   * Get current queue length
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Clear the queue, rejecting all pending requests
   */
  clear(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    for (const req of this.queue) {
      req.reject(new Error("Queue cleared"));
      this.stats.totalDropped++;
    }
    this.queue.length = 0;
  }

  /**
   * Graceful shutdown - wait for in-flight processing, reject pending
   * @param timeoutMs Maximum time to wait for in-flight requests (default: 30000)
   */
  async shutdown(timeoutMs = 30_000): Promise<void> {
    this.isShuttingDown = true;

    // Stop accepting new batches
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Wait for in-flight processing to complete
    const startTime = Date.now();
    while (this.isProcessing && Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, 50));
    }

    // Reject any remaining queued requests
    for (const req of this.queue) {
      req.reject(new Error("Queue shutdown"));
      this.stats.totalDropped++;
    }
    this.queue.length = 0;

    this.isShuttingDown = false;
  }

  /**
   * Check if queue is shutting down
   */
  get shuttingDown(): boolean {
    return this.isShuttingDown;
  }
}
