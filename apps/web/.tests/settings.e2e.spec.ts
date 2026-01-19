/**
 * Settings Desktop App E2E Tests
 *
 * Settings are now primarily available as a desktop window.
 * The `/settings` route remains as an informational legacy page.
 */

import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import { openSettingsWindow } from "./helpers/mindscape";

test.describe("Settings (legacy route)", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("shows desktop redirect info", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "networkidle" });
    await expect(page.getByText("Unified Settings Desktop App")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /available in desktop mode/i })
    ).toBeVisible();
  });
});

test.describe("Settings Desktop Window", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("can open Settings window from command palette", async ({ page }) => {
    const settingsWindow = await openSettingsWindow(page);

    await expect(settingsWindow.getByText("Settings")).toBeVisible();
    await expect(
      settingsWindow.getByRole("button", { name: "Voice & Speech" })
    ).toBeVisible();
    await expect(
      settingsWindow.getByRole("button", { name: "Visual & Desktop" })
    ).toBeVisible();
  });

  test("can switch to Voice & Speech section", async ({ page }) => {
    const settingsWindow = await openSettingsWindow(page);

    await settingsWindow
      .getByRole("button", { name: "Voice & Speech" })
      .click();

    await expect(
      settingsWindow.getByRole("heading", { name: "Voice & Speech" })
    ).toBeVisible();
    await expect(settingsWindow.getByText("Input Mode")).toBeVisible();
    await expect(
      settingsWindow.getByRole("button", { name: /push to talk/i })
    ).toBeVisible();
  });
});
