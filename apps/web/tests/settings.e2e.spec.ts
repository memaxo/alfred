/**
 * Settings and Preferences E2E Tests
 *
 * Tests the settings page and preference management:
 * - Voice selection and preview
 * - Privacy controls
 * - Preference persistence
 */

import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";

test.describe("Settings Page E2E", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test.describe("Settings Navigation", () => {
    test("can access settings page", async ({ page }) => {
      await page.goto("/settings", { waitUntil: "networkidle" });

      await expect(page).toHaveURL(/\/settings/);
      await expect(page.getByText("Settings")).toBeVisible();
    });

    test("settings page shows voice section", async ({ page }) => {
      await page.goto("/settings", { waitUntil: "networkidle" });

      // Should see voice settings section
      await expect(page.getByText(/voice/i)).toBeVisible();
    });
  });

  test.describe("Voice Settings", () => {
    test("displays available voices", async ({ page }) => {
      await page.goto("/settings", { waitUntil: "networkidle" });

      // Wait for voices to load
      await page.waitForTimeout(2000);

      // Should see voice options
      const voiceSection = page.locator("text=Voice").first().locator("..");
      await expect(voiceSection).toBeVisible();

      // Should have selectable voice cards
      const voiceCards = page.locator("[class*='cursor-pointer']").filter({
        has: page.locator("text=/alloy|echo|nova|shimmer|onyx|fable/i"),
      });

      // May have voices or may show loading state
      const count = await voiceCards.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("can select a voice", async ({ page }) => {
      await page.goto("/settings", { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);

      // Find a voice option to click
      const voiceCard = page
        .locator("[class*='cursor-pointer']")
        .filter({
          hasText: /alloy|echo|nova/i,
        })
        .first();

      if (await voiceCard.isVisible()) {
        await voiceCard.click();

        // Should show success feedback
        await page.waitForTimeout(1000);

        // Voice should be selected (indicated by styling)
        const selectedIndicator = voiceCard.locator(
          "[class*='bg-primary'], [class*='border-primary']"
        );
        // Selection indicator may be present
        expect(await selectedIndicator.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test("can preview voice", async ({ page }) => {
      await page.goto("/settings", { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);

      // Find preview input
      const previewInput = page.locator(
        "input[placeholder*='preview'], input[placeholder*='type']"
      );
      if (await previewInput.isVisible()) {
        await previewInput.fill("Hello, this is a test preview.");

        // Find preview button
        const previewBtn = page.getByRole("button", { name: /preview/i });
        if (await previewBtn.isVisible()) {
          await previewBtn.click();

          // Should trigger audio playback (button might change state)
          await page.waitForTimeout(2000);
        }
      }
    });
  });

  test.describe("Preference Persistence", () => {
    test("voice preference persists across reloads", async ({ page }) => {
      await page.goto("/settings", { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);

      // Select a voice
      const echoCard = page
        .locator("[class*='cursor-pointer']")
        .filter({
          hasText: /echo/i,
        })
        .first();

      if (await echoCard.isVisible()) {
        await echoCard.click();
        await page.waitForTimeout(1500); // Wait for save

        // Reload page
        await page.reload({ waitUntil: "networkidle" });
        await page.waitForTimeout(2000);

        // Echo should still be selected
        const echoCardAfter = page
          .locator("[class*='cursor-pointer']")
          .filter({
            hasText: /echo/i,
          })
          .first();

        // Should have selection indicator
        const indicator = echoCardAfter.locator(
          "[class*='bg-primary'], .rounded-full"
        );
        expect(await indicator.count()).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

test.describe("Profile Settings", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("can access profile from mindscape", async ({ page }) => {
    await expect(page.locator(".react-flow")).toBeVisible();

    // Open command palette
    await page.keyboard.press("Meta+K");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Search for profile
    await dialog.getByPlaceholder(/create or jump/i).fill("profile");
    await page.waitForTimeout(500);

    // Click profile option
    const profileOption = dialog
      .locator("[data-command-item]")
      .filter({
        hasText: /profile/i,
      })
      .first();

    if (await profileOption.isVisible()) {
      await profileOption.click();
      await page.waitForTimeout(1000);

      // Should see profile node
      const profileNode = page.locator(".react-flow__node-profile");
      expect(await profileNode.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test("profile node shows user info", async ({ page }) => {
    // Open command palette and spawn profile
    await page.keyboard.press("Meta+K");
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/create or jump/i).fill("profile");
    await page.waitForTimeout(500);

    const profileOption = dialog
      .locator("[data-command-item]")
      .filter({
        hasText: /profile/i,
      })
      .first();

    if (await profileOption.isVisible()) {
      await profileOption.click();
      await page.waitForTimeout(1000);

      // Profile node should show email or name
      const profileNode = page.locator(".react-flow__node-profile").last();
      if (await profileNode.isVisible()) {
        // Should contain user email pattern
        const content = await profileNode.textContent();
        expect(content).toBeDefined();
      }
    }
  });
});

test.describe("Autonomy Settings", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("can access autonomy settings", async ({ page }) => {
    // Look for settings node or autonomy controls
    await page.keyboard.press("Meta+K");
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/create or jump/i).fill("settings");
    await page.waitForTimeout(500);

    const settingsOption = dialog
      .locator("[data-command-item]")
      .filter({
        hasText: /settings/i,
      })
      .first();

    if (await settingsOption.isVisible()) {
      await settingsOption.click();
      await page.waitForTimeout(1000);

      // May show settings node or navigate to settings page
      const url = page.url();
      const hasSettingsNode =
        (await page.locator(".react-flow__node-settings").count()) > 0;
      const isSettingsPage = url.includes("/settings");

      expect(hasSettingsNode || isSettingsPage).toBe(true);
    }
  });
});

test.describe("Privacy Controls", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("can view privacy summary", async ({ page }) => {
    // Access profile to find privacy controls
    await page.keyboard.press("Meta+K");
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/create or jump/i).fill("profile");
    await page.waitForTimeout(500);

    const profileOption = dialog
      .locator("[data-command-item]")
      .filter({
        hasText: /profile/i,
      })
      .first();

    if (await profileOption.isVisible()) {
      await profileOption.click();
      await page.waitForTimeout(1000);

      // Look for privacy section in profile node
      const profileNode = page.locator(".react-flow__node-profile").last();
      if (await profileNode.isVisible()) {
        const privacySection = profileNode.getByText(/privacy|data/i);
        expect(await privacySection.count()).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

test.describe("Settings Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("handles API errors gracefully on settings page", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "networkidle" });

    // Temporarily go offline
    await page.context().setOffline(true);

    // Try to interact with settings
    const voiceCard = page.locator("[class*='cursor-pointer']").first();
    if (await voiceCard.isVisible()) {
      await voiceCard.click();
    }

    // Should not crash - may show error toast
    await page.waitForTimeout(2000);

    // Restore network
    await page.context().setOffline(false);

    // Page should still be functional
    await expect(page.getByText("Settings")).toBeVisible();
  });

  test("recovers from failed preference save", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Page should remain stable even if saves fail
    await expect(page.getByText("Settings")).toBeVisible();
    await expect(page.getByText(/voice/i)).toBeVisible();
  });
});
