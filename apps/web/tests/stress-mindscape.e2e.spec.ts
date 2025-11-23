import { test, expect } from "@playwright/test";

test.describe("Mindscape Stress Test", () => {
  test("Spawn Starfield (1000 Nodes)", async ({ page }) => {
    // Use '/' or '/mindscape' depending on your router config
    // assuming '/mindscape' exists, or '/' is the mindscape route
    await page.goto("http://127.0.0.1:3100/mindscape"); 

    // Wait for initialization
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });

    // Manually inject nodes via window store (exposed for debug in dev)
    await page.evaluate(() => {
      const store = (window as any).__MINDSCAPE_STORE__;
      if (!store) throw new Error("Store not found - ensure window.__MINDSCAPE_STORE__ is exposed");
      
      const nodes = [];
      for (let i = 0; i < 1000; i++) {
        nodes.push({
          id: `star-${i}`,
          type: "orb",
          position: {
            x: (Math.random() - 0.5) * 5000,
            y: (Math.random() - 0.5) * 5000,
          },
          data: { label: `Star ${i}` },
        });
      }
      store.getState().setNodes(nodes);
    });

    // Verify nodes exist
    await expect(page.locator(".react-flow__node")).toHaveCount(1000, { timeout: 30000 });
  });
});
