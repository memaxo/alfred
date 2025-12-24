import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import { countWindows, getWindow } from "./helpers/desktop";
import { openCommandPalette, spawnNode } from "./helpers/mindscape";

test.describe("Desktop dock integration", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("command palette opens with Ctrl+K", async ({ page }) => {
    await openCommandPalette(page);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
  });

  test("spawning via command palette creates window", async ({ page }) => {
    const initialCount = await countWindows(page, "note");

    await spawnNode(page, "Note");

    const newCount = await countWindows(page, "note");
    expect(newCount).toBe(initialCount + 1);
  });

  test("can spawn different window types", async ({ page }) => {
    // Spawn note
    await spawnNode(page, "Note");
    await expect(getWindow(page, "note")).toBeVisible();

    // Spawn reminder
    await spawnNode(page, "Reminder");
    await expect(getWindow(page, "reminder")).toBeVisible();
  });

  test("singleton windows focus instead of spawning duplicates", async ({
    page,
  }) => {
    // Chat is a singleton - should already exist
    const initialChatCount = await countWindows(page, "chat");
    expect(initialChatCount).toBeGreaterThanOrEqual(1);

    // Try to spawn another chat via command palette
    await spawnNode(page, "Chat");

    // Should still have same number of chat windows (singleton)
    const newChatCount = await countWindows(page, "chat");
    expect(newChatCount).toBe(initialChatCount);
  });

  test("spawned windows appear in viewport", async ({ page }) => {
    await spawnNode(page, "Note");

    const noteWindow = getWindow(page, "note").last();
    const box = await noteWindow.boundingBox();

    // Window should be within viewport
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x).toBeLessThan(1440); // viewport width
      expect(box.y).toBeLessThan(900); // viewport height
    }
  });

  test("multiple spawns offset windows to avoid overlap", async ({ page }) => {
    await spawnNode(page, "Note");
    const firstWindow = getWindow(page, "note").last();
    const firstBox = await firstWindow.boundingBox();

    await spawnNode(page, "Note");
    const secondWindow = getWindow(page, "note").last();
    const secondBox = await secondWindow.boundingBox();

    // Windows should not be at exact same position
    if (firstBox && secondBox) {
      const samePosition =
        Math.abs(firstBox.x - secondBox.x) < 5 &&
        Math.abs(firstBox.y - secondBox.y) < 5;
      expect(samePosition).toBe(false);
    }
  });
});
