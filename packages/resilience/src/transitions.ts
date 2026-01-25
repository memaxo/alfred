/**
 * Transition Guard Utilities
 *
 * Prevents infinite loops in state machines and workflow orchestration.
 */

/**
 * Transition counter for detecting runaway state machines.
 */
export class TransitionGuard {
  private count = 0;
  private readonly maxTransitions: number;
  private readonly onExceeded?: (count: number) => void;

  constructor(maxTransitions = 50, onExceeded?: (count: number) => void) {
    this.maxTransitions = maxTransitions;
    this.onExceeded = onExceeded;
  }

  /**
   * Increment transition count and check limit.
   *
   * @returns True if under limit, false if exceeded
   * @throws Error if limit exceeded and no callback provided
   */
  tick(): boolean {
    this.count++;

    if (this.count > this.maxTransitions) {
      if (this.onExceeded) {
        this.onExceeded(this.count);
        return false;
      }
      throw new Error(
        `Exceeded maximum transitions (${this.maxTransitions}). Possible infinite loop detected.`
      );
    }

    return true;
  }

  /**
   * Reset the transition counter.
   */
  reset(): void {
    this.count = 0;
  }

  /**
   * Get current transition count.
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Check if limit has been reached.
   */
  isExceeded(): boolean {
    return this.count > this.maxTransitions;
  }
}

/**
 * Create a transition guard from environment variable.
 *
 * @param envKey - Environment variable name
 * @param defaultMax - Default max if env not set
 * @returns New transition guard
 */
export function createGuardFromEnv(
  envKey: string,
  defaultMax = 50
): TransitionGuard {
  const max = Number.parseInt(process.env[envKey] ?? String(defaultMax), 10);
  return new TransitionGuard(Number.isNaN(max) ? defaultMax : max);
}

/**
 * Options for guarded execution.
 */
export interface GuardedExecutionOptions {
  /** Maximum iterations before throwing */
  maxIterations?: number;
  /** Optional callback when limit exceeded */
  onExceeded?: (count: number) => void;
  /** Optional callback after each iteration */
  onIteration?: (count: number) => void;
}

/**
 * Execute a function repeatedly until condition is met, with transition guard.
 *
 * @param condition - Function that returns true to continue, false to stop
 * @param fn - Function to execute each iteration
 * @param options - Guard options
 * @returns Final iteration count
 */
export async function guardedLoop(
  condition: () => boolean | Promise<boolean>,
  fn: () => void | Promise<void>,
  options: GuardedExecutionOptions = {}
): Promise<number> {
  const guard = new TransitionGuard(
    options.maxIterations ?? 50,
    options.onExceeded
  );

  while (await condition()) {
    guard.tick();
    await fn();
    options.onIteration?.(guard.getCount());
  }

  return guard.getCount();
}
