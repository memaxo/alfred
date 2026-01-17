/**
 * Abort Signal Utilities
 *
 * Helpers for managing AbortSignal propagation and cleanup in async workflows.
 */

/**
 * Create a child AbortSignal that aborts when parent aborts.
 *
 * @param parent - Parent signal to link
 * @returns Child controller that aborts with parent
 */
export function createLinkedAbortController(
  parent: AbortSignal
): AbortController {
  const controller = new AbortController();

  if (parent.aborted) {
    controller.abort();
    return controller;
  }

  const onAbort = () => {
    controller.abort();
    parent.removeEventListener("abort", onAbort);
  };

  parent.addEventListener("abort", onAbort);
  return controller;
}

/**
 * Create a promise that rejects when signal aborts.
 *
 * @param signal - Abort signal to watch
 * @param message - Error message on abort
 * @returns Promise that rejects on abort
 */
export function abortablePromise(
  signal: AbortSignal,
  message = "Operation aborted"
): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(new Error(message));
      return;
    }

    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new Error(message));
    };

    signal.addEventListener("abort", onAbort);
  });
}

/**
 * Race an operation against an abort signal.
 *
 * @param operation - Async operation to execute
 * @param signal - Abort signal to race against
 * @param message - Error message if aborted
 * @returns Operation result or throws if aborted
 */
export function raceWithAbort<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  message = "Operation aborted"
): Promise<T> {
  return Promise.race([operation, abortablePromise(signal, message)]);
}

/**
 * Check if signal is aborted and throw if so.
 *
 * @param signal - Signal to check
 * @param message - Error message if aborted
 * @throws Error if signal is aborted
 */
export function throwIfAborted(
  signal: AbortSignal,
  message = "Operation aborted"
): void {
  if (signal.aborted) {
    throw new Error(message);
  }
}

/**
 * Create a timeout-based AbortSignal.
 *
 * @param ms - Milliseconds until abort
 * @returns Abort signal that triggers after timeout
 */
export function createTimeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/**
 * Combine multiple abort signals into one.
 *
 * @param signals - Signals to combine
 * @returns Combined signal that aborts when any parent aborts
 */
export function combineAbortSignals(
  ...signals: AbortSignal[]
): AbortController {
  const controller = new AbortController();

  // Check if any are already aborted
  if (signals.some((s) => s.aborted)) {
    controller.abort();
    return controller;
  }

  const onAbort = () => {
    controller.abort();
    // Cleanup all listeners
    for (const signal of signals) {
      signal.removeEventListener("abort", onAbort);
    }
  };

  // Listen to all signals
  for (const signal of signals) {
    signal.addEventListener("abort", onAbort);
  }

  return controller;
}
