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
import { type Page, type TestInfo } from "@playwright/test";
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
/**
 * Error Monitor - captures and analyzes runtime errors
 *
 * Monitors:
 * - Console errors and warnings
 * - Page crashes and uncaught exceptions
 * - Network failures and server errors
 * - SSR rendering errors
 */
export declare class ErrorMonitor {
  private readonly page;
  private readonly testInfo;
  private readonly errors;
  private readonly config;
  private isAttached;
  constructor(page: Page, testInfo: TestInfo, config?: ErrorMonitorConfig);
  /**
   * Start monitoring the page for errors
   */
  attach(): this;
  /**
   * Detach all event listeners
   */
  detach(): void;
  /**
   * Get all captured errors
   */
  getErrors(): CapturedError[];
  /**
   * Check if any fatal errors were captured
   */
  hasFatalErrors(): boolean;
  /**
   * Get error summary for reporting
   */
  getSummary(): string;
  /**
   * Assert no fatal errors occurred
   */
  assertNoErrors(): void;
  /**
   * Attach error summary to test report
   */
  attachToReport(): Promise<void>;
  private addError;
  private shouldIgnore;
  private consoleSeverity;
  private isFatalSeverity;
}
/**
 * Create an error monitor for a test
 */
export declare function createErrorMonitor(
  page: Page,
  testInfo: TestInfo,
  config?: ErrorMonitorConfig
): ErrorMonitor;
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
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};
/**
 * Screenshot metadata for analysis
 */
export type ScreenshotMetadata = {
  name: string;
  path: string;
  timestamp: string;
  viewport: {
    width: number;
    height: number;
  };
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
/**
 * Base screenshot strategy - extensible for different capture modes
 */
export declare abstract class ScreenshotStrategy implements ScreenshotCapture {
  protected page: Page;
  protected testInfo: TestInfo;
  constructor(page: Page, testInfo: TestInfo);
  abstract capture(name: string, options?: CaptureOptions): Promise<string>;
  protected waitForStability(delay?: number): Promise<void>;
  protected buildPath(name: string): string;
}
/**
 * Standard screenshot strategy - captures viewport or element
 */
export declare class StandardScreenshot extends ScreenshotStrategy {
  capture(name: string, options?: CaptureOptions): Promise<string>;
}
/**
 * Timeline screenshot strategy - captures with timestamp markers
 */
export declare class TimelineScreenshot extends ScreenshotStrategy {
  private sequence;
  capture(name: string, options?: CaptureOptions): Promise<string>;
  reset(): void;
}
/**
 * Central screenshot manager for test automation
 *
 * Responsibilities:
 * - Orchestrates screenshot capture
 * - Manages metadata collection
 * - Provides convenience methods for common patterns
 */
export declare class ScreenshotManager {
  private readonly page;
  private readonly testInfo;
  private readonly metadata;
  private readonly strategy;
  private currentPhase;
  constructor(page: Page, testInfo: TestInfo, strategy?: ScreenshotCapture);
  /**
   * Set the current test phase for organized screenshots
   */
  setPhase(phase: TestPhase): this;
  /**
   * Capture a screenshot with automatic metadata
   */
  capture(name: string, options?: CaptureOptions): Promise<string>;
  /**
   * Capture page load state
   */
  capturePageLoad(pageName: string): Promise<string>;
  /**
   * Capture before an action
   */
  captureBeforeAction(actionName: string): Promise<string>;
  /**
   * Capture after an action
   */
  captureAfterAction(actionName: string): Promise<string>;
  /**
   * Capture a specific element
   */
  captureElement(
    name: string,
    selector: string,
    options?: Omit<CaptureOptions, "selector">
  ): Promise<string>;
  /**
   * Capture an error state
   */
  captureError(errorName: string): Promise<string>;
  /**
   * Capture a milestone/checkpoint
   */
  captureMilestone(milestoneName: string): Promise<string>;
  /**
   * Capture comparison pair (before/after)
   */
  captureComparison(
    name: string,
    beforeFn: () => Promise<void>
  ): Promise<{
    before: string;
    after: string;
  }>;
  /**
   * Get all captured metadata for analysis
   */
  getMetadata(): ScreenshotMetadata[];
  /**
   * Get metadata summary for reporting
   */
  getSummary(): string;
}
/**
 * Create a screenshot manager for a test
 */
export declare function createScreenshotManager(
  page: Page,
  testInfo: TestInfo
): ScreenshotManager;
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
export declare function withScreenshots<
  _T extends {
    page: Page;
  },
>(
  base: typeof import("@playwright/test").test
): import("playwright/test").TestType<
  import("playwright/test").PlaywrightTestArgs &
    import("playwright/test").PlaywrightTestOptions &
    ScreenshotFixture,
  import("playwright/test").PlaywrightWorkerArgs &
    import("playwright/test").PlaywrightWorkerOptions
>;
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
export declare function withTestHarness<
  _T extends {
    page: Page;
  },
>(
  base: typeof import("@playwright/test").test,
  errorConfig?: ErrorMonitorConfig
): import("playwright/test").TestType<
  import("playwright/test").PlaywrightTestArgs &
    import("playwright/test").PlaywrightTestOptions &
    TestHarnessFixture,
  import("playwright/test").PlaywrightWorkerArgs &
    import("playwright/test").PlaywrightWorkerOptions
>;
/**
 * Strict test harness that fails fast on any error
 */
export declare function withStrictTestHarness<
  _T extends {
    page: Page;
  },
>(
  base: typeof import("@playwright/test").test
): import("playwright/test").TestType<
  import("playwright/test").PlaywrightTestArgs &
    import("playwright/test").PlaywrightTestOptions &
    TestHarnessFixture,
  import("playwright/test").PlaywrightWorkerArgs &
    import("playwright/test").PlaywrightWorkerOptions
>;
/**
 * Lenient test harness that captures but doesn't fail on warnings
 */
export declare function withLenientTestHarness<
  _T extends {
    page: Page;
  },
>(
  base: typeof import("@playwright/test").test
): import("playwright/test").TestType<
  import("playwright/test").PlaywrightTestArgs &
    import("playwright/test").PlaywrightTestOptions &
    TestHarnessFixture,
  import("playwright/test").PlaywrightWorkerArgs &
    import("playwright/test").PlaywrightWorkerOptions
>;
/**
 * Visual comparison helper for element snapshots
 */
export declare function expectVisualMatch(
  page: Page,
  name: string,
  options?: {
    selector?: string;
    threshold?: number;
    maxDiffPixels?: number;
    maxDiffPixelRatio?: number;
  }
): Promise<void>;
/**
 * Capture a visual baseline for later comparison
 */
export declare function captureBaseline(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options?: CaptureOptions
): Promise<void>;
/**
 * Capture screenshots at key interaction points
 */
export declare function captureInteraction(
  screenshots: ScreenshotManager,
  name: string,
  action: () => Promise<void>
): Promise<{
  before: string;
  during?: string;
  after: string;
}>;
/**
 * Capture screenshot on failure helper
 */
export declare function withErrorCapture<T>(
  screenshots: ScreenshotManager,
  name: string,
  fn: () => Promise<T>
): Promise<T>;
/**
 * Create a comprehensive test flow capture
 */
export declare function createFlowCapture(screenshots: ScreenshotManager): {
  step(name: string, action: () => Promise<void>): Promise<void>;
  milestone(name: string): Promise<void>;
  checkpoint(name: string, assertion: () => Promise<void>): Promise<void>;
};
/**
 * Capture screenshot and augment error with screenshot path
 *
 * @param screenshots - Screenshot manager instance
 * @param errorName - Name for the error screenshot
 * @param error - Original error to augment
 * @throws Augmented error with screenshot reference
 */
export declare function captureAndThrow(
  screenshots: ScreenshotManager,
  errorName: string,
  error: Error
): Promise<never>;
/**
 * Wrap assertion with automatic screenshot on failure
 *
 * @param screenshots - Screenshot manager instance
 * @param name - Name for the assertion
 * @param assertion - Async assertion function
 * @returns Result of the assertion
 * @throws Error with screenshot reference if assertion fails
 *
 * @example
 * ```typescript
 * await assertWithScreenshot(screenshots, "workflow-visible", async () => {
 *   await expect(page.locator('[data-testid="workflow"]')).toBeVisible();
 * });
 * ```
 */
export declare function assertWithScreenshot<T>(
  screenshots: ScreenshotManager,
  name: string,
  assertion: () => Promise<T>
): Promise<T>;
