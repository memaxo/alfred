/**
 * Screenshot Capture Smoke Tests
 *
 * Smoke tests that capture screenshots and monitor for errors.
 * Tests fail fast on console errors, page crashes, and server errors.
 *
 * Features:
 * - Screenshot capture at key points
 * - Console error monitoring
 * - Server error detection (5xx responses)
 * - Page crash detection
 * - Error report attachment
 */

import { test as base } from "@playwright/test";

import { withStrictTestHarness } from "./helpers/screenshot";

// Use strict test harness that fails fast on errors
const test = withStrictTestHarness(base);

test.describe("UI Screenshot Capture", () => {
  test("captures home page", async ({ page, screenshots, errors, baseURL }) => {
    await page.goto(baseURL ?? "/", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForTimeout(1000);

    // Check for SSR errors (Vite error overlay)
    const errorOverlay = page.locator('[class*="vite-error"]');
    if (await errorOverlay.isVisible().catch(() => false)) {
      await screenshots.captureError("ssr_error_overlay");
      errors.assertNoErrors();
    }

    await screenshots.capturePageLoad("home");
  });

  test("captures login page", async ({
    page,
    screenshots,
    errors,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForTimeout(500);

    // Assert no errors after navigation
    errors.assertNoErrors();

    await screenshots.capturePageLoad("login");
  });

  test("captures responsive layouts", async ({
    page,
    screenshots,
    errors,
    baseURL,
  }) => {
    await page.goto(baseURL ?? "/", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Check for errors before taking screenshots
    if (errors.hasFatalErrors()) {
      await screenshots.captureError("page_load_error");
      errors.assertNoErrors();
    }

    // Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    await screenshots.capture("desktop_1440x900");

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await screenshots.capture("tablet_768x1024");

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    await screenshots.capture("mobile_375x667");
  });
});

test.describe("Direct Page Screenshots", () => {
  test("capture login page at multiple sizes", async ({
    page,
    screenshots,
    errors,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForTimeout(500);

    // Fail fast if there are server errors
    errors.assertNoErrors();

    // Capture at different viewport sizes
    const viewports = [
      { name: "desktop", width: 1920, height: 1080 },
      { name: "laptop", width: 1440, height: 900 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "mobile", width: 375, height: 667 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.waitForTimeout(200);
      await screenshots.capture(`login_${viewport.name}`);
    }
  });

  test("capture 404 page", async ({ page, screenshots, baseURL }) => {
    // Navigate to non-existent page to capture 404
    // Note: We don't assert errors here since 404 is expected
    await page.goto(`${baseURL}/this-page-does-not-exist-12345`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForTimeout(500);
    await screenshots.capture("404_page");
  });
});
