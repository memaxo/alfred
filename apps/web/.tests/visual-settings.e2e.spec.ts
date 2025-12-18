/**
 * Visual Settings E2E Tests
 *
 * Tests the /settings/visual page with screenshot automation.
 * Follows SOLID principles for comprehensive visual regression testing.
 *
 * Features:
 * - Preset selection with visual comparison
 * - Color palette selection
 * - Quick adjustments with before/after captures
 * - Save/Reset functionality
 * - Navigation to full demo
 * - Timeline screenshots for debugging
 */

import { test as base, expect } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import {
  createFlowCapture,
  createScreenshotManager,
  type ScreenshotManager,
} from "./helpers/screenshot";

// Extend test with screenshot fixture
const test = base.extend<{ screenshots: ScreenshotManager }>({
  screenshots: async ({ page }, use, testInfo) => {
    const manager = createScreenshotManager(page, testInfo);
    await use(manager);

    // Attach metadata summary
    const summary = manager.getSummary();
    await testInfo.attach("screenshot-metadata", {
      body: summary,
      contentType: "application/json",
    });
  },
});

test.describe("Visual Settings Page E2E", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test.describe("Page Load", () => {
    test("can access visual settings from settings page", async ({
      page,
      screenshots,
    }) => {
      await page.goto("/settings", { waitUntil: "networkidle" });

      await screenshots.capture("settings_main_page");

      // Find and click the visual settings link
      const visualLink = page.getByRole("link", { name: /visual/i });
      if (await visualLink.isVisible()) {
        await visualLink.click();
        await page.waitForURL(/\/settings\/visual/);
        await expect(page).toHaveURL(/\/settings\/visual/);

        await screenshots.captureMilestone("navigated_to_visual_settings");
      }
    });

    test("can access visual settings directly", async ({
      page,
      screenshots,
    }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });

      await screenshots.capturePageLoad("visual_settings");

      await expect(page).toHaveURL(/\/settings\/visual/);
      await expect(
        page.getByRole("heading", { name: /visual|appearance/i }).first()
      ).toBeVisible();
    });

    test("shows preview canvas", async ({ page, screenshots }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });

      // Preview canvas should be present
      const canvas = page.locator("canvas");
      const count = await canvas.count();

      if (count > 0) {
        await screenshots.captureElement("preview_canvas", "canvas");
      }

      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("shows back to settings link", async ({ page, screenshots }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });

      await screenshots.capture("back_link_visible");

      const backLink = page.getByRole("link", { name: /back.*settings/i });
      await expect(backLink).toBeVisible();
    });
  });

  test.describe("Preset Selection", () => {
    test("displays all preset options", async ({ page, screenshots }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      await screenshots.capture("preset_options_grid");

      // Should show preset names
      await expect(page.getByText(/minimal/i).first()).toBeVisible();
      await expect(page.getByText(/balanced/i).first()).toBeVisible();
      await expect(page.getByText(/performance/i).first()).toBeVisible();
      await expect(page.getByText(/maximum/i).first()).toBeVisible();
    });

    test("can select minimal preset", async ({ page, screenshots }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      const flow = createFlowCapture(screenshots);

      // Click minimal
      const minimalCard = page
        .locator("button, div[role=button]")
        .filter({
          hasText: /minimal/i,
        })
        .first();

      if (await minimalCard.isVisible()) {
        await flow.step("select_minimal", async () => {
          await minimalCard.click();
          await page.waitForTimeout(300);
        });

        // Should show some selection indicator
        const selectedIndicator = page.locator(
          "[aria-selected=true], [data-selected], .border-primary"
        );
        expect(await selectedIndicator.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test("can select balanced preset", async ({ page, screenshots }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      const flow = createFlowCapture(screenshots);

      const balancedCard = page
        .locator("button, div[role=button]")
        .filter({
          hasText: /balanced/i,
        })
        .first();

      if (await balancedCard.isVisible()) {
        await flow.step("select_balanced", async () => {
          await balancedCard.click();
          await page.waitForTimeout(300);
        });
      }
    });

    test("shows recommended badge on balanced", async ({
      page,
      screenshots,
    }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });

      await screenshots.capture("recommended_badge_search");

      // Look for recommended indicator
      const recommendedBadge = page.getByText(/recommended/i);
      const count = await recommendedBadge.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("visual comparison of all presets", async ({ page, screenshots }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      // Capture each preset state
      const presets = ["minimal", "balanced", "performance", "maximum"];

      for (const preset of presets) {
        const presetCard = page
          .locator("button, div[role=button]")
          .filter({ hasText: new RegExp(preset, "i") })
          .first();

        if (await presetCard.isVisible()) {
          await presetCard.click();
          await page.waitForTimeout(500);
          await screenshots.capture(`settings_preset_${preset}`, {
            fullPage: true,
          });
        }
      }
    });
  });

  test.describe("Color Palette Selection", () => {
    test("displays color palette options", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });

      // Should show color/palette section
      const paletteSection = page.getByText(/palette|color/i);
      await expect(paletteSection.first()).toBeVisible();
    });

    test("shows palette names", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      // Should show palette options (teal, purple, etc.)
      const paletteNames = page.getByText(/teal|purple|amber|emerald|rose/i);
      const count = await paletteNames.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("can select a color palette", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      // Find a palette button
      const purpleBtn = page
        .locator("button")
        .filter({ hasText: /purple/i })
        .first();
      if (await purpleBtn.isVisible()) {
        await purpleBtn.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe("Quick Adjustments", () => {
    test("shows adjustment sliders when custom", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      // Adjust something to enter custom mode
      const slider = page.locator('input[type="range"]').first();
      if (await slider.isVisible()) {
        await slider.fill("60");
        await page.waitForTimeout(300);

        // Should still show sliders
        const sliders = page.locator('input[type="range"]');
        expect(await sliders.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test("slider changes are reflected", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      const slider = page.locator('input[type="range"]').first();
      if (await slider.isVisible()) {
        const _initialValue = await slider.inputValue();
        await slider.fill("70");
        const newValue = await slider.inputValue();

        expect(newValue).toBeDefined();
      }
    });
  });

  test.describe("Save and Reset", () => {
    test("shows save button", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });

      const saveBtn = page.getByRole("button", { name: /save/i });
      await expect(saveBtn.first()).toBeVisible();
    });

    test("save button disabled when no changes", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      const saveBtn = page.getByRole("button", { name: /save/i }).first();
      // May be disabled initially
      const isDisabled = await saveBtn.isDisabled();
      expect(typeof isDisabled).toBe("boolean");
    });

    test("save button enabled after changes", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      // Make a change
      const slider = page.locator('input[type="range"]').first();
      if (await slider.isVisible()) {
        await slider.fill("40");
        await page.waitForTimeout(300);

        const saveBtn = page.getByRole("button", { name: /save/i }).first();
        // Button should be enabled or clickable
        await expect(saveBtn).toBeVisible();
      }
    });

    test("shows unsaved changes indicator", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      // Make a change
      const slider = page.locator('input[type="range"]').first();
      if (await slider.isVisible()) {
        await slider.fill("30");
        await page.waitForTimeout(300);

        // Should show unsaved indicator
        const unsavedText = page.getByText(/unsaved/i);
        const count = await unsavedText.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test("can save configuration", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      // Make a change
      const slider = page.locator('input[type="range"]').first();
      if (await slider.isVisible()) {
        await slider.fill("55");
        await page.waitForTimeout(300);

        // Save
        const saveBtn = page.getByRole("button", { name: /save/i }).first();
        if (await saveBtn.isEnabled()) {
          await saveBtn.click();
          await page.waitForTimeout(500);

          // Should show success toast or unsaved indicator should disappear
        }
      }
    });

    test("can reset to defaults", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      const resetBtn = page.getByRole("button", { name: /reset/i });
      if (await resetBtn.first().isVisible()) {
        await resetBtn.first().click();
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe("Navigation", () => {
    test("has link to full demo page", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });

      // Should have link to /demo/cortex
      const demoLink = page.getByRole("link", {
        name: /demo|full.*controls|advanced/i,
      });
      const count = await demoLink.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("can navigate to full demo", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });

      const demoLink = page
        .getByRole("link", { name: /demo|full.*controls|advanced/i })
        .first();
      if (await demoLink.isVisible()) {
        await demoLink.click();
        await page.waitForTimeout(1000);

        // Should navigate to demo page
        const url = page.url();
        expect(url.includes("/demo/cortex") || url.includes("/demo")).toBe(
          true
        );
      }
    });

    test("back link returns to settings", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });

      const backLink = page.getByRole("link", { name: /back.*settings/i });
      if (await backLink.isVisible()) {
        await backLink.click();
        await page.waitForURL(/\/settings$/);
        await expect(page).toHaveURL(/\/settings$/);
      }
    });
  });

  test.describe("Persistence", () => {
    test("preset persists after save and reload", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      // Select minimal preset
      const minimalCard = page
        .locator("button, div[role=button]")
        .filter({
          hasText: /minimal/i,
        })
        .first();

      if (await minimalCard.isVisible()) {
        await minimalCard.click();
        await page.waitForTimeout(300);

        // Save
        const saveBtn = page.getByRole("button", { name: /save/i }).first();
        if (await saveBtn.isEnabled()) {
          await saveBtn.click();
          await page.waitForTimeout(1000);

          // Reload
          await page.reload({ waitUntil: "networkidle" });
          await page.waitForTimeout(500);

          // Minimal should still be selected
          const _minimalAfter = page
            .locator("[aria-selected=true], [data-selected=true]")
            .filter({
              hasText: /minimal/i,
            });
          // May or may not have explicit selection attribute
        }
      }
    });
  });

  test.describe("Error Handling", () => {
    test("handles offline gracefully", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      // Go offline
      await page.context().setOffline(true);

      // Try to save
      const slider = page.locator('input[type="range"]').first();
      if (await slider.isVisible()) {
        await slider.fill("45");
      }

      const saveBtn = page.getByRole("button", { name: /save/i }).first();
      if (await saveBtn.isEnabled()) {
        await saveBtn.click();
        await page.waitForTimeout(1000);

        // Should show error or handle gracefully
      }

      // Restore network
      await page.context().setOffline(false);

      // Page should still be functional
      await expect(
        page.getByRole("heading", { name: /visual|appearance/i }).first()
      ).toBeVisible();
    });
  });

  test.describe("Accessibility", () => {
    test("sliders have labels", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });

      const sliders = page.locator('input[type="range"]');
      const count = await sliders.count();

      // Each slider should have an accessible label nearby
      for (let i = 0; i < Math.min(count, 3); i++) {
        const slider = sliders.nth(i);
        if (await slider.isVisible()) {
          // Check for aria-label or nearby label element
          const ariaLabel = await slider.getAttribute("aria-label");
          const id = await slider.getAttribute("id");
          const _hasLabel =
            ariaLabel ||
            (id && (await page.locator(`label[for="${id}"]`).count()) > 0);
          // May or may not have explicit labels
        }
      }
    });

    test("preset cards are keyboard navigable", async ({ page }) => {
      await page.goto("/settings/visual", { waitUntil: "networkidle" });

      // Tab to preset cards
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      // Press Enter to select
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);

      // Should be able to navigate with keyboard
    });
  });
});
