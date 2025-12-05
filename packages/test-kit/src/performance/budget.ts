/**
 * Performance Budget Helpers for Integration Tests
 *
 * Provides utilities for asserting and tracking performance budgets
 * in integration tests.
 *
 * Usage:
 *   import { withBudget, assertBudget, PerformanceTracker } from '@alfred/test-kit/performance';
 *
 *   const result = await withBudget('db-query', 10, async () => {
 *     return await db.select().from(users);
 *   });
 *
 *   assertBudget('workflow-stream', latencyMs, 100);
 */

/**
 * Performance budget categories with their default limits (in milliseconds)
 */
export const BUDGET_DEFAULTS = {
  /** Database queries */
  "db-query": 10,
  /** Workflow streaming latency */
  "workflow-stream": 100,
  /** State transitions (cognitive) */
  "state-transition": 0.1, // 100 microseconds
  /** Graph lookups */
  "graph-lookup": 1,
  /** Fact extraction */
  "fact-extraction": 10,
  /** Plan generation */
  "plan-generation": 100,
  /** UI render cycles (60fps target) */
  "ui-render": 16,
  /** STT processing */
  "stt-processing": 500,
  /** TTS processing */
  "tts-processing": 500,
  /** Full voice round-trip */
  "voice-roundtrip": 1000,
} as const;

export type BudgetCategory = keyof typeof BUDGET_DEFAULTS;

/**
 * Result of a budget-tracked operation
 */
export type BudgetResult<T> = {
  result: T;
  durationMs: number;
  withinBudget: boolean;
  budgetMs: number;
};

/**
 * Assertion error for budget violations
 */
export class BudgetExceededError extends Error {
  constructor(
    public readonly name: string,
    public readonly durationMs: number,
    public readonly budgetMs: number
  ) {
    super(
      `Performance budget exceeded: "${name}" took ${durationMs.toFixed(2)}ms (budget: ${budgetMs}ms)`
    );
    this.name = "BudgetExceededError";
  }
}

/**
 * Execute a function and track its duration against a budget
 *
 * @param name - Name of the operation for logging
 * @param budgetMs - Maximum allowed duration in milliseconds
 * @param fn - Async function to execute
 * @returns Result with timing information
 *
 * @example
 * ```typescript
 * const { result, durationMs, withinBudget } = await withBudget(
 *   'db-query',
 *   10,
 *   async () => db.select().from(users)
 * );
 * expect(withinBudget).toBe(true);
 * ```
 */
export async function withBudget<T>(
  name: string,
  budgetMs: number,
  fn: () => Promise<T>
): Promise<BudgetResult<T>> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  const withinBudget = durationMs <= budgetMs;

  return {
    result,
    durationMs,
    withinBudget,
    budgetMs,
  };
}

/**
 * Execute a function with a default budget for the category
 *
 * @param category - Budget category from BUDGET_DEFAULTS
 * @param fn - Async function to execute
 * @returns Result with timing information
 *
 * @example
 * ```typescript
 * const { result, withinBudget } = await withDefaultBudget(
 *   'db-query',
 *   async () => db.select().from(users)
 * );
 * ```
 */
export async function withDefaultBudget<T>(
  category: BudgetCategory,
  fn: () => Promise<T>
): Promise<BudgetResult<T>> {
  return withBudget(category, BUDGET_DEFAULTS[category], fn);
}

/**
 * Assert that a duration is within budget, throwing if exceeded
 *
 * @param name - Name of the operation for error messages
 * @param durationMs - Actual duration in milliseconds
 * @param budgetMs - Maximum allowed duration
 * @throws BudgetExceededError if budget is exceeded
 *
 * @example
 * ```typescript
 * const start = performance.now();
 * await someOperation();
 * assertBudget('operation', performance.now() - start, 100);
 * ```
 */
export function assertBudget(
  name: string,
  durationMs: number,
  budgetMs: number
): void {
  if (durationMs > budgetMs) {
    throw new BudgetExceededError(name, durationMs, budgetMs);
  }
}

/**
 * Assert that a duration is within the default budget for a category
 *
 * @param category - Budget category from BUDGET_DEFAULTS
 * @param durationMs - Actual duration in milliseconds
 * @throws BudgetExceededError if budget is exceeded
 */
export function assertDefaultBudget(
  category: BudgetCategory,
  durationMs: number
): void {
  assertBudget(category, durationMs, BUDGET_DEFAULTS[category]);
}

/**
 * Performance tracker for collecting metrics across multiple operations
 */
export class PerformanceTracker {
  private readonly measurements: Map<
    string,
    { durations: number[]; budgetMs: number }
  > = new Map();

  /**
   * Record a measurement
   */
  record(name: string, durationMs: number, budgetMs: number): void {
    let entry = this.measurements.get(name);
    if (!entry) {
      entry = { durations: [], budgetMs };
      this.measurements.set(name, entry);
    }
    entry.durations.push(durationMs);
  }

  /**
   * Get statistics for a measurement
   */
  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    budgetMs: number;
    violations: number;
  } | null {
    const entry = this.measurements.get(name);
    if (!entry || entry.durations.length === 0) {
      return null;
    }

    const sorted = [...entry.durations].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    const percentile = (p: number): number => {
      const idx = Math.ceil((p / 100) * count) - 1;
      return sorted[Math.max(0, idx)]!;
    };

    return {
      count,
      min: sorted[0]!,
      max: sorted[count - 1]!,
      avg: sum / count,
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      budgetMs: entry.budgetMs,
      violations: sorted.filter((d) => d > entry.budgetMs).length,
    };
  }

  /**
   * Get all measurements
   */
  getAllStats(): Map<string, ReturnType<PerformanceTracker["getStats"]>> {
    const result = new Map<
      string,
      ReturnType<PerformanceTracker["getStats"]>
    >();
    for (const name of this.measurements.keys()) {
      result.set(name, this.getStats(name));
    }
    return result;
  }

  /**
   * Check if any measurements exceeded their budgets
   */
  hasViolations(): boolean {
    for (const name of this.measurements.keys()) {
      const stats = this.getStats(name);
      if (stats && stats.violations > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get a summary of all violations
   */
  getViolationSummary(): string[] {
    const violations: string[] = [];
    for (const [name, entry] of this.measurements) {
      const stats = this.getStats(name);
      if (stats && stats.violations > 0) {
        violations.push(
          `${name}: ${stats.violations}/${stats.count} exceeded ${entry.budgetMs}ms (max: ${stats.max.toFixed(2)}ms, p99: ${stats.p99.toFixed(2)}ms)`
        );
      }
    }
    return violations;
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
  }
}

/**
 * Global performance tracker instance for test suites
 */
export const globalTracker = new PerformanceTracker();

/**
 * Decorator-style helper for tracking async operations
 *
 * @example
 * ```typescript
 * const trackedQuery = trackPerformance('db-query', 10, async (id: string) => {
 *   return db.select().from(users).where(eq(users.id, id));
 * });
 *
 * const user = await trackedQuery('user-123');
 * ```
 */
export function trackPerformance<TArgs extends unknown[], TResult>(
  name: string,
  budgetMs: number,
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const start = performance.now();
    try {
      return await fn(...args);
    } finally {
      const durationMs = performance.now() - start;
      globalTracker.record(name, durationMs, budgetMs);
    }
  };
}

/**
 * Run multiple iterations and check average performance
 *
 * @example
 * ```typescript
 * const stats = await benchmarkOperation(
 *   'graph-lookup',
 *   1, // 1ms budget
 *   100, // 100 iterations
 *   async () => graph.neighbors(nodeId)
 * );
 * expect(stats.p99).toBeLessThan(1);
 * ```
 */
export async function benchmarkOperation<T>(
  name: string,
  budgetMs: number,
  iterations: number,
  fn: () => Promise<T>
): Promise<{
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  budgetMs: number;
  violations: number;
}> {
  const tracker = new PerformanceTracker();

  // Warm-up run
  await fn();

  // Timed runs
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const durationMs = performance.now() - start;
    tracker.record(name, durationMs, budgetMs);
  }

  const stats = tracker.getStats(name);
  if (!stats) {
    throw new Error(`No measurements recorded for ${name}`);
  }

  return stats;
}
