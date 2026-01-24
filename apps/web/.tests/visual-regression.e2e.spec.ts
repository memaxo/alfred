/**
 * Visual Regression Testing Suite
 *
 * - Cortex demo page regression
 * - Visual settings regression inside Settings desktop window
 */

import {
  test as base,
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { signUpTestUser } from "./helpers/auth";
import { openSettingsWindow } from "./helpers/mindscape";
import {
  createScreenshotManager,
  type ScreenshotManager,
} from "./helpers/screenshot";

const test = base.extend<{ screenshots: ScreenshotManager }>({
  screenshots: async ({ page }, use, testInfo) => {
    const manager = createScreenshotManager(page, testInfo);
    await use(manager);
    await testInfo.attach("screenshot-metadata", {
      body: manager.getSummary(),
      contentType: "application/json",
    });
  },
});

async function captureSettingsWindow(
  page: Page,
  window: Locator,
  testInfo: TestInfo,
  name: string
) {
  await expect(window).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(150);
  const png = await window.screenshot({ animations: "disabled" });
  await testInfo.attach(`${name}.png`, { body: png, contentType: "image/png" });
}

async function openVisualSection(page: Page) {
  const settingsWindow = await openSettingsWindow(page);
  await settingsWindow
    .getByRole("button", { name: "Visual & Desktop" })
    .click();
  await expect(
    settingsWindow.getByRole("heading", { name: "Visual & Desktop" })
  ).toBeVisible();
  return settingsWindow;
}

test.describe("Cortex Demo Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("baseline: full page layout", async ({ page, screenshots }) => {
    await page.goto("/demo/cortex", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await screenshots.setPhase("milestone");
    await screenshots.capture("demo_full_layout", { fullPage: true });
  });

  test("interaction: preset switching visual diff", async ({
    page,
    screenshots,
  }) => {
    await page.goto("/demo/cortex", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    await screenshots.capture("preset_switch_baseline");

    const presets = ["minimal", "performance", "maximum"];
    for (const preset of presets) {
      const card = page.getByText(new RegExp(preset, "i")).first();
      if (await card.isVisible()) {
        await card.click();
        await page.waitForTimeout(500);
        await screenshots.capture(`preset_${preset}_active`);
      }
    }
  });
});

test.describe("Visual Settings Regression (Settings desktop window)", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("baseline: visual section layout", async ({ page }, testInfo) => {
    const settingsWindow = await openVisualSection(page);
    await captureSettingsWindow(
      page,
      settingsWindow,
      testInfo,
      "visual_settings_layout"
    );
  });

  test("interaction: color palette changes", async ({ page }, testInfo) => {
    const settingsWindow = await openVisualSection(page);

    const palettes = ["teal", "purple", "amber", "emerald", "rose"];
    for (const palette of palettes) {
      const btn = settingsWindow
        .locator("button")
        .filter({ hasText: new RegExp(palette, "i") })
        .first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
        await captureSettingsWindow(
          page,
          settingsWindow,
          testInfo,
          `palette_${palette}`
        );
      }
    }
  });

  test("state: save button enabled/disabled", async ({ page }, testInfo) => {
    const settingsWindow = await openVisualSection(page);

    await captureSettingsWindow(
      page,
      settingsWindow,
      testInfo,
      "save_button_initial"
    );

    const slider = settingsWindow.locator('input[type="range"]').first();
    if (await slider.isVisible()) {
      await slider.fill("80");
      await page.waitForTimeout(200);
      await captureSettingsWindow(
        page,
        settingsWindow,
        testInfo,
        "save_button_after_change"
      );
    }
  });
});

test.describe("Responsive Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  const viewports = [
    { name: "desktop_large", width: 1920, height: 1080 },
    { name: "desktop", width: 1440, height: 900 },
    { name: "laptop", width: 1280, height: 720 },
    { name: "tablet_landscape", width: 1024, height: 768 },
    { name: "tablet_portrait", width: 768, height: 1024 },
    { name: "mobile_large", width: 428, height: 926 },
    { name: "mobile", width: 375, height: 667 },
  ];

  test("demo page responsive layouts", async ({ page, screenshots }) => {
    await page.goto("/demo/cortex", { waitUntil: "networkidle" });

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.waitForTimeout(500);
      await screenshots.capture(`demo_${viewport.name}`, { fullPage: true });
    }
  });

  test("settings visual section responsive layouts", async ({
    page,
  }, testInfo) => {
    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.waitForTimeout(200);

      const settingsWindow = await openVisualSection(page);
      await captureSettingsWindow(
        page,
        settingsWindow,
        testInfo,
        `settings_${viewport.name}`
      );
    }
  });
});
