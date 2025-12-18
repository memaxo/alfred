/**
 * Token Bucket Rate Limiter
 */

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillRate: number // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Attempt to consume tokens. Returns true if successful.
   */
  consume(amount = 1): boolean {
    this.refill();
    if (this.tokens >= amount) {
      this.tokens -= amount;
      return true;
    }
    return false;
  }

  /**
   * Wait until tokens are available
   */
  async waitFor(amount = 1, timeoutMs = 30_000): Promise<boolean> {
    const start = Date.now();
    while (true) {
      if (this.consume(amount)) {
        return true;
      }
      if (Date.now() - start > timeoutMs) {
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private refill() {
    const now = Date.now();
    const delta = (now - this.lastRefill) / 1000;
    const tokensToAdd = delta * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

/**
 * Concurrency Semaphore
 */
export class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.active--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.active++; // Immediately claim for next
      next?.();
    }
  }

  /**
   * Run a task with semaphore protection
   */
  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }
}

// Global instances
// Default: 10 concurrent LLM calls, 50 requests per minute (approx 0.83 per sec)
export const llmConcurrency = new Semaphore(
  Number.parseInt(process.env.LLM_CONCURRENCY || "10", 10)
);
export const llmRateLimit = new TokenBucket(
  Number.parseInt(process.env.LLM_RATE_LIMIT_CAPACITY || "50", 10),
  Number.parseFloat(process.env.LLM_RATE_LIMIT_REFILL || "0.83")
);
