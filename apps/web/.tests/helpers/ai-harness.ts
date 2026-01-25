/**
 * Unified AI Test Harness for Playwright
 *
 * Combines screenshots, error monitoring, timeout handling, and crash detection
 * into a single fixture following the withTestHarness pattern from screenshot.ts.
 */

import type { CrashMonitorHandle } from "@alfred/test-kit/playwright/crash";

import { createCrashMonitor } from "@alfred/test-kit/playwright/crash";
import { TimeoutError, withTimeout } from "@alfred/test-kit/playwright/timeout";
import { test as base, expect } from "@playwright/test";

import {
  createErrorMonitor,
  createScreenshotManager,
  type ErrorMonitor,
  type ScreenshotManager,
} from "./screenshot.js";

/**
 * AI Test Fixture with integrated capabilities
 */
export interface AITestFixture {
  /** Screenshot manager for visual captures */
  screenshots: ScreenshotManager;
  /** Error monitor for runtime error detection */
  errors: ErrorMonitor;
  /** Crash monitor for browser/page crash detection */
  crashes: CrashMonitorHandle;
  /** Wrap action with timeout and screenshot on failure */
  safeAction: <T>(
    name: string,
    action: () => Promise<T>,
    timeout?: number
  ) => Promise<T>;
  /** Assert with automatic screenshot capture on failure */
  safeAssert: <T>(name: string, assertion: () => Promise<T>) => Promise<T>;
}

/**
 * AI-optimized test harness with integrated monitoring
 *
 * Usage:
 * ```typescript
 * import { test, expect } from "./helpers/ai-harness";
 *
 * test("workflow renders", async ({ page, screenshots, safeAction, safeAssert }) => {
 *   await safeAction("navigate", async () => {
 *     await page.goto("/");
 *   });
 *
 *   await screenshots.capturePageLoad("home");
 *
 *   await safeAssert("workflow-visible", async () => {
 *     await expect(page.locator('[data-testid="workflow"]')).toBeVisible();
 *   });
 * });
 * ```
 */
export const test = base.extend<AITestFixture>({
  screenshots: async ({ page }, use, testInfo) => {
    const manager = createScreenshotManager(page, testInfo);
    await use(manager);

    // Attach metadata summary
    await testInfo.attach("screenshot-metadata", {
      body: manager.getSummary(),
      contentType: "application/json",
    });
  },

  errors: async ({ page }, use, testInfo) => {
    const monitor = createErrorMonitor(page, testInfo, {
      failFast: true,
      failOnSeverity: ["critical", "error"],
    });
    monitor.attach();

    await use(monitor);

    await monitor.attachToReport();
    monitor.detach();

    if (testInfo.status === "passed") {
      monitor.assertNoErrors();
    }
  },

  crashes: async ({ page, context, screenshots }, use, testInfo) => {
    const monitor = createCrashMonitor(page, context, testInfo, screenshots);

    await use(monitor);

    await monitor.attachReport();

    if (monitor.hasCrashed()) {
      await testInfo.attach("crash-report-text", {
        body: monitor.getReport(),
        contentType: "text/plain",
      });
    }
  },

  safeAction: async ({ page, screenshots }, use) => {
    const safeAction = async <T>(
      name: string,
      action: () => Promise<T>,
      timeout = 30_000
    ): Promise<T> => {
      try {
        return await withTimeout(page, name, timeout, action);
      } catch (error) {
        const path = await screenshots.captureError(name);

        if (error instanceof TimeoutError) {
          error.message += `\n[SCREENSHOT] ${path}`;
        }

        throw error;
      }
    };

    await use(safeAction);
  },

  safeAssert: async ({ screenshots }, use) => {
    const safeAssert = async <T>(
      name: string,
      assertion: () => Promise<T>
    ): Promise<T> => {
      try {
        return await assertion();
      } catch (error) {
        const path = await screenshots.captureError(`assertion_${name}`);
        const augmented = new Error(
          `Assertion "${name}" failed\n` +
            `${error instanceof Error ? error.message : String(error)}\n` +
            `[SCREENSHOT] ${path}`
        );
        augmented.stack = error instanceof Error ? error.stack : undefined;
        throw augmented;
      }
    };

    await use(safeAssert);
  },
});

export { expect };
