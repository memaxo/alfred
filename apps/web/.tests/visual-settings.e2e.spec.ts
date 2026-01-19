/**
 * Visual Settings E2E Tests (Desktop Settings App)
 *
 * Visual settings now live inside the Settings desktop window under
 * the "Visual & Desktop" section.
 */

import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import { openSettingsWindow } from "./helpers/mindscape";

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

test.describe("Visual Settings (Settings desktop window)", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("loads visual section", async ({ page }, testInfo) => {
    const settingsWindow = await openVisualSection(page);
    await captureSettingsWindow(
      page,
      settingsWindow,
      testInfo,
      "visual_section_loaded"
    );
  });

  test("shows preview canvas", async ({ page }, testInfo) => {
    const settingsWindow = await openVisualSection(page);
    await expect(settingsWindow.locator("canvas")).toBeVisible();
    await captureSettingsWindow(
      page,
      settingsWindow,
      testInfo,
      "preview_canvas"
    );
  });

  test("can select a preset", async ({ page }, testInfo) => {
    const settingsWindow = await openVisualSection(page);

    const minimalCard = settingsWindow
      .locator("button, div[role=button]")
      .filter({ hasText: /minimal/i })
      .first();

    await expect(minimalCard).toBeVisible();
    await minimalCard.click();
    await captureSettingsWindow(
      page,
      settingsWindow,
      testInfo,
      "preset_minimal_selected"
    );
  });

  test("can select a color palette", async ({ page }, testInfo) => {
    const settingsWindow = await openVisualSection(page);

    const purpleBtn = settingsWindow
      .locator("button")
      .filter({ hasText: /purple/i })
      .first();
    await expect(purpleBtn).toBeVisible();
    await purpleBtn.click();
    await captureSettingsWindow(
      page,
      settingsWindow,
      testInfo,
      "palette_purple_selected"
    );
  });

  test("changes show unsaved indicator", async ({ page }, testInfo) => {
    const settingsWindow = await openVisualSection(page);

    const minimalCard = settingsWindow
      .locator("button, div[role=button]")
      .filter({ hasText: /minimal/i })
      .first();

    await expect(minimalCard).toBeVisible();
    await minimalCard.click();

    await expect(settingsWindow.getByText(/unsaved changes/i)).toBeVisible();
    await captureSettingsWindow(
      page,
      settingsWindow,
      testInfo,
      "unsaved_changes_indicator"
    );
  });
});
