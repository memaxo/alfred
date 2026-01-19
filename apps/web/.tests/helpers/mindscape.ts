import { expect, type Locator, type Page } from "@playwright/test";

export async function openCommandPalette(page: Page): Promise<Locator> {
  const dialog = page.getByRole("dialog", { name: /search/i });

  // Ensure the page has focus for key events.
  await page.mouse.click(10, 10);

  // Retry briefly to avoid racing React hydration/effects.
  for (let i = 0; i < 25; i += 1) {
    // Meta key shortcuts can be flaky in Playwright on macOS (some browsers reserve Cmd+K),
    // but the app listens to either ctrlKey or metaKey. Try Ctrl first, then Meta as fallback.
    await page.keyboard.press("Control+K");
    if (await dialog.isVisible()) {
      return dialog;
    }

    await page.keyboard.press("Meta+K");
    if (await dialog.isVisible()) {
      return dialog;
    }

    // Last resort: dispatch the exact event the palette listens to.
    await page.evaluate(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
      );
    });
    if (await dialog.isVisible()) {
      return dialog;
    }

    await page.waitForTimeout(100);
  }

  await expect(dialog).toBeVisible();
  return dialog;
}

export async function openSettingsWindow(page: Page): Promise<Locator> {
  const spawnedWindowId = await page.evaluate(() => {
    const w = globalThis as unknown as {
      __DESKTOP_STORE__?: {
        getState: () => { spawnWindow: (type: string) => string };
      };
    };
    const store = w.__DESKTOP_STORE__;
    if (!store) {
      return null;
    }
    return store.getState().spawnWindow("settings");
  });

  if (spawnedWindowId) {
    await page.waitForTimeout(150);
  } else {
    // Fallback: open via app launcher (UI path).
    const launcherButton = page.getByRole("button", { name: "App Launcher" });
    await launcherButton.click();

    const search = page.getByPlaceholder("Search applications...");
    const popover = page
      .locator('[data-slot="popover-content"]')
      .filter({ has: search })
      .first();

    await expect(popover).toBeVisible({ timeout: 10_000 });
    await popover.getByRole("button", { name: "Settings" }).click();
    await expect(popover).toBeHidden({ timeout: 10_000 });
  }

  const settingsWindow = spawnedWindowId
    ? page.locator(`[role="dialog"][data-window-id="${spawnedWindowId}"]`)
    : page.getByRole("dialog", { name: /settings/i }).last();
  await expect(settingsWindow).toBeVisible({ timeout: 10_000 });
  return settingsWindow;
}

export async function spawnNode(page: Page, label: string) {
  // Try sidebar spawn button first (most reliable)
  const sidebarButton = page.getByRole("button", { name: `+ ${label}` });
  if ((await sidebarButton.count()) > 0 && (await sidebarButton.isVisible())) {
    await sidebarButton.click();
    await page.waitForTimeout(500);
    return;
  }

  // If the command palette is flaky (browser reserves Ctrl+K), fall back to the
  // desktop store in tests. This still exercises the full window + workflow UX.
  const spawnedViaStore = await page.evaluate((rawLabel) => {
    const w = globalThis as unknown as {
      __DESKTOP_STORE__?: {
        getState: () => { spawnWindow: (type: string) => string };
      };
    };
    const store = w.__DESKTOP_STORE__;
    if (!store) {
      return false;
    }

    const labelLower = rawLabel.toLowerCase();
    if (labelLower.includes("workflow")) {
      store.getState().spawnWindow("workflow");
      return true;
    }
    if (labelLower.includes("settings")) {
      store.getState().spawnWindow("settings");
      return true;
    }
    return false;
  }, label);
  if (spawnedViaStore) {
    await page.waitForTimeout(300);
    return;
  }

  // Fall back to command palette
  const dialog = await openCommandPalette(page);

  // Type the label to filter
  const input = dialog.getByRole("textbox");
  await input.fill(label);
  await page.waitForTimeout(300);

  await input.press("Enter");

  // Close animation can be slightly slow in CI.
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

export function latestNode(page: Page, type: string): Locator {
  return page.locator(`.react-flow__node-${type}`).last();
}

export async function waitForToast(page: Page, message: string) {
  await expect(
    page.getByRole("status").filter({ hasText: message })
  ).toBeVisible();
}
