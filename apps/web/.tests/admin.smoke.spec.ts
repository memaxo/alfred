import { expect, test } from "@playwright/test";

import { signUpTestUser } from "./helpers/auth";
import { getWindow, navigateToDesktop } from "./helpers/desktop";

test.describe("Admin Operations Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("Legacy admin route redirects to desktop hub", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Desktop First Experience")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Launch Desktop Admin/i })
    ).toBeVisible();

    // Clicking launch should go to desktop with spawn=admin
    await page.getByRole("link", { name: /Launch Desktop Admin/i }).click();
    await expect(page).toHaveURL(/\/\?spawn=admin/);

    // Should see the Admin window
    const adminWindow = getWindow(page, "admin");
    await expect(adminWindow).toBeVisible();
    await expect(adminWindow.getByText("Admin & Operations")).toBeVisible();
  });

  test("Can spawn Admin window via command palette", async ({ page }) => {
    await navigateToDesktop(page);

    await page.keyboard.press("Meta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const input = dialog.getByRole("combobox");
    await input.fill("Admin");

    const adminOption = dialog.getByRole("option", { name: /New Admin/i });
    await expect(adminOption).toBeVisible();
    await adminOption.click();

    // Dialog should close and window should appear
    await expect(dialog).toBeHidden();
    const adminWindow = getWindow(page, "admin");
    await expect(adminWindow).toBeVisible();
  });

  test("Deep linking to specific admin tool works", async ({ page }) => {
    await page.goto("/?spawn=metrics");

    const metricsWindow = getWindow(page, "metrics");
    await expect(metricsWindow).toBeVisible();
    await expect(metricsWindow.getByText("Metrics Dashboard")).toBeVisible();
  });

  test("Admin app allows switching between sub-views", async ({ page }) => {
    await page.goto("/?spawn=admin");
    const adminWindow = getWindow(page, "admin");

    // Performance tab (default)
    await expect(adminWindow.getByText("Operational Dashboard")).toBeVisible();

    // Switch to Voice Ops
    await adminWindow.getByRole("button", { name: /Voice Ops/i }).click();
    await expect(
      adminWindow.getByText("Voice Operations Console")
    ).toBeVisible();

    // Switch to Sessions
    await adminWindow.getByRole("button", { name: /Sessions/i }).click();
    await expect(adminWindow.getByText("Active Sessions")).toBeVisible();
  });
});
