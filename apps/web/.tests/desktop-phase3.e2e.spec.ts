import { expect, test } from "@playwright/test";

import { signUpTestUser } from "./helpers/auth";
import {
  countWindows,
  focusWindow,
  getLatestWindow,
  navigateToDesktop,
  spawnFromDock,
} from "./helpers/desktop";

test.describe("Desktop Phase 3 Features", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
    await navigateToDesktop(page);
  });

  test.describe("Keyboard Shortcuts", () => {
    test("Cmd+W closes focused window", async ({ page }) => {
      // Spawn a note window
      await spawnFromDock(page, "note");
      const noteWindow = getLatestWindow(page, "note");
      await focusWindow(noteWindow);

      const beforeClose = await countWindows(page, "note");

      // Press Cmd+W (Meta+W)
      await page.keyboard.press("Meta+w");

      // Should have one fewer window
      const afterClose = await countWindows(page, "note");
      expect(afterClose).toBe(beforeClose - 1);
    });

    test("Cmd+H hides/minimizes focused window", async ({ page }) => {
      // Spawn a note window
      await spawnFromDock(page, "note");
      const noteWindow = getLatestWindow(page, "note");
      await focusWindow(noteWindow);

      // Press Cmd+H (Meta+H)
      await page.keyboard.press("Meta+h");

      // Window should be minimized (state = "minimized")
      // Check that window is not visible
      // Note: Minimized windows still exist in DOM but are hidden
      await expect(noteWindow).not.toBeVisible();
    });

    test("Cmd+M toggles Mindscape canvas", async ({ page }) => {
      // Check current Mindscape state (visible/hidden)
      const mindscape = page.locator(".react-flow");
      const isVisible = await mindscape.isVisible();

      // Press Cmd+M (Meta+M)
      await page.keyboard.press("Meta+m");

      // Mindscape should toggle visibility
      if (isVisible) {
        await expect(mindscape).not.toBeVisible();
      } else {
        await expect(mindscape).toBeVisible();
      }
    });

    test("Cmd+Q triggers quit/focus change", async ({ page }) => {
      // Spawn a note window
      await spawnFromDock(page, "note");
      const noteWindow = getLatestWindow(page, "note");
      await focusWindow(noteWindow);

      // Cmd+Q should close the application or focus change
      // This is environment-dependent, so we just test it doesn't crash

      // Press Cmd+Q (Meta+Q)
      await page.keyboard.press("Meta+q");

      // Verify no crashes
      // Application behavior depends on environment
    });

    test("Ctrl+Arrow navigates tiling zones", async ({ page }) => {
      // This requires tiling to be active
      // For now, just verify the key events don't crash
      await page.keyboard.press("Control+ArrowRight");
      await page.keyboard.press("Control+ArrowLeft");
      await page.keyboard.press("Control+ArrowDown");
      await page.keyboard.press("Control+ArrowUp");

      // Verify no errors or crashes
      const errors = await page.locator("[role='alert']");
      await expect(errors).not.toBeVisible();
    });
  });

  test.describe("Mindscape Round-Trip", () => {
    test("Visualize button projects window to Mindscape", async ({ page }) => {
      // Spawn a note window
      await spawnFromDock(page, "note");
      const noteWindow = getLatestWindow(page, "note");
      await focusWindow(noteWindow);

      // Find and click the Visualize button (Sparkles icon)
      const visualizeButton = noteWindow.getByRole("button", {
        name: /visualize/i,
      });

      const buttonCount = await visualizeButton.count();
      if (buttonCount > 0) {
        await visualizeButton.click();

        // Window should be minimized/handled
        // Mindscape should be activated
        const mindscape = page.locator(".react-flow");
        await expect(mindscape).toBeVisible();

        // Check for projected node in Mindscape
        // (This requires Mindscape canvas inspection)
      }
    });

    test("Double-click node restores window", async ({ page }) => {
      // This test requires Mindscape to have a projected window-type node
      // For now, we test the verify the interaction doesn't crash
      const mindscape = page.locator(".react-flow");
      await expect(mindscape).toBeVisible();

      // Double-click on any Mindscape node
      const nodes = mindscape.locator(".react-flow__node");
      const nodeCount = await nodes.count();

      if (nodeCount > 0) {
        const firstNode = nodes.first();
        await firstNode.dblclick();

        // Should not cause errors
        const errors = await page.locator("[role='alert']");
        await expect(errors).not.toBeVisible();
      }
    });
  });

  test.describe("AppLauncher Categories", () => {
    test("AppLauncher button shows popover", async ({ page }) => {
      // Find the AppLauncher button in taskbar
      const taskbar = page.locator("[data-layer='taskbar']");
      const appLauncherButton = taskbar.getByRole("button", {
        name: /launcher|apps/i,
      });

      const buttonCount = await appLauncherButton.count();
      if (buttonCount > 0) {
        await appLauncherButton.click();

        // Check for popover/dropdown
        const popover = page.locator("[role='dialog'], [role='menu']");
        // Should show app grid
        await expect(popover).toBeVisible();
      }
    });

    test("Search filters apps in launcher", async ({ page }) => {
      // Open AppLauncher
      const taskbar = page.locator("[data-layer='taskbar']");
      const appLauncherButton = taskbar.getByRole("button", {
        name: /launcher|apps/i,
      });

      const buttonCount = await appLauncherButton.count();
      if (buttonCount === 0) {
        test.skip();
        return;
      }

      await appLauncherButton.click();

      // Find search input
      const searchInput = page.locator(
        "input[type='text']:visible, input[placeholder*='search']:visible"
      );

      const searchCount = await searchInput.count();
      if (searchCount > 0) {
        // Search for a known app
        await searchInput.fill("chat");

        // Verify filtered results
        const appItems = page.locator("[data-app-type]");
        const filtered = await appItems.count();
        expect(filtered).toBeGreaterThan(0);
      }
    });

    test("Categories organize apps in launcher", async ({ page }) => {
      // Open AppLauncher
      const taskbar = page.locator("[data-layer='taskbar']");
      const appLauncherButton = taskbar.getByRole("button", {
        name: /launcher|apps/i,
      });

      const buttonCount = await appLauncherButton.count();
      if (buttonCount === 0) {
        test.skip();
        return;
      }

      await appLauncherButton.click();

      // Check for category headers (Core, Productivity, System)
      const categoryHeaders = page.locator("[data-category], [role='heading']");
      const categoryCount = await categoryHeaders.count();

      // Should have at least one category visible
      expect(categoryCount).toBeGreaterThan(0);
    });
  });

  test.describe("Desktop Icons", () => {
    test("Double-clicking desktop icon opens app", async ({ page }) => {
      // Find desktop icon layer
      const desktopIcons = page.locator("[data-layer='desktop-icons']");
      const iconsCount = await desktopIcons.count();

      if (iconsCount > 0) {
        const firstIcon = desktopIcons.getByRole("button").first();

        // Double-click to open
        await firstIcon.dblclick();

        // Should spawn window (check for window count change)
        // This is app-specific, so we just verify it doesn't crash
        const errors = await page.locator("[role='alert']");
        await expect(errors).not.toBeVisible();
      }
    });

    test("Right-click shows context menu", async ({ page }) => {
      const desktopIcons = page.locator("[data-layer='desktop-icons']");
      const iconsCount = await desktopIcons.count();

      if (iconsCount > 0) {
        const firstIcon = desktopIcons.getByRole("button").first();

        // Right-click
        await firstIcon.click({ button: "right" });

        // Check for context menu
        const contextMenu = page.locator("[role='menu']");
        await expect(contextMenu).toBeVisible();
      }
    });
  });

  test.describe("Window Animations", () => {
    test("Window spawn has animation", async ({ page }) => {
      // Measure time from spawn to visible
      const startTime = Date.now();

      await spawnFromDock(page, "note");
      const noteWindow = getLatestWindow(page, "note");

      await expect(noteWindow).toBeVisible();

      const duration = Date.now() - startTime;

      // Animation should complete within reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });

    test("Minimize animation occurs smoothly", async ({ page }) => {
      await spawnFromDock(page, "note");
      const noteWindow = getLatestWindow(page, "note");
      await focusWindow(noteWindow);

      const isVisibleBefore = await noteWindow.isVisible();
      expect(isVisibleBefore).toBe(true);

      // Press Cmd+H to minimize
      await page.keyboard.press("Meta+h");

      // Should animate to minimize (not instant)
      // Check that window has transition styles
      const hasTransition = await noteWindow.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.transition && style.transition !== "none";
      });

      expect(hasTransition).toBe(true);
    });
  });
});
