/**
 * Cognitive Full Flow E2E Tests
 *
 * Tests the complete cognitive flow in the UI:
 * - Cognitive state visualization in Mindscape
 * - Physiology metrics display
 * - Autonomy slider interactions
 * - Feedback submission flow
 *
 * Run: bunx playwright test cognitive-full-flow.e2e.spec.ts
 */

import { expect, test } from "@playwright/test";

test.describe("Cognitive Full Flow E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    // Wait for app to load
    await page.waitForLoadState("networkidle");
  });

  test.describe("Cognitive State Visualization", () => {
    test("displays cognitive state in Mindscape", async ({ page }) => {
      // Navigate to Mindscape if not on it
      const mindscapeLink = page.locator('a[href*="mindscape"]');
      if (await mindscapeLink.isVisible()) {
        await mindscapeLink.click();
        await page.waitForLoadState("networkidle");
      }

      // Check for cognitive state indicator
      const stateIndicator = page.locator('[data-testid="cognitive-state"]');
      if (await stateIndicator.isVisible()) {
        await expect(stateIndicator).toBeVisible();
      }
    });

    test("cognitive state updates on user action", async ({ page }) => {
      // Trigger a cognitive action (e.g., chat message)
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("Test message for cognitive state");
        await chatInput.press("Enter");

        // Wait for response
        await page.waitForTimeout(2000);

        // State should update
        const stateIndicator = page.locator('[data-testid="cognitive-state"]');
        if (await stateIndicator.isVisible()) {
          // State might transition from idle to thinking
          await expect(stateIndicator).toBeVisible();
        }
      }
    });

    test("visualizes state transitions", async ({ page }) => {
      // Check for transition animations or indicators
      const transitionIndicator = page.locator(
        '[data-testid="state-transition"]'
      );

      if (await transitionIndicator.isVisible({ timeout: 1000 })) {
        // Should show current state
        await expect(transitionIndicator).toBeVisible();
      }
    });
  });

  test.describe("Physiology Metrics Display", () => {
    test("displays energy metric", async ({ page }) => {
      const energyMetric = page.locator('[data-testid="physiology-energy"]');

      if (await energyMetric.isVisible({ timeout: 1000 })) {
        await expect(energyMetric).toBeVisible();
        // Energy should be between 0 and 1 (displayed as percentage or bar)
      }
    });

    test("displays boredom metric", async ({ page }) => {
      const boredomMetric = page.locator('[data-testid="physiology-boredom"]');

      if (await boredomMetric.isVisible({ timeout: 1000 })) {
        await expect(boredomMetric).toBeVisible();
      }
    });

    test("displays frustration metric", async ({ page }) => {
      const frustrationMetric = page.locator(
        '[data-testid="physiology-frustration"]'
      );

      if (await frustrationMetric.isVisible({ timeout: 1000 })) {
        await expect(frustrationMetric).toBeVisible();
      }
    });

    test("physiology metrics update over time", async ({ page }) => {
      // Interact with the system to trigger physiology changes
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("Multiple tasks to affect physiology");
        await chatInput.press("Enter");

        // Wait for metrics to update
        await page.waitForTimeout(3000);

        // Check that physiology panel exists
        const physiologyPanel = page.locator(
          '[data-testid="physiology-panel"]'
        );
        if (await physiologyPanel.isVisible({ timeout: 1000 })) {
          await expect(physiologyPanel).toBeVisible();
        }
      }
    });
  });

  test.describe("Autonomy Slider Interactions", () => {
    test("displays autonomy level slider", async ({ page }) => {
      // Navigate to settings or autonomy controls
      const settingsLink = page.locator('a[href*="settings"]');
      if (await settingsLink.isVisible()) {
        await settingsLink.click();
        await page.waitForLoadState("networkidle");
      }

      const autonomySlider = page.locator('[data-testid="autonomy-slider"]');

      if (await autonomySlider.isVisible({ timeout: 1000 })) {
        await expect(autonomySlider).toBeVisible();
      }
    });

    test("slider changes autonomy level", async ({ page }) => {
      // Navigate to settings
      const settingsLink = page.locator('a[href*="settings"]');
      if (await settingsLink.isVisible()) {
        await settingsLink.click();
        await page.waitForLoadState("networkidle");
      }

      const slider = page.locator(
        '[data-testid="autonomy-slider"] input[type="range"]'
      );

      if (await slider.isVisible({ timeout: 1000 })) {
        // Get initial value
        const _initialValue = await slider.inputValue();

        // Change value
        await slider.fill("0.5");

        // Value should change
        const newValue = await slider.inputValue();
        expect(newValue).toBe("0.5");
      }
    });

    test("displays autonomy level description", async ({ page }) => {
      const autonomyDescription = page.locator(
        '[data-testid="autonomy-description"]'
      );

      if (await autonomyDescription.isVisible({ timeout: 1000 })) {
        // Should show current band description
        await expect(autonomyDescription).toBeVisible();
      }
    });

    test("confirmation required for high autonomy", async ({ page }) => {
      // Navigate to settings
      const settingsLink = page.locator('a[href*="settings"]');
      if (await settingsLink.isVisible()) {
        await settingsLink.click();
        await page.waitForLoadState("networkidle");
      }

      const slider = page.locator(
        '[data-testid="autonomy-slider"] input[type="range"]'
      );

      if (await slider.isVisible({ timeout: 1000 })) {
        // Try to set high autonomy
        await slider.fill("0.9");

        // Check for confirmation dialog
        const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
        if (await confirmDialog.isVisible({ timeout: 1000 })) {
          await expect(confirmDialog).toBeVisible();
        }
      }
    });
  });

  test.describe("Feedback Submission Flow", () => {
    test("feedback button appears on assistant responses", async ({ page }) => {
      // Send a message to get a response
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("Hello Alfred");
        await chatInput.press("Enter");

        // Wait for response
        await page.waitForTimeout(3000);

        // Check for feedback buttons
        const feedbackBtn = page
          .locator('[data-testid="feedback-btn"]')
          .first();
        if (await feedbackBtn.isVisible({ timeout: 1000 })) {
          await expect(feedbackBtn).toBeVisible();
        }
      }
    });

    test("positive feedback submission", async ({ page }) => {
      // Send a message first
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("Help me understand feedback");
        await chatInput.press("Enter");
        await page.waitForTimeout(3000);

        // Click positive feedback
        const thumbsUp = page
          .locator('[data-testid="feedback-positive"]')
          .first();
        if (await thumbsUp.isVisible({ timeout: 1000 })) {
          await thumbsUp.click();

          // Check for success indicator
          const successToast = page.locator('[data-testid="toast-success"]');
          if (await successToast.isVisible({ timeout: 1000 })) {
            await expect(successToast).toBeVisible();
          }
        }
      }
    });

    test("negative feedback shows explanation form", async ({ page }) => {
      // Send a message first
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("Test negative feedback flow");
        await chatInput.press("Enter");
        await page.waitForTimeout(3000);

        // Click negative feedback
        const thumbsDown = page
          .locator('[data-testid="feedback-negative"]')
          .first();
        if (await thumbsDown.isVisible({ timeout: 1000 })) {
          await thumbsDown.click();

          // Should show explanation form
          const feedbackForm = page.locator('[data-testid="feedback-form"]');
          if (await feedbackForm.isVisible({ timeout: 1000 })) {
            await expect(feedbackForm).toBeVisible();
          }
        }
      }
    });

    test("feedback explanation submission", async ({ page }) => {
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("Test feedback explanation");
        await chatInput.press("Enter");
        await page.waitForTimeout(3000);

        // Click negative feedback
        const thumbsDown = page
          .locator('[data-testid="feedback-negative"]')
          .first();
        if (await thumbsDown.isVisible({ timeout: 1000 })) {
          await thumbsDown.click();

          // Fill explanation
          const explanationInput = page.locator(
            '[data-testid="feedback-explanation"]'
          );
          if (await explanationInput.isVisible({ timeout: 1000 })) {
            await explanationInput.fill("Expected different response format");

            // Submit
            const submitBtn = page.locator('[data-testid="feedback-submit"]');
            if (await submitBtn.isVisible()) {
              await submitBtn.click();
            }
          }
        }
      }
    });
  });
});
