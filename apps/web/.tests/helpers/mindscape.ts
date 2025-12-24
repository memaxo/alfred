import { expect, type Locator, type Page } from "@playwright/test";

export async function openCommandPalette(page: Page) {
  const dialog = page.getByRole("dialog");
  // Meta key shortcuts can be flaky in Playwright on macOS (some browsers reserve Cmd+K),
  // but the app listens to either ctrlKey or metaKey. Try Ctrl first, then Meta as fallback.
  await page.keyboard.press("Control+K");
  try {
    await dialog.waitFor({ state: "visible", timeout: 1000 });
    return;
  } catch (_error) {
    // continue
  }
  await page.keyboard.press("Meta+K");
  try {
    await dialog.waitFor({ state: "visible", timeout: 1000 });
    return;
  } catch (_error) {
    // continue
  }

  // Last resort: dispatch the exact event the palette listens to.
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true })
    );
  });
  await expect(dialog).toBeVisible();
}

export async function spawnNode(page: Page, label: string) {
  await openCommandPalette(page);
  const dialog = page.getByRole("dialog");
  // Click the command item matching the label
  const item = dialog.locator("[cmdk-item]").filter({ hasText: label }).first();
  await item.click();
  await expect(dialog).toBeHidden();
}

export function latestNode(page: Page, type: string): Locator {
  return page.locator(`.react-flow__node-${type}`).last();
}

export async function waitForToast(page: Page, message: string) {
  await expect(
    page.getByRole("status").filter({ hasText: message })
  ).toBeVisible();
}
