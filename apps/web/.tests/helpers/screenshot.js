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
import { expect } from "@playwright/test";

const DEFAULT_ERROR_CONFIG = {
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
  page;
  testInfo;
  errors = [];
  config;
  isAttached = false;
  constructor(page, testInfo, config = {}) {
    this.page = page;
    this.testInfo = testInfo;
    this.config = { ...DEFAULT_ERROR_CONFIG, ...config };
  }
  /**
   * Start monitoring the page for errors
   */
  attach() {
    if (this.isAttached) {
      return this;
    }
    // Console messages
    this.page.on("console", (msg) => {
      const type = msg.type();
      if (this.config.captureConsoleTypes.includes(type)) {
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
      const { message } = error;
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
  detach() {
    this.page.removeAllListeners("console");
    this.page.removeAllListeners("pageerror");
    this.page.removeAllListeners("requestfailed");
    this.page.removeAllListeners("response");
    this.isAttached = false;
  }
  /**
   * Get all captured errors
   */
  getErrors() {
    return [...this.errors];
  }
  /**
   * Check if any fatal errors were captured
   */
  hasFatalErrors() {
    return this.errors.some((e) => this.isFatalSeverity(e.severity));
  }
  /**
   * Get error summary for reporting
   */
  getSummary() {
    const byType = this.errors.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {});
    const bySeverity = this.errors.reduce((acc, e) => {
      acc[e.severity] = (acc[e.severity] || 0) + 1;
      return acc;
    }, {});
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
  assertNoErrors() {
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
  async attachToReport() {
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
  addError(error) {
    this.errors.push(error);
  }
  shouldIgnore(text) {
    return this.config.ignorePatterns.some((pattern) => pattern.test(text));
  }
  consoleSeverity(type) {
    switch (type) {
      case "error": {
        return "error";
      }
      case "warning": {
        return "warning";
      }
      default: {
        return "info";
      }
    }
  }
  isFatalSeverity(severity) {
    return this.config.failOnSeverity.includes(severity);
  }
}
/**
 * Create an error monitor for a test
 */
export function createErrorMonitor(page, testInfo, config) {
  return new ErrorMonitor(page, testInfo, config);
}
// ============================================================================
// Screenshot Strategy (Open/Closed via Strategy Pattern)
// ============================================================================
/**
 * Base screenshot strategy - extensible for different capture modes
 */
export class ScreenshotStrategy {
  page;
  testInfo;
  constructor(page, testInfo) {
    this.page = page;
    this.testInfo = testInfo;
  }
  async waitForStability(delay = 100) {
    await this.page.waitForTimeout(delay);
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }
  buildPath(name) {
    const sanitized = name.replaceAll(/[^a-z0-9-_]/gi, "_");
    const testName = this.testInfo.title.replaceAll(/[^a-z0-9-_]/gi, "_");
    return `${testName}__${sanitized}`;
  }
}
/**
 * Standard screenshot strategy - captures viewport or element
 */
export class StandardScreenshot extends ScreenshotStrategy {
  async capture(name, options = {}) {
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
    const screenshotOptions = {
      path: undefined, // Let Playwright auto-attach
      fullPage,
      animations: animations ?? "disabled",
      clip,
    };
    if (mask) {
      screenshotOptions.mask = mask.map((sel) => this.page.locator(sel));
    }
    let buffer;
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
  sequence = 0;
  async capture(name, options = {}) {
    this.sequence++;
    const sequencedName = `${String(this.sequence).padStart(3, "0")}_${name}`;
    const standard = new StandardScreenshot(this.page, this.testInfo);
    return await standard.capture(sequencedName, options);
  }
  reset() {
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
  page;
  testInfo;
  metadata = [];
  strategy;
  currentPhase = "setup";
  constructor(page, testInfo, strategy) {
    this.page = page;
    this.testInfo = testInfo;
    // Default to timeline strategy for chronological tracking
    this.strategy = strategy ?? new TimelineScreenshot(page, testInfo);
  }
  /**
   * Set the current test phase for organized screenshots
   */
  setPhase(phase) {
    this.currentPhase = phase;
    return this;
  }
  /**
   * Capture a screenshot with automatic metadata
   */
  async capture(name, options = {}) {
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
  async capturePageLoad(pageName) {
    return await this.setPhase("setup").capture(`${pageName}_loaded`, {
      fullPage: true,
      delay: 500,
    });
  }
  /**
   * Capture before an action
   */
  async captureBeforeAction(actionName) {
    return await this.setPhase("action").capture(`before_${actionName}`);
  }
  /**
   * Capture after an action
   */
  async captureAfterAction(actionName) {
    return await this.setPhase("action").capture(`after_${actionName}`, {
      delay: 200,
    });
  }
  /**
   * Capture a specific element
   */
  async captureElement(name, selector, options = {}) {
    return await this.capture(name, { ...options, selector });
  }
  /**
   * Capture an error state
   */
  async captureError(errorName) {
    return await this.setPhase("error").capture(`error_${errorName}`, {
      fullPage: true,
    });
  }
  /**
   * Capture a milestone/checkpoint
   */
  async captureMilestone(milestoneName) {
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
  async captureComparison(name, beforeFn) {
    const before = await this.capture(`${name}_before`);
    await beforeFn();
    const after = await this.capture(`${name}_after`, { delay: 300 });
    return { before, after };
  }
  /**
   * Get all captured metadata for analysis
   */
  getMetadata() {
    return [...this.metadata];
  }
  /**
   * Get metadata summary for reporting
   */
  getSummary() {
    const byPhase = this.metadata.reduce((acc, m) => {
      acc[m.phase] = (acc[m.phase] || 0) + 1;
      return acc;
    }, {});
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
export function createScreenshotManager(page, testInfo) {
  return new ScreenshotManager(page, testInfo);
}
export function withScreenshots(base) {
  return base.extend({
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
export function withTestHarness(base, errorConfig) {
  return base.extend({
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
export function withStrictTestHarness(base) {
  return withTestHarness(base, {
    failFast: true,
    failOnSeverity: ["critical", "error"],
    captureConsoleTypes: ["error", "warning"],
  });
}
/**
 * Lenient test harness that captures but doesn't fail on warnings
 */
export function withLenientTestHarness(base) {
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
export async function expectVisualMatch(page, name, options = {}) {
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
export async function captureBaseline(page, testInfo, name, options = {}) {
  const manager = createScreenshotManager(page, testInfo);
  await manager.capture(`baseline_${name}`, options);
}
// ============================================================================
// Automation Patterns
// ============================================================================
/**
 * Capture screenshots at key interaction points
 */
export async function captureInteraction(screenshots, name, action) {
  const before = await screenshots.captureBeforeAction(name);
  await action();
  const after = await screenshots.captureAfterAction(name);
  return { before, after };
}
/**
 * Capture screenshot on failure helper
 */
export async function withErrorCapture(screenshots, name, fn) {
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
export function createFlowCapture(screenshots) {
  return {
    async step(name, action) {
      await screenshots.captureBeforeAction(name);
      await action();
      await screenshots.captureAfterAction(name);
    },
    async milestone(name) {
      await screenshots.captureMilestone(name);
    },
    async checkpoint(name, assertion) {
      await screenshots.setPhase("assertion").capture(`checkpoint_${name}`);
      await assertion();
    },
  };
}
// ============================================================================
// AI-Optimized Helpers
// ============================================================================
/**
 * Capture screenshot and augment error with screenshot path
 *
 * @param screenshots - Screenshot manager instance
 * @param errorName - Name for the error screenshot
 * @param error - Original error to augment
 * @throws Augmented error with screenshot reference
 */
export async function captureAndThrow(screenshots, errorName, error) {
  const path = await screenshots.captureError(errorName);
  // Augment error message with screenshot reference
  const augmentedMessage =
    `${error.message}\n\n` +
    `[SCREENSHOT] ${path}\n` +
    `[VIEWPORT] ${JSON.stringify(screenshots.getMetadata().at(-1)?.viewport)}\n` +
    `[URL] ${screenshots.getMetadata().at(-1)?.url}`;
  const augmented = new Error(augmentedMessage);
  augmented.stack = error.stack;
  throw augmented;
}
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
export async function assertWithScreenshot(screenshots, name, assertion) {
  try {
    return await assertion();
  } catch (error) {
    await captureAndThrow(
      screenshots,
      name,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
