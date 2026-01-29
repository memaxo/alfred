import { abortMetrics } from "@alfred/metrics/metrics-registry";

/**
 * Abort Controller Utilities
 *
 * Provides reliable abort control for long-running operations.
 * Ensures cleanup and prevents resource leaks.
 */

export interface AbortOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  onAbort?: (reason: string) => void;
}

export function createAbortController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => {
    if (!controller.signal.aborted) {
      abortMetrics.timeouts.inc({ operation: "unknown" });
      controller.abort(new Error(`Operation timed out after ${timeoutMs}ms`));
    }
  }, timeoutMs);

  return controller;
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        abortMetrics.timeouts.inc({ operation });
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

export function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "AbortError" || error.message.includes("aborted");
}

export function getAbortReason(error: unknown): string | null {
  if (!isAbortError(error)) {
    return null;
  }
  return error instanceof Error ? error.message : String(error);
}
