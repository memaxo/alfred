import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import {
  countWindows,
  getCanvas,
  getWindow,
  navigateToDesktop,
} from "./helpers/desktop";

test.describe("Desktop command palette", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
    await navigateToDesktop(page);
  });

  test("opens with Cmd+K / Ctrl+K", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
  });

  test("closes with Escape", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("shows spawn actions", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Should show create group with spawn actions
    const createGroup = dialog.getByRole("group", { name: /create/i });
    await expect(createGroup).toBeVisible();
  });

  test("can search for actions", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.getByRole("dialog");

    const input = dialog.getByRole("combobox");
    await input.fill("note");

    // Note action should be visible
    const noteItem = dialog.getByRole("option", { name: /note/i });
    await expect(noteItem).toBeVisible();
  });

  test("typing filters actions", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.getByRole("dialog");

    const input = dialog.getByRole("combobox");
    await input.fill("xyz_nonexistent");

    // Should show no results
    const noResults = dialog.getByText(/no results/i);
    await expect(noResults).toBeVisible();
  });

  test("clicking action spawns window", async ({ page }) => {
    const initialCount = await countWindows(page, "note");

    await page.keyboard.press("Meta+k");
    const dialog = page.getByRole("dialog");

    const input = dialog.getByRole("combobox");
    await input.fill("note");

    const noteItem = dialog.getByRole("option", { name: /note/i }).first();
    await noteItem.click();

    // Dialog should close
    await expect(dialog).toBeHidden();

    // Note window should be created
    const newCount = await countWindows(page, "note");
    expect(newCount).toBe(initialCount + 1);
  });

  test("palette shows context actions when window focused", async ({ page }) => {
    // First spawn a note
    await page.keyboard.press("Meta+k");
    let dialog = page.getByRole("dialog");
    const input = dialog.getByRole("combobox");
    await input.fill("note");
    await dialog.getByRole("option", { name: /note/i }).first().click();

    // Wait for window
    await expect(getWindow(page, "note")).toBeVisible();

    // Focus the note window
    await getWindow(page, "note").click();

    // Open command palette again
    await page.keyboard.press("Meta+k");
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Should show context actions for the focused window
    // Look for "Actions for" group
    const actionsGroup = dialog.locator("text=/Actions for/i");
    await expect(actionsGroup).toBeVisible();
  });

  test("reopening palette preserves no search state", async ({ page }) => {
    // Open and type
    await page.keyboard.press("Meta+k");
    let dialog = page.getByRole("dialog");
    let input = dialog.getByRole("combobox");
    await input.fill("test search");

    // Close
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Reopen - should be cleared
    await page.keyboard.press("Meta+k");
    dialog = page.getByRole("dialog");
    input = dialog.getByRole("combobox");

    // Search should be empty
    await expect(input).toHaveValue("");
  });
});
