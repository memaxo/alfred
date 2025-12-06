/**
 * Screenshot Testing Utilities
 *
 * SOLID-based screenshot automation for comprehensive visual testing.
 *
 * Single Responsibility: Each class/function handles one concern
 * Open/Closed: Extensible via composition, not modification
 * Liskov Substitution: All strategies implement common interface
 * Interface Segregation: Small, focused interfaces
 * Dependency Inversion: Depend on abstractions (Page, TestInfo)
 */

import { expect, type Page, type TestInfo } from "@playwright/test";

// ============================================================================
// Error Monitoring (Single Responsibility)
// ============================================================================

/**
 * Severity levels for captured errors
 */
export type ErrorSeverity = "critical" | "error" | "warning" | "info";

/**
 * Captured error entry
 */
export type CapturedError = {
  type: "console" | "page" | "network" | "server";
  severity: ErrorSeverity;
  message: string;
  timestamp: string;
  url?: string;
  stack?: string;
  statusCode?: number;
};

/**
 * Error monitor configuration
 */
export type ErrorMonitorConfig = {
  /** Fail immediately on critical errors */
  failFast?: boolean;
  /** Severity levels that cause test failure */
  failOnSeverity?: ErrorSeverity[];
  /** Patterns to ignore (e.g., known warnings) */
  ignorePatterns?: RegExp[];
  /** Console message types to capture */
  captureConsoleTypes?: Array<"error" | "warning" | "log" | "info">;
  /** Network status codes to treat as errors */
  errorStatusCodes?: number[];
};

const DEFAULT_ERROR_CONFIG: Required<ErrorMonitorConfig> = {
  failFast: true,
  failOnSeverity: ["critical", "error"],
  ignorePatterns: [
    /Download the React DevTools/i,
    /favicon\.ico/i,
    /ResizeObserver loop/i,
  ],
  captureConsoleTypes: ["error", "warning"],
  errorStatusCodes: [500, 502, 503, 504],
};

/**
 * Error Monitor - captures and analyzes runtime errors
 *
 * Monitors:
 * - Console errors and warnings
 * - Page crashes and uncaught exceptions
 * - Network failures and server errors
 * - SSR rendering errors
 */
export class ErrorMonitor {
  private readonly errors: CapturedError[] = [];
  private readonly config: Required<ErrorMonitorConfig>;
  private isAttached = false;

  constructor(
    private readonly page: Page,
    private readonly testInfo: TestInfo,
    config: ErrorMonitorConfig = {}
  ) {
    this.config = { ...DEFAULT_ERROR_CONFIG, ...config };
  }

  /**
   * Start monitoring the page for errors
   */
  attach(): this {
    if (this.isAttached) {
      return this;
    }

    // Console messages
    this.page.on("console", (msg) => {
      const type = msg.type();
      if (
        this.config.captureConsoleTypes.includes(
          type as "error" | "warning" | "log" | "info"
        )
      ) {
        const text = msg.text();
        if (this.shouldIgnore(text)) {
          return;
        }

        const severity = this.consoleSeverity(type);
        this.addError({
          type: "console",
          severity,
          message: `[console.${type}] ${text}`,
          timestamp: new Date().toISOString(),
          url: this.page.url(),
        });

        if (this.config.failFast && this.isFatalSeverity(severity)) {
          throw new Error(`Console ${type}: ${text}`);
        }
      }
    });

    // Page errors (uncaught exceptions)
    this.page.on("pageerror", (error) => {
      const message = error.message;
      if (this.shouldIgnore(message)) {
        return;
      }

      this.addError({
        type: "page",
        severity: "critical",
        message: `[pageerror] ${message}`,
        timestamp: new Date().toISOString(),
        url: this.page.url(),
        stack: error.stack,
      });

      if (this.config.failFast) {
        throw new Error(`Page error: ${message}`);
      }
    });

    // Network failures
    this.page.on("requestfailed", (request) => {
      const failure = request.failure();
      const url = request.url();
      if (this.shouldIgnore(url)) {
        return;
      }

      this.addError({
        type: "network",
        severity: "error",
        message: `[network] Request failed: ${failure?.errorText ?? "unknown"} - ${url}`,
        timestamp: new Date().toISOString(),
        url,
      });
    });

    // Server errors (5xx responses)
    this.page.on("response", (response) => {
      const status = response.status();
      if (this.config.errorStatusCodes.includes(status)) {
        const url = response.url();
        if (this.shouldIgnore(url)) {
          return;
        }

        // Check for SSR error overlay
        const isSSRError = status === 500 && url === this.page.url();

        this.addError({
          type: "server",
          severity: isSSRError ? "critical" : "error",
          message: `[server] HTTP ${status} - ${url}`,
          timestamp: new Date().toISOString(),
          url,
          statusCode: status,
        });

        if (this.config.failFast && isSSRError) {
          // Don't throw here - let the page load and capture the error overlay
        }
      }
    });

    this.isAttached = true;
    return this;
  }

  /**
   * Detach all event listeners
   */
  detach(): void {
    this.page.removeAllListeners("console");
    this.page.removeAllListeners("pageerror");
    this.page.removeAllListeners("requestfailed");
    this.page.removeAllListeners("response");
    this.isAttached = false;
  }

  /**
   * Get all captured errors
   */
  getErrors(): CapturedError[] {
    return [...this.errors];
  }

  /**
   * Check if any fatal errors were captured
   */
  hasFatalErrors(): boolean {
    return this.errors.some((e) => this.isFatalSeverity(e.severity));
  }

  /**
   * Get error summary for reporting
   */
  getSummary(): string {
    const byType = this.errors.reduce(
      (acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const bySeverity = this.errors.reduce(
      (acc, e) => {
        acc[e.severity] = (acc[e.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return JSON.stringify(
      {
        total: this.errors.length,
        byType,
        bySeverity,
        hasFatal: this.hasFatalErrors(),
        errors: this.errors,
      },
      null,
      2
    );
  }

  /**
   * Assert no fatal errors occurred
   */
  assertNoErrors(): void {
    if (this.hasFatalErrors()) {
      const fatalErrors = this.errors.filter((e) =>
        this.isFatalSeverity(e.severity)
      );
      const messages = fatalErrors.map((e) => e.message).join("\n");
      throw new Error(
        `Test failed with ${fatalErrors.length} error(s):\n${messages}`
      );
    }
  }

  /**
   * Attach error summary to test report
   */
  async attachToReport(): Promise<void> {
    const summary = this.getSummary();
    await this.testInfo.attach("error-monitor-report", {
      body: summary,
      contentType: "application/json",
    });

    // Also attach as readable text if errors exist
    if (this.errors.length > 0) {
      const textReport = this.errors
        .map(
          (e) =>
            `[${e.severity.toUpperCase()}] ${e.type}: ${e.message}${e.url ? ` (${e.url})` : ""}`
        )
        .join("\n");
      await this.testInfo.attach("error-monitor-text", {
        body: textReport,
        contentType: "text/plain",
      });
    }
  }

  private addError(error: CapturedError): void {
    this.errors.push(error);
  }

  private shouldIgnore(text: string): boolean {
    return this.config.ignorePatterns.some((pattern) => pattern.test(text));
  }

  private consoleSeverity(type: string): ErrorSeverity {
    switch (type) {
      case "error":
        return "error";
      case "warning":
        return "warning";
      default:
        return "info";
    }
  }

  private isFatalSeverity(severity: ErrorSeverity): boolean {
    return this.config.failOnSeverity.includes(severity);
  }
}

/**
 * Create an error monitor for a test
 */
export function createErrorMonitor(
  page: Page,
  testInfo: TestInfo,
  config?: ErrorMonitorConfig
): ErrorMonitor {
  return new ErrorMonitor(page, testInfo, config);
}

// ============================================================================
// Interfaces (Interface Segregation)
// ============================================================================

/**
 * Minimal interface for screenshot capture
 */
export type ScreenshotCapture = {
  capture(name: string, options?: CaptureOptions): Promise<string>;
};

/**
 * Options for screenshot capture
 */
export type CaptureOptions = {
  /** Specific element to capture */
  selector?: string;
  /** Full page screenshot */
  fullPage?: boolean;
  /** Mask specific elements */
  mask?: string[];
  /** Wait for animations to complete */
  animations?: "disabled" | "allow";
  /** Additional wait time before capture */
  delay?: number;
  /** Custom clip region */
  clip?: { x: number; y: number; width: number; height: number };
};

/**
 * Screenshot metadata for analysis
 */
export type ScreenshotMetadata = {
  name: string;
  path: string;
  timestamp: string;
  viewport: { width: number; height: number };
  url: string;
  phase: TestPhase;
};

/**
 * Test lifecycle phases for organized screenshots
 */
export type TestPhase =
  | "setup"
  | "action"
  | "assertion"
  | "teardown"
  | "error"
  | "milestone";

// ============================================================================
// Screenshot Strategy (Open/Closed via Strategy Pattern)
// ============================================================================

/**
 * Base screenshot strategy - extensible for different capture modes
 */
export abstract class ScreenshotStrategy implements ScreenshotCapture {
  constructor(
    protected page: Page,
    protected testInfo: TestInfo
  ) {}

  abstract capture(name: string, options?: CaptureOptions): Promise<string>;

  protected async waitForStability(delay = 100): Promise<void> {
    await this.page.waitForTimeout(delay);
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  protected buildPath(name: string): string {
    const sanitized = name.replace(/[^a-z0-9-_]/gi, "_");
    const testName = this.testInfo.title.replace(/[^a-z0-9-_]/gi, "_");
    return `${testName}__${sanitized}`;
  }
}

/**
 * Standard screenshot strategy - captures viewport or element
 */
export class StandardScreenshot extends ScreenshotStrategy {
  async capture(name: string, options: CaptureOptions = {}): Promise<string> {
    const {
      selector,
      fullPage = false,
      mask,
      animations,
      delay,
      clip,
    } = options;

    if (delay) {
      await this.page.waitForTimeout(delay);
    }

    await this.waitForStability();

    const screenshotOptions: Parameters<Page["screenshot"]>[0] = {
      path: undefined, // Let Playwright auto-attach
      fullPage,
      animations: animations ?? "disabled",
      clip,
    };

    if (mask) {
      screenshotOptions.mask = mask.map((sel) => this.page.locator(sel));
    }

    let buffer: Buffer;

    if (selector) {
      const element = this.page.locator(selector);
      await expect(element).toBeVisible();
      buffer = await element.screenshot({
        ...screenshotOptions,
        path: undefined,
      });
    } else {
      buffer = await this.page.screenshot(screenshotOptions);
    }

    // Attach to test report
    const path = this.buildPath(name);
    await this.testInfo.attach(path, {
      body: buffer,
      contentType: "image/png",
    });

    return path;
  }
}

/**
 * Timeline screenshot strategy - captures with timestamp markers
 */
export class TimelineScreenshot extends ScreenshotStrategy {
  private sequence = 0;

  async capture(name: string, options: CaptureOptions = {}): Promise<string> {
    this.sequence++;
    const sequencedName = `${String(this.sequence).padStart(3, "0")}_${name}`;
    const standard = new StandardScreenshot(this.page, this.testInfo);
    return await standard.capture(sequencedName, options);
  }

  reset(): void {
    this.sequence = 0;
  }
}

// ============================================================================
// Screenshot Manager (Single Responsibility + Dependency Inversion)
// ============================================================================

/**
 * Central screenshot manager for test automation
 *
 * Responsibilities:
 * - Orchestrates screenshot capture
 * - Manages metadata collection
 * - Provides convenience methods for common patterns
 */
export class ScreenshotManager {
  private readonly metadata: ScreenshotMetadata[] = [];
  private readonly strategy: ScreenshotCapture;
  private currentPhase: TestPhase = "setup";

  constructor(
    private readonly page: Page,
    private readonly testInfo: TestInfo,
    strategy?: ScreenshotCapture
  ) {
    // Default to timeline strategy for chronological tracking
    this.strategy = strategy ?? new TimelineScreenshot(page, testInfo);
  }

  /**
   * Set the current test phase for organized screenshots
   */
  setPhase(phase: TestPhase): this {
    this.currentPhase = phase;
    return this;
  }

  /**
   * Capture a screenshot with automatic metadata
   */
  async capture(name: string, options: CaptureOptions = {}): Promise<string> {
    const viewport = this.page.viewportSize() ?? { width: 0, height: 0 };

    const path = await this.strategy.capture(name, options);

    this.metadata.push({
      name,
      path,
      timestamp: new Date().toISOString(),
      viewport,
      url: this.page.url(),
      phase: this.currentPhase,
    });

    return path;
  }

  /**
   * Capture page load state
   */
  async capturePageLoad(pageName: string): Promise<string> {
    return await this.setPhase("setup").capture(`${pageName}_loaded`, {
      fullPage: true,
      delay: 500,
    });
  }

  /**
   * Capture before an action
   */
  async captureBeforeAction(actionName: string): Promise<string> {
    return await this.setPhase("action").capture(`before_${actionName}`);
  }

  /**
   * Capture after an action
   */
  async captureAfterAction(actionName: string): Promise<string> {
    return await this.setPhase("action").capture(`after_${actionName}`, {
      delay: 200,
    });
  }

  /**
   * Capture a specific element
   */
  async captureElement(
    name: string,
    selector: string,
    options: Omit<CaptureOptions, "selector"> = {}
  ): Promise<string> {
    return await this.capture(name, { ...options, selector });
  }

  /**
   * Capture an error state
   */
  async captureError(errorName: string): Promise<string> {
    return await this.setPhase("error").capture(`error_${errorName}`, {
      fullPage: true,
    });
  }

  /**
   * Capture a milestone/checkpoint
   */
  async captureMilestone(milestoneName: string): Promise<string> {
    return await this.setPhase("milestone").capture(
      `milestone_${milestoneName}`,
      {
        fullPage: true,
      }
    );
  }

  /**
   * Capture comparison pair (before/after)
   */
  async captureComparison(
    name: string,
    beforeFn: () => Promise<void>
  ): Promise<{ before: string; after: string }> {
    const before = await this.capture(`${name}_before`);
    await beforeFn();
    const after = await this.capture(`${name}_after`, { delay: 300 });
    return { before, after };
  }

  /**
   * Get all captured metadata for analysis
   */
  getMetadata(): ScreenshotMetadata[] {
    return [...this.metadata];
  }

  /**
   * Get metadata summary for reporting
   */
  getSummary(): string {
    const byPhase = this.metadata.reduce(
      (acc, m) => {
        acc[m.phase] = (acc[m.phase] || 0) + 1;
        return acc;
      },
      {} as Record<TestPhase, number>
    );

    return JSON.stringify(
      {
        total: this.metadata.length,
        byPhase,
        testTitle: this.testInfo.title,
      },
      null,
      2
    );
  }
}

// ============================================================================
// Factory Functions (Dependency Inversion)
// ============================================================================

/**
 * Create a screenshot manager for a test
 */
export function createScreenshotManager(
  page: Page,
  testInfo: TestInfo
): ScreenshotManager {
  return new ScreenshotManager(page, testInfo);
}

// ============================================================================
// Test Fixtures Integration
// ============================================================================

/**
 * Screenshot test fixture for Playwright
 *
 * Usage in test file:
 * ```typescript
 * import { test as base } from "@playwright/test";
 * import { withScreenshots, type ScreenshotFixture } from "./helpers/screenshot";
 *
 * const test = withScreenshots(base);
 *
 * test("my test", async ({ page, screenshots }) => {
 *   await screenshots.capturePageLoad("home");
 *   // ... test actions
 *   await screenshots.captureMilestone("completed");
 * });
 * ```
 */
export type ScreenshotFixture = {
  screenshots: ScreenshotManager;
};

export function withScreenshots<_T extends { page: Page }>(
  base: typeof import("@playwright/test").test
) {
  return base.extend<ScreenshotFixture>({
    screenshots: async ({ page }, use, testInfo) => {
      const manager = createScreenshotManager(page, testInfo);
      await use(manager);

      // Attach metadata summary at end of test
      const summary = manager.getSummary();
      await testInfo.attach("screenshot-metadata", {
        body: summary,
        contentType: "application/json",
      });
    },
  });
}

/**
 * Combined fixture with screenshots and error monitoring
 *
 * Usage:
 * ```typescript
 * import { test as base } from "@playwright/test";
 * import { withTestHarness, type TestHarnessFixture } from "./helpers/screenshot";
 *
 * const test = withTestHarness(base);
 *
 * test("my test", async ({ page, screenshots, errors }) => {
 *   // Errors are automatically monitored
 *   await page.goto("/");
 *   await screenshots.capturePageLoad("home");
 *
 *   // Check for errors at any point
 *   errors.assertNoErrors();
 * });
 * ```
 */
export type TestHarnessFixture = {
  screenshots: ScreenshotManager;
  errors: ErrorMonitor;
};

export function withTestHarness<_T extends { page: Page }>(
  base: typeof import("@playwright/test").test,
  errorConfig?: ErrorMonitorConfig
) {
  return base.extend<TestHarnessFixture>({
    screenshots: async ({ page }, use, testInfo) => {
      const manager = createScreenshotManager(page, testInfo);
      await use(manager);

      const summary = manager.getSummary();
      await testInfo.attach("screenshot-metadata", {
        body: summary,
        contentType: "application/json",
      });
    },

    errors: async ({ page }, use, testInfo) => {
      const monitor = createErrorMonitor(page, testInfo, errorConfig);
      monitor.attach();

      await use(monitor);

      // Attach error report
      await monitor.attachToReport();

      // Detach listeners
      monitor.detach();

      // Assert no fatal errors at end of test (unless test already failed)
      if (testInfo.status === "passed") {
        monitor.assertNoErrors();
      }
    },
  });
}

/**
 * Strict test harness that fails fast on any error
 */
export function withStrictTestHarness<_T extends { page: Page }>(
  base: typeof import("@playwright/test").test
) {
  return withTestHarness(base, {
    failFast: true,
    failOnSeverity: ["critical", "error"],
    captureConsoleTypes: ["error", "warning"],
  });
}

/**
 * Lenient test harness that captures but doesn't fail on warnings
 */
export function withLenientTestHarness<_T extends { page: Page }>(
  base: typeof import("@playwright/test").test
) {
  return withTestHarness(base, {
    failFast: false,
    failOnSeverity: ["critical"],
    captureConsoleTypes: ["error", "warning", "log"],
  });
}

// ============================================================================
// Visual Regression Helpers
// ============================================================================

/**
 * Visual comparison helper for element snapshots
 */
export async function expectVisualMatch(
  page: Page,
  name: string,
  options: {
    selector?: string;
    threshold?: number;
    maxDiffPixels?: number;
    maxDiffPixelRatio?: number;
  } = {}
): Promise<void> {
  const {
    selector,
    threshold = 0.2,
    maxDiffPixels,
    maxDiffPixelRatio,
  } = options;

  const target = selector ? page.locator(selector) : page;

  await expect(target).toHaveScreenshot(`${name}.png`, {
    threshold,
    maxDiffPixels,
    maxDiffPixelRatio,
    animations: "disabled",
  });
}

/**
 * Capture a visual baseline for later comparison
 */
export async function captureBaseline(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options: CaptureOptions = {}
): Promise<void> {
  const manager = createScreenshotManager(page, testInfo);
  await manager.capture(`baseline_${name}`, options);
}

// ============================================================================
// Automation Patterns
// ============================================================================

/**
 * Capture screenshots at key interaction points
 */
export async function captureInteraction(
  screenshots: ScreenshotManager,
  name: string,
  action: () => Promise<void>
): Promise<{ before: string; during?: string; after: string }> {
  const before = await screenshots.captureBeforeAction(name);
  await action();
  const after = await screenshots.captureAfterAction(name);
  return { before, after };
}

/**
 * Capture screenshot on failure helper
 */
export async function withErrorCapture<T>(
  screenshots: ScreenshotManager,
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    await screenshots.captureError(name);
    throw error;
  }
}

/**
 * Create a comprehensive test flow capture
 */
export function createFlowCapture(screenshots: ScreenshotManager) {
  return {
    async step(name: string, action: () => Promise<void>): Promise<void> {
      await screenshots.captureBeforeAction(name);
      await action();
      await screenshots.captureAfterAction(name);
    },

    async milestone(name: string): Promise<void> {
      await screenshots.captureMilestone(name);
    },

    async checkpoint(
      name: string,
      assertion: () => Promise<void>
    ): Promise<void> {
      await screenshots.setPhase("assertion").capture(`checkpoint_${name}`);
      await assertion();
    },
  };
}
