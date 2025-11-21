import { expect, Locator, Page } from "@playwright/test";
import { platformShortcutKey } from "./auth";

export async function openCommandPalette(page: Page) {
  await page.keyboard.press(platformShortcutKey("K"));
  await expect(page.getByRole("dialog")).toBeVisible();
}

export async function spawnNode(page: Page, label: string) {
  await openCommandPalette(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByText(label, { exact: true }).click();
  await expect(dialog).toBeHidden();
}

export function latestNode(page: Page, type: string): Locator {
  return page.locator(`.react-flow__node-${type}`).last();
}

export async function waitForToast(page: Page, message: string) {
  await expect(page.getByRole("status").filter({ hasText: message })).toBeVisible();
}
