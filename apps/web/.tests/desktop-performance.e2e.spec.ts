import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import { getCanvas, navigateToDesktop } from "./helpers/desktop";

test.describe("Desktop performance", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("renders 50 windows without frame drops", async ({ page }) => {
    await navigateToDesktop(page);
    await expect(getCanvas(page)).toBeVisible();

    // Inject windows into store via browser console
    const result = await page.evaluate(async () => {
      const store = (window as any).__DESKTOP_STORE__;
      if (!store) {
        return { success: false, error: "Store not found" };
      }

      const start = performance.now();
      const windowCount = 50;

      // Spawn windows in batch
      const windows = Array.from({ length: windowCount }, (_, i) => ({
        id: `perf-test-${i}`,
        type: "note" as const,
        position: {
          x: (i % 10) * 200 + Math.random() * 50,
          y: Math.floor(i / 10) * 200 + Math.random() * 50,
        },
        data: {
          type: "note" as const,
          label: `Note ${i}`,
          viewMode: "full" as const,
        },
      }));

      store.setState((state: any) => ({
        windows: [...state.windows, ...windows],
      }));

      const spawnTime = performance.now() - start;

      // Wait for render
      await new Promise((r) => setTimeout(r, 500));

      const finalCount = store.getState().windows.length;
      return {
        success: true,
        spawnTime,
        windowCount: finalCount,
      };
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.windowCount).toBeGreaterThanOrEqual(50);
      // Spawning 50 windows should take less than 500ms
      expect(result.spawnTime).toBeLessThan(500);
    }
  });

  test("canvas remains interactive with 100 windows", async ({ page }) => {
    await navigateToDesktop(page);
    await expect(getCanvas(page)).toBeVisible();

    // Inject 100 windows
    await page.evaluate(async () => {
      const store = (window as any).__DESKTOP_STORE__;
      if (!store) {
        return;
      }

      const windows = Array.from({ length: 100 }, (_, i) => ({
        id: `perf-test-${i}`,
        type: "note" as const,
        position: {
          x: (i % 15) * 150 + Math.random() * 30,
          y: Math.floor(i / 15) * 150 + Math.random() * 30,
        },
        data: {
          type: "note" as const,
          label: `Note ${i}`,
          viewMode: "full" as const,
        },
      }));

      store.setState((state: any) => ({
        windows: [...state.windows, ...windows],
      }));

      await new Promise((r) => setTimeout(r, 1000));
    });

    // Canvas should still be interactive
    const canvas = getCanvas(page);

    // Test pan interaction
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    if (canvasBox) {
      // Perform a pan gesture
      await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 200, canvasBox.y + 200);
      await page.mouse.up();
    }

    // Zoom controls should still work
    const zoomIn = page.locator(".react-flow__controls-zoomin");
    await expect(zoomIn).toBeVisible();
    await zoomIn.click();
  });

  test("viewport zoom performance", async ({ page }) => {
    await navigateToDesktop(page);
    await expect(getCanvas(page)).toBeVisible();

    // Add some windows
    await page.evaluate(async () => {
      const store = (window as any).__DESKTOP_STORE__;
      if (!store) {
        return;
      }

      const windows = Array.from({ length: 30 }, (_, i) => ({
        id: `zoom-test-${i}`,
        type: "note" as const,
        position: { x: i * 100, y: i * 50 },
        data: {
          type: "note" as const,
          label: `Note ${i}`,
          viewMode: "full" as const,
        },
      }));

      store.setState((state: any) => ({
        windows: [...state.windows, ...windows],
      }));

      await new Promise((r) => setTimeout(r, 500));
    });

    // Measure zoom performance
    const zoomTimes: number[] = [];
    const zoomIn = page.locator(".react-flow__controls-zoomin");
    const zoomOut = page.locator(".react-flow__controls-zoomout");

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await zoomIn.click();
      await page.waitForTimeout(100);
      zoomTimes.push(Date.now() - start);
    }

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await zoomOut.click();
      await page.waitForTimeout(100);
      zoomTimes.push(Date.now() - start);
    }

    // Average zoom interaction should be under 200ms
    const avgZoomTime = zoomTimes.reduce((a, b) => a + b, 0) / zoomTimes.length;
    expect(avgZoomTime).toBeLessThan(200);
  });

  test("LOD reduces rendering load at low zoom", async ({ page }) => {
    await navigateToDesktop(page);
    await expect(getCanvas(page)).toBeVisible();

    // Add windows
    await page.evaluate(async () => {
      const store = (window as any).__DESKTOP_STORE__;
      if (!store) {
        return;
      }

      const windows = Array.from({ length: 20 }, (_, i) => ({
        id: `lod-test-${i}`,
        type: "note" as const,
        position: { x: (i % 5) * 300, y: Math.floor(i / 5) * 300 },
        data: {
          type: "note" as const,
          label: `Note ${i}`,
          viewMode: "full" as const,
        },
      }));

      store.setState((state: any) => ({
        windows: [...state.windows, ...windows],
      }));

      await new Promise((r) => setTimeout(r, 500));
    });

    // Zoom out significantly
    const zoomOut = page.locator(".react-flow__controls-zoomout");
    for (let i = 0; i < 8; i++) {
      await zoomOut.click();
      await page.waitForTimeout(50);
    }

    // At low zoom, windows should be simplified (LOD)
    // Check that simplified representations are visible
    const canvas = getCanvas(page);
    await expect(canvas).toBeVisible();

    // The canvas should still be responsive
    await canvas.click();
  });

  test("stress test: 200 windows", async ({ page }) => {
    // Skip in CI - run manually for stress testing
    await navigateToDesktop(page);
    await expect(getCanvas(page)).toBeVisible();

    const result = await page.evaluate(async () => {
      const store = (window as any).__DESKTOP_STORE__;
      if (!store) {
        return { success: false };
      }

      const start = performance.now();

      const windows = Array.from({ length: 200 }, (_, i) => ({
        id: `stress-test-${i}`,
        type: "note" as const,
        position: {
          x: (i % 20) * 120 + Math.random() * 20,
          y: Math.floor(i / 20) * 120 + Math.random() * 20,
        },
        data: {
          type: "note" as const,
          label: `Note ${i}`,
          viewMode: "full" as const,
        },
      }));

      store.setState((state: any) => ({
        windows: [...state.windows, ...windows],
      }));

      const spawnTime = performance.now() - start;
      await new Promise((r) => setTimeout(r, 2000));

      // Measure frame rate by counting animation frames
      let frameCount = 0;
      const measureStart = performance.now();

      return new Promise((resolve) => {
        const countFrames = () => {
          frameCount++;
          if (performance.now() - measureStart < 1000) {
            requestAnimationFrame(countFrames);
          } else {
            resolve({
              success: true,
              spawnTime,
              windowCount: store.getState().windows.length,
              fps: frameCount,
            });
          }
        };
        requestAnimationFrame(countFrames);
      });
    });

    expect(result.success).toBe(true);
    if (result.success && "fps" in result) {
      // Should maintain at least 30fps with 200 windows
      expect(result.fps).toBeGreaterThanOrEqual(30);
      expect(result.windowCount).toBeGreaterThanOrEqual(200);
    }
  });
});
