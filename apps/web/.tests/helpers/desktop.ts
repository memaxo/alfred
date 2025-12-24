import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Desktop test helpers for E2E tests.
 */

/**
 * Navigate to the desktop (root route).
 */
export async function navigateToDesktop(page: Page) {
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible();
}

/**
 * Get a window node by type.
 */
export function getWindow(page: Page, type: string): Locator {
  return page.locator(`.react-flow__node-${type}`);
}

/**
 * Get the latest window of a type.
 */
export function getLatestWindow(page: Page, type: string): Locator {
  return page.locator(`.react-flow__node-${type}`).last();
}

/**
 * Get a dock button by window type.
 */
export function getDockButton(page: Page, type: string): Locator {
  return page.locator(`[data-dock-type="${type}"]`);
}

/**
 * Spawn a window from the dock.
 */
export async function spawnFromDock(page: Page, type: string) {
  const button = getDockButton(page, type);
  await expect(button).toBeVisible();
  await button.click();
  // Wait for window to appear
  await expect(getWindow(page, type)).toBeVisible();
}

/**
 * Get the dock panel.
 */
export function getDock(page: Page): Locator {
  return page.locator("[data-testid='desktop-dock']");
}

/**
 * Get the React Flow canvas.
 */
export function getCanvas(page: Page): Locator {
  return page.locator(".react-flow");
}

/**
 * Get the viewport controls.
 */
export function getControls(page: Page): Locator {
  return page.locator(".react-flow__controls");
}

/**
 * Get the minimap.
 */
export function getMinimap(page: Page): Locator {
  return page.locator(".react-flow__minimap");
}

/**
 * Count visible windows of a type.
 */
export function countWindows(page: Page, type: string): Promise<number> {
  return getWindow(page, type).count();
}

/**
 * Close a window by clicking its close/discard button.
 */
export async function closeWindow(window: Locator) {
  // Try close button first
  const closeButton = window.getByRole("button", { name: /close/i });
  if ((await closeButton.count()) > 0) {
    await closeButton.click();
    return;
  }

  // Try discard button (for note windows in edit mode)
  const discardButton = window.getByRole("button", { name: /discard/i });
  if ((await discardButton.count()) > 0) {
    await discardButton.click();
    return;
  }

  // Try clicking the X icon in the header
  const header = window.locator('[class*="header"], [class*="title"]').first();
  const closeIcon = header.locator("img, svg").last();
  if ((await closeIcon.count()) > 0) {
    await closeIcon.click();
  }
}

/**
 * Focus a window by clicking on it.
 */
export async function focusWindow(window: Locator) {
  await window.click();
}

/**
 * Drag a window to a new position.
 */
export async function dragWindow(
  page: Page,
  window: Locator,
  deltaX: number,
  deltaY: number
) {
  const box = await window.boundingBox();
  if (!box) {
    throw new Error("Window not visible");
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + 20; // Drag from title bar area

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
  await page.mouse.up();
}

/**
 * Zoom the canvas.
 */
export async function zoomCanvas(page: Page, delta: number) {
  const canvas = getCanvas(page);
  await canvas.click();
  // Ctrl+scroll to zoom
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, delta);
  await page.keyboard.up("Control");
}

/**
 * Pan the canvas.
 */
export async function panCanvas(page: Page, deltaX: number, deltaY: number) {
  const canvas = getCanvas(page);
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("Canvas not visible");
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
  await page.mouse.up({ button: "middle" });
}

/**
 * Wait for a window to be focused.
 */
export async function waitForWindowFocus(window: Locator) {
  await expect(window).toHaveAttribute("data-focused", "true");
}

/**
 * Check if a window exists.
 */
export async function windowExists(page: Page, type: string): Promise<boolean> {
  const count = await countWindows(page, type);
  return count > 0;
}

/**
 * Get window position.
 */
export async function getWindowPosition(
  window: Locator
): Promise<{ x: number; y: number }> {
  const transform = await window.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return style.transform;
  });

  // Parse transform: translate(Xpx, Ypx)
  const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
  if (match) {
    return {
      x: Number.parseFloat(match[1] ?? "0"),
      y: Number.parseFloat(match[2] ?? "0"),
    };
  }

  return { x: 0, y: 0 };
}
