import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import {
  closeWindow,
  countWindows,
  dragWindow,
  focusWindow,
  getLatestWindow,
  getWindow,
  navigateToDesktop,
} from "./helpers/desktop";
import { spawnNode } from "./helpers/mindscape";

test.describe("Desktop window lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
    await navigateToDesktop(page);
  });

  test("can spawn a note window", async ({ page }) => {
    const initialCount = await countWindows(page, "note");

    await spawnNode(page, "Note");

    const newCount = await countWindows(page, "note");
    expect(newCount).toBe(initialCount + 1);

    const noteWindow = getLatestWindow(page, "note");
    await expect(noteWindow).toBeVisible();
  });

  test("can spawn multiple windows", async ({ page }) => {
    // Skip: sidebar collapses after first spawn in test environment
    await spawnNode(page, "Note");
    await spawnNode(page, "Note");

    const count = await countWindows(page, "note");
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("window receives focus on click", async ({ page }) => {
    await spawnNode(page, "Note");

    const noteWindow = getLatestWindow(page, "note");
    await focusWindow(noteWindow);

    // Window should have visual focus indication
    await expect(noteWindow).toHaveClass(/selected/);
  });

  test("can drag window to new position", async ({ page }) => {
    await spawnNode(page, "Note");

    const noteWindow = getLatestWindow(page, "note");
    const initialBox = await noteWindow.boundingBox();
    expect(initialBox).not.toBeNull();

    await dragWindow(page, noteWindow, 100, 50);

    const newBox = await noteWindow.boundingBox();
    expect(newBox).not.toBeNull();

    // Position should have changed
    if (initialBox && newBox) {
      expect(newBox.x).not.toBe(initialBox.x);
      expect(newBox.y).not.toBe(initialBox.y);
    }
  });

  test("window position persists after page reload", async ({ page }) => {
    // Skip: localStorage not persisted across reloads in test environment
    await spawnNode(page, "Note");

    const noteWindow = getLatestWindow(page, "note");
    await dragWindow(page, noteWindow, 200, 100);

    const positionBefore = await noteWindow.boundingBox();

    // Reload page
    await page.reload();
    await expect(getWindow(page, "note")).toBeVisible();

    const positionAfter = await getLatestWindow(page, "note").boundingBox();

    // Position should be similar (within tolerance for layout)
    if (positionBefore && positionAfter) {
      expect(Math.abs(positionAfter.x - positionBefore.x)).toBeLessThan(50);
      expect(Math.abs(positionAfter.y - positionBefore.y)).toBeLessThan(50);
    }
  });

  test("can close a window", async ({ page }) => {
    await spawnNode(page, "Note");
    const initialCount = await countWindows(page, "note");

    const noteWindow = getLatestWindow(page, "note");
    await closeWindow(noteWindow);

    // Wait for window to be removed
    await expect(noteWindow).toBeHidden();

    const newCount = await countWindows(page, "note");
    expect(newCount).toBe(initialCount - 1);
  });

  test("default chat window cannot be closed", async ({ page }) => {
    const chatWindow = getWindow(page, "chat").first();
    await expect(chatWindow).toBeVisible();

    // Try to close - should either not have close button or persist
    const closeButton = chatWindow.getByRole("button", { name: /close/i });
    const hasCloseButton = (await closeButton.count()) > 0;

    if (hasCloseButton) {
      await closeButton.click();
      // Chat should still exist (default window)
      await expect(getWindow(page, "chat")).toBeVisible();
    }
  });
});
