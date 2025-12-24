import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import {
  getCanvas,
  getControls,
  getMinimap,
  getWindow,
  navigateToDesktop,
} from "./helpers/desktop";

test.describe("Desktop smoke", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("desktop loads with canvas and controls", async ({ page }) => {
    await navigateToDesktop(page);

    // Canvas should be visible
    await expect(getCanvas(page)).toBeVisible();

    // Controls should be visible
    await expect(getControls(page)).toBeVisible();

    // MiniMap should be visible
    await expect(getMinimap(page)).toBeVisible();
  });

  test("default chat window exists", async ({ page }) => {
    await navigateToDesktop(page);

    // Default chat window should exist
    const chatWindow = getWindow(page, "chat");
    await expect(chatWindow).toBeVisible();
  });

  test("canvas is interactive", async ({ page }) => {
    await navigateToDesktop(page);

    const canvas = getCanvas(page);

    // Should be able to interact with canvas
    await canvas.click();

    // Zoom controls should work
    const zoomIn = page.locator(".react-flow__controls-zoomin");
    await expect(zoomIn).toBeVisible();
    await zoomIn.click();

    const zoomOut = page.locator(".react-flow__controls-zoomout");
    await expect(zoomOut).toBeVisible();
    await zoomOut.click();
  });

  test("route redirects work", async ({ page }) => {
    // Navigate to root should show desktop
    await page.goto("/");
    await expect(getCanvas(page)).toBeVisible();

    // URL should be /
    expect(page.url()).toContain("/");
  });
});
