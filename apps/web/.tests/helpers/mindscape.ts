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
  // Try sidebar spawn button first (most reliable)
  const sidebarButton = page.getByRole("button", { name: `+ ${label}` });
  if ((await sidebarButton.count()) > 0 && (await sidebarButton.isVisible())) {
    await sidebarButton.click();
    await page.waitForTimeout(500);
    return;
  }

  // Fall back to command palette
  await openCommandPalette(page);
  const dialog = page.getByRole("dialog");

  // Type the label to filter
  const input = dialog.getByRole("textbox");
  await input.fill(label);
  await page.waitForTimeout(300);

  // Click the first filtered result using aria-selected or data attribute
  const selectedItem = dialog
    .locator('[aria-selected="true"], [data-selected="true"]')
    .first();
  if ((await selectedItem.count()) > 0) {
    await selectedItem.click();
  } else {
    // Fallback: press ArrowDown then Enter
    await input.press("ArrowDown");
    await input.press("Enter");
  }
  await expect(dialog).toBeHidden({ timeout: 5000 });
}

export function latestNode(page: Page, type: string): Locator {
  return page.locator(`.react-flow__node-${type}`).last();
}

export async function waitForToast(page: Page, message: string) {
  await expect(
    page.getByRole("status").filter({ hasText: message })
  ).toBeVisible();
}
