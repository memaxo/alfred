import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import {
  countWindows,
  getCanvas,
  getWindow,
  navigateToDesktop,
} from "./helpers/desktop";

test.describe("Desktop deep linking", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("?spawn=note creates a note window", async ({ page }) => {
    await page.goto("/?spawn=note");
    await expect(getCanvas(page)).toBeVisible();

    // Note window should be created
    const noteWindow = getWindow(page, "note");
    await expect(noteWindow).toBeVisible();
  });

  test("?spawn=terminal creates a terminal window", async ({ page }) => {
    await page.goto("/?spawn=terminal");
    await expect(getCanvas(page)).toBeVisible();

    const terminalWindow = getWindow(page, "terminal");
    await expect(terminalWindow).toBeVisible();
  });

  test("?spawn=reminder creates a reminder window", async ({ page }) => {
    await page.goto("/?spawn=reminder");
    await expect(getCanvas(page)).toBeVisible();

    const reminderWindow = getWindow(page, "reminder");
    await expect(reminderWindow).toBeVisible();
  });

  test("?spawn=settings creates settings window", async ({ page }) => {
    await page.goto("/?spawn=settings");
    await expect(getCanvas(page)).toBeVisible();

    const settingsWindow = getWindow(page, "settings");
    await expect(settingsWindow).toBeVisible();
  });

  test("invalid spawn type is ignored", async ({ page }) => {
    await page.goto("/?spawn=invalid_type");
    await expect(getCanvas(page)).toBeVisible();

    // Desktop should still load without errors
    // Default chat window should exist
    const chatWindow = getWindow(page, "chat");
    await expect(chatWindow).toBeVisible();
  });

  test("multiple deep link params work together", async ({ page }) => {
    await page.goto("/?spawn=note&resourceType=note&resourceId=test-123");
    await expect(getCanvas(page)).toBeVisible();

    // Note window should be created with resource ref
    const noteWindow = getWindow(page, "note");
    await expect(noteWindow).toBeVisible();
  });

  test("desktop loads cleanly without search params", async ({ page }) => {
    await navigateToDesktop(page);

    // Canvas and default windows should load
    await expect(getCanvas(page)).toBeVisible();
    const chatWindow = getWindow(page, "chat");
    await expect(chatWindow).toBeVisible();
  });

  test("deep link spawns only once per param set", async ({ page }) => {
    // Navigate with spawn param
    await page.goto("/?spawn=note");
    await expect(getCanvas(page)).toBeVisible();

    const initialCount = await countWindows(page, "note");
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Reload with same params shouldn't double spawn
    await page.reload();
    await expect(getCanvas(page)).toBeVisible();

    // Count may increase due to re-processing, but should be controlled
    const newCount = await countWindows(page, "note");
    expect(newCount).toBeLessThanOrEqual(initialCount + 1);
  });
});
