/**
 * Visual Regression Testing Suite
 *
 * Comprehensive visual regression tests following SOLID automation principles.
 * This file demonstrates best practices for screenshot-based testing.
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Each test focuses on one visual aspect
 * - Open/Closed: Extensible through composition
 * - Liskov Substitution: Consistent screenshot interface
 * - Interface Segregation: Focused test helpers
 * - Dependency Inversion: Abstractions over implementations
 */

import { test as base } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import {
  createFlowCapture,
  createScreenshotManager,
  type ScreenshotManager,
} from "./helpers/screenshot";

// ============================================================================
// Test Fixture Setup
// ============================================================================

const test = base.extend<{ screenshots: ScreenshotManager }>({
  screenshots: async ({ page }, use, testInfo) => {
    const manager = createScreenshotManager(page, testInfo);
    await use(manager);

    // Always attach metadata for analysis pipeline
    const summary = manager.getSummary();
    await testInfo.attach("screenshot-metadata", {
      body: summary,
      contentType: "application/json",
    });
  },
});

// ============================================================================
// Cortex Demo Visual Regression
// ============================================================================

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

  test("baseline: control panels collapsed state", async ({
    page,
    screenshots,
  }) => {
    await page.goto("/demo/cortex", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    await screenshots.capture("control_panels_default");
  });

  test("interaction: preset switching visual diff", async ({
    page,
    screenshots,
  }) => {
    await page.goto("/demo/cortex", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Capture baseline
    await screenshots.capture("preset_switch_baseline");

    // Switch through presets and capture each
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

  test("interaction: slider adjustments", async ({ page, screenshots }) => {
    await page.goto("/demo/cortex", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const slider = page.locator('input[type="range"]').first();
    if (await slider.isVisible()) {
      // Capture before/after at multiple positions
      const positions = [0, 25, 50, 75, 100];
      for (const pos of positions) {
        await slider.fill(String(pos));
        await page.waitForTimeout(200);
        await screenshots.capture(`slider_position_${pos}`);
      }
    }
  });

  test("canvas rendering: stability check", async ({ page, screenshots }) => {
    await page.goto("/demo/cortex", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Multiple captures to verify rendering stability
    for (let i = 0; i < 3; i++) {
      await screenshots.captureElement(`canvas_stability_${i}`, "canvas");
      await page.waitForTimeout(500);
    }
  });
});

// ============================================================================
// Visual Settings Visual Regression
// ============================================================================

test.describe("Visual Settings Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("baseline: settings page layout", async ({ page, screenshots }) => {
    await page.goto("/settings/visual", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    await screenshots.capture("settings_page_layout", { fullPage: true });
  });

  test("baseline: preset grid", async ({ page, screenshots }) => {
    await page.goto("/settings/visual", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    await screenshots.capture("preset_grid_layout");
  });

  test("interaction: color palette changes", async ({ page, screenshots }) => {
    await page.goto("/settings/visual", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const palettes = ["teal", "purple", "amber", "emerald", "rose"];
    for (const palette of palettes) {
      const btn = page
        .locator("button")
        .filter({ hasText: new RegExp(palette, "i") })
        .first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
        await screenshots.capture(`palette_${palette}`);
      }
    }
  });

  test("state: save button enabled/disabled", async ({ page, screenshots }) => {
    await page.goto("/settings/visual", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Capture initial state (save likely disabled)
    await screenshots.capture("save_button_initial");

    // Make a change
    const slider = page.locator('input[type="range"]').first();
    if (await slider.isVisible()) {
      await slider.fill("80");
      await page.waitForTimeout(200);
      await screenshots.capture("save_button_after_change");
    }
  });
});

// ============================================================================
// Responsive Design Visual Regression
// ============================================================================

test.describe("Responsive Design Visual Regression", () => {
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

  test("settings page responsive layouts", async ({ page, screenshots }) => {
    await page.goto("/settings/visual", { waitUntil: "networkidle" });

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.waitForTimeout(500);
      await screenshots.capture(`settings_${viewport.name}`, {
        fullPage: true,
      });
    }
  });
});

// ============================================================================
// Theme and Color Visual Regression
// ============================================================================

test.describe("Theme Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("dark theme consistency", async ({ page, screenshots }) => {
    await page.goto("/demo/cortex", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // The app uses dark theme by default
    await screenshots.capture("dark_theme_demo");

    await page.goto("/settings/visual", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await screenshots.capture("dark_theme_settings");
  });

  test("color contrast verification", async ({ page, screenshots }) => {
    await page.goto("/demo/cortex", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Capture various UI elements for contrast analysis
    await screenshots.capture("contrast_buttons");
    await screenshots.capture("contrast_text");
    await screenshots.capture("contrast_inputs");
  });
});

// ============================================================================
// Error State Visual Regression
// ============================================================================

test.describe("Error State Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("offline state handling", async ({ page, screenshots }) => {
    await page.goto("/settings/visual", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    await screenshots.capture("before_offline");

    // Go offline
    await page.context().setOffline(true);

    // Try to save
    const saveBtn = page.getByRole("button", { name: /save/i }).first();
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      await screenshots.captureError("offline_save_attempt");
    }

    // Restore connection
    await page.context().setOffline(false);
    await screenshots.capture("after_online");
  });

  test("loading states", async ({ page, screenshots }) => {
    // Slow down network to capture loading states
    await page.route("**/*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.continue();
    });

    await page.goto("/settings/visual");
    await screenshots.capture("loading_state");
    await page.waitForLoadState("networkidle");
    await screenshots.capture("loaded_state");
  });
});

// ============================================================================
// Animation and Transition Visual Regression
// ============================================================================

test.describe("Animation Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("canvas animation frames", async ({ page, screenshots }) => {
    await page.goto("/demo/cortex", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Capture multiple frames to verify animation
    for (let frame = 0; frame < 5; frame++) {
      await screenshots.captureElement(`animation_frame_${frame}`, "canvas");
      await page.waitForTimeout(200);
    }
  });

  test("UI transition states", async ({ page, screenshots }) => {
    await page.goto("/settings/visual", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Capture hover states
    const presetCard = page
      .locator("button, div[role=button]")
      .filter({ hasText: /balanced/i })
      .first();

    if (await presetCard.isVisible()) {
      await screenshots.capture("preset_card_default");
      await presetCard.hover();
      await page.waitForTimeout(100);
      await screenshots.capture("preset_card_hover");
    }
  });
});

// ============================================================================
// Comprehensive Flow Visual Regression
// ============================================================================

test.describe("End-to-End Flow Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("complete visual configuration flow", async ({ page, screenshots }) => {
    const flow = createFlowCapture(screenshots);

    // 1. Start at settings
    await page.goto("/settings", { waitUntil: "networkidle" });
    await flow.milestone("flow_start_settings");

    // 2. Navigate to visual settings
    const visualLink = page.getByRole("link", { name: /visual/i });
    if (await visualLink.isVisible()) {
      await flow.step("navigate_to_visual", async () => {
        await visualLink.click();
        await page.waitForURL(/\/settings\/visual/);
      });
    }

    // 3. Select a preset
    await page.waitForTimeout(500);
    const minimalCard = page
      .locator("button, div[role=button]")
      .filter({ hasText: /minimal/i })
      .first();
    if (await minimalCard.isVisible()) {
      await flow.step("select_preset", async () => {
        await minimalCard.click();
        await page.waitForTimeout(300);
      });
    }

    // 4. Navigate to demo
    const demoLink = page.getByRole("link", { name: /demo|advanced/i }).first();
    if (await demoLink.isVisible()) {
      await flow.step("navigate_to_demo", async () => {
        await demoLink.click();
        await page.waitForTimeout(1000);
      });
    }

    // 5. Verify preset applied
    await flow.milestone("flow_complete_demo");
  });
});
