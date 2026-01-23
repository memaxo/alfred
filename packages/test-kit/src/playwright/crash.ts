/**
 * Crash Detection & Recovery for Playwright Tests
 *
 * Monitors browser/page crashes with structured reporting.
 * Follows the fixture handle pattern from workflow/runtime-fixture.ts.
 */

import type { BrowserContext, Page, TestInfo } from "@playwright/test";

export type CrashReport = {
  type: "browser-crash" | "context-crash" | "page-crash" | "render-crash";
  timestamp: string;
  url: string;
  screenshot?: string;
  consoleErrors: string[];
  networkErrors: string[];
};

export type CrashMonitorHandle = {
  getCrashes: () => CrashReport[];
  hasCrashed: () => boolean;
  attachReport: () => Promise<void>;
  getReport: () => string;
};

/**
 * Screenshot manager interface for crash captures
 */
export type ScreenshotCapture = {
  captureError: (name: string) => Promise<string>;
};

/**
 * Monitor for browser/page crashes with recovery
 *
 * Follows the fixture handle pattern from @alfred/test-kit/workflow.
 *
 * @param page - Playwright page instance
 * @param context - Browser context
 * @param testInfo - Test metadata
 * @param screenshots - Optional screenshot manager for crash captures
 * @returns Handle with crash reporting methods
 *
 * @example
 * ```typescript
 * test("my test", async ({ page, context }, testInfo) => {
 *   const crashMonitor = createCrashMonitor(page, context, testInfo);
 *
 *   // Test actions...
 *
 *   await crashMonitor.attachReport();
 *   if (crashMonitor.hasCrashed()) {
 *     console.log(crashMonitor.getReport());
 *   }
 * });
 * ```
 */
export function createCrashMonitor(
  page: Page,
  context: BrowserContext,
  testInfo: TestInfo,
  screenshots?: ScreenshotCapture
): CrashMonitorHandle {
  const crashes: CrashReport[] = [];
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  // Track console errors for crash context
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  // Track network failures
  page.on("requestfailed", (request) => {
    networkErrors.push(`${request.url()} - ${request.failure()?.errorText}`);
  });

  // Detect page crash
  page.on("crash", async () => {
    const screenshot = screenshots
      ? await screenshots.captureError("page-crash").catch(() => undefined)
      : undefined;

    crashes.push({
      type: "page-crash",
      timestamp: new Date().toISOString(),
      url: page.url(),
      screenshot,
      consoleErrors: [...consoleErrors],
      networkErrors: [...networkErrors],
    });
  });

  // Detect context-level issues
  context.on("close", () => {
    if (testInfo.status !== "passed") {
      crashes.push({
        type: "context-crash",
        timestamp: new Date().toISOString(),
        url: page.url(),
        consoleErrors: [...consoleErrors],
        networkErrors: [...networkErrors],
      });
    }
  });

  return {
    getCrashes: () => crashes,
    hasCrashed: () => crashes.length > 0,

    async attachReport() {
      if (crashes.length > 0) {
        await testInfo.attach("crash-report", {
          body: JSON.stringify(crashes, null, 2),
          contentType: "application/json",
        });
      }
    },

    getReport(): string {
      if (crashes.length === 0) return "";

      return crashes
        .map(
          (c) =>
            `[${c.type.toUpperCase()}] ${c.timestamp}\n` +
            `  URL: ${c.url}\n` +
            `  Console errors: ${c.consoleErrors.length}\n` +
            `  Network errors: ${c.networkErrors.length}\n` +
            (c.screenshot ? `  Screenshot: ${c.screenshot}` : "")
        )
        .join("\n\n");
    },
  };
}
