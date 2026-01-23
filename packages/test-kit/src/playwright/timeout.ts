/**
 * Structured Timeout Handling for Playwright Tests
 *
 * Provides deterministic timeout handling with hang detection and structured error context.
 * Matches the `alfred_test_file_start` pattern from scripts/test-bun.ts.
 */

import type { Page } from "@playwright/test";

export type TimeoutContext = {
  operation: string;
  selector?: string;
  timeout: number;
  elapsed: number;
  pageUrl: string;
  lastActivity?: string;
};

/**
 * Structured timeout error with operation context
 */
export class TimeoutError extends Error {
  constructor(public readonly context: TimeoutContext) {
    super(
      `[TIMEOUT] ${context.operation} after ${context.elapsed}ms ` +
        `(limit: ${context.timeout}ms)\n` +
        `  URL: ${context.pageUrl}\n` +
        `  ${context.selector ? `Selector: ${context.selector}\n  ` : ""}` +
        `Last activity: ${context.lastActivity ?? "unknown"}`
    );
    this.name = "PlaywrightTimeoutError";
  }
}

/**
 * Wrap actions with structured timeout handling
 *
 * @param page - Playwright page instance
 * @param operation - Name of the operation for logging
 * @param timeout - Maximum allowed duration in milliseconds
 * @param action - Async function to execute
 * @param selector - Optional selector for element operations
 * @returns Result of the action
 *
 * @example
 * ```typescript
 * await withTimeout(page, "navigate-home", 5000, async () => {
 *   await page.goto("/");
 * });
 * ```
 */
export async function withTimeout<T>(
  page: Page,
  operation: string,
  timeout: number,
  action: () => Promise<T>,
  selector?: string
): Promise<T> {
  const start = Date.now();

  try {
    return await Promise.race([
      action(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new TimeoutError({
              operation,
              selector,
              timeout,
              elapsed: Date.now() - start,
              pageUrl: page.url(),
              lastActivity: "timeout watchdog triggered",
            })
          );
        }, timeout);
      }),
    ]);
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw error;
    }

    // Wrap Playwright's native timeout errors
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Timeout") || message.includes("timeout")) {
      throw new TimeoutError({
        operation,
        selector,
        timeout,
        elapsed: Date.now() - start,
        pageUrl: page.url(),
        lastActivity: message,
      });
    }

    throw error;
  }
}

/**
 * Wait for element with hang detection
 *
 * Logs progress every 5 seconds to help identify hanging operations.
 * Matches the pattern from scripts/test-bun.ts for consistency.
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector to wait for
 * @param options - Wait options including timeout and state
 *
 * @example
 * ```typescript
 * await waitForWithHangDetection(page, '[data-testid="workflow"]', {
 *   timeout: 30000,
 *   state: "visible"
 * });
 * ```
 */
export async function waitForWithHangDetection(
  page: Page,
  selector: string,
  options: { timeout?: number; state?: "visible" | "attached" | "hidden" } = {}
): Promise<void> {
  const timeout = options.timeout ?? 30000;
  const checkInterval = 5000;
  let lastCheck = Date.now();
  let attempts = 0;

  const progressCheck = setInterval(() => {
    attempts++;
    const elapsed = Date.now() - lastCheck;
    console.log(
      `[HANG-CHECK] Waiting for "${selector}" - ${attempts * 5}s elapsed, ` +
        `${Math.round((timeout - elapsed) / 1000)}s remaining`
    );
    lastCheck = Date.now();
  }, checkInterval);

  try {
    await page.waitForSelector(selector, {
      timeout,
      state: options.state ?? "visible",
    });
  } finally {
    clearInterval(progressCheck);
  }
}

/**
 * Execute multiple actions with a shared timeout
 *
 * Useful for testing workflows that need multiple steps within a time budget.
 *
 * @param page - Playwright page instance
 * @param operation - Name of the composite operation
 * @param timeout - Total timeout for all actions
 * @param actions - Array of async functions to execute sequentially
 * @returns Array of results from each action
 *
 * @example
 * ```typescript
 * const [nav, click, assert] = await withSharedTimeout(
 *   page,
 *   "complete-workflow",
 *   10000,
 *   [
 *     async () => page.goto("/"),
 *     async () => page.click("button"),
 *     async () => expect(page.locator(".result")).toBeVisible()
 *   ]
 * );
 * ```
 */
export async function withSharedTimeout<T>(
  page: Page,
  operation: string,
  timeout: number,
  actions: Array<() => Promise<T>>
): Promise<T[]> {
  const start = Date.now();
  const results: T[] = [];

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new TimeoutError({
          operation,
          timeout,
          elapsed: Date.now() - start,
          pageUrl: page.url(),
          lastActivity: `completed ${results.length}/${actions.length} actions`,
        })
      );
    }, timeout);
  });

  try {
    await Promise.race([
      (async () => {
        for (const action of actions) {
          results.push(await action());
        }
      })(),
      timeoutPromise,
    ]);
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw error;
    }
    throw error;
  }

  return results;
}
