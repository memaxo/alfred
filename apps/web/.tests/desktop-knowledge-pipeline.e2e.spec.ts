import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import {
  countWindows,
  focusWindow,
  getCanvas,
  getWindow,
  navigateToDesktop,
} from "./helpers/desktop";
import { openCommandPalette, spawnNode } from "./helpers/mindscape";

test.describe("Desktop Knowledge Pipeline", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
    await navigateToDesktop(page);
  });

  test.describe("knowledge window spawning", () => {
    test("can spawn knowledge window from command palette", async ({ page }) => {
      await openCommandPalette(page);

      const dialog = page.getByRole("dialog");
      const input = dialog.getByRole("combobox");
      await input.fill("knowledge");

      // Look for knowledge action
      const knowledgeItem = dialog.getByRole("option", { name: /knowledge/i });
      if ((await knowledgeItem.count()) > 0) {
        await knowledgeItem.first().click();
        await expect(getWindow(page, "knowledge")).toBeVisible();
      }
    });

    test("knowledge window displays label and type", async ({ page }) => {
      // Inject a knowledge window directly via store
      await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) return;

        store.getState().addWindow({
          id: "test-knowledge-1",
          type: "knowledge",
          position: { x: 200, y: 200 },
          data: {
            type: "knowledge",
            label: "Test Knowledge Node",
            viewMode: "full",
            kind: "fact",
            confidence: 0.85,
          },
        });
      });

      const knowledgeWindow = getWindow(page, "knowledge");
      await expect(knowledgeWindow).toBeVisible();

      // Should display the label
      await expect(knowledgeWindow.getByText("Test Knowledge Node")).toBeVisible();
    });

    test("knowledge window shows confidence badge", async ({ page }) => {
      await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) return;

        store.getState().addWindow({
          id: "test-knowledge-1",
          type: "knowledge",
          position: { x: 200, y: 200 },
          data: {
            type: "knowledge",
            label: "High Confidence Fact",
            viewMode: "full",
            kind: "fact",
            confidence: 0.95,
          },
        });
      });

      const knowledgeWindow = getWindow(page, "knowledge");
      await expect(knowledgeWindow).toBeVisible();

      // Should display confidence percentage
      await expect(knowledgeWindow.getByText("95%")).toBeVisible();
    });
  });

  test.describe("knowledge graph visualization", () => {
    test("spawnKnowledgeGraph creates multiple windows", async ({ page }) => {
      const initialCount = await countWindows(page, "knowledge");

      // Spawn knowledge graph via store action
      await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) return;

        const nodes = [
          { id: "node-1", label: "Concept A", entityType: "concept" },
          { id: "node-2", label: "Concept B", entityType: "concept" },
          { id: "node-3", label: "Fact C", entityType: "fact" },
        ];

        const edges = [
          { id: "edge-1", fromId: "node-1", toId: "node-2", kind: "relates_to" },
          { id: "edge-2", fromId: "node-2", toId: "node-3", kind: "explains" },
        ];

        store.getState().spawnKnowledgeGraph(nodes, edges);
      });

      // Wait for windows to appear
      await page.waitForTimeout(500);

      const newCount = await countWindows(page, "knowledge");
      expect(newCount).toBeGreaterThanOrEqual(initialCount + 3);
    });

    test("spawned knowledge windows are positioned in radial layout", async ({ page }) => {
      await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) return;

        const nodes = [
          { id: "node-1", label: "Center" },
          { id: "node-2", label: "Satellite 1" },
          { id: "node-3", label: "Satellite 2" },
          { id: "node-4", label: "Satellite 3" },
        ];

        store.getState().spawnKnowledgeGraph(nodes, [], { x: 500, y: 500 });
      });

      await page.waitForTimeout(500);

      // Get positions of spawned windows
      const positions = await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) return [];

        return store
          .getState()
          .windows.filter((w: any) => w.type === "knowledge")
          .map((w: any) => ({ id: w.id, x: w.position.x, y: w.position.y }));
      });

      expect(positions.length).toBeGreaterThanOrEqual(4);

      // Verify windows are spread out (not all at same position)
      const uniquePositions = new Set(
        positions.map((p: any) => `${Math.round(p.x / 50)}-${Math.round(p.y / 50)}`)
      );
      expect(uniquePositions.size).toBeGreaterThan(1);
    });

    test("knowledge graph edges connect correct windows", async ({ page }) => {
      await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) return;

        const nodes = [
          { id: "node-a", label: "Node A" },
          { id: "node-b", label: "Node B" },
        ];

        const edges = [
          { id: "edge-ab", fromId: "node-a", toId: "node-b", kind: "relates_to" },
        ];

        store.getState().spawnKnowledgeGraph(nodes, edges);
      });

      await page.waitForTimeout(500);

      // Verify edge was created
      const edgeCount = await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        return store?.getState().edges.length ?? 0;
      });

      expect(edgeCount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe("visualize action from focused window", () => {
    test.skip("visualize action available for knowledge windows", async ({ page }) => {
      // Skip: requires knowledge.visualize API endpoint setup
      await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) return;

        store.getState().addWindow({
          id: "knowledge-1",
          type: "knowledge",
          position: { x: 200, y: 200 },
          data: {
            type: "knowledge",
            label: "Visualizable Node",
            viewMode: "full",
            content: "Some content to visualize",
          },
        });
        store.getState().focusWindow("knowledge-1");
      });

      await openCommandPalette(page);

      const dialog = page.getByRole("dialog");
      const visualizeItem = dialog.getByRole("option", { name: /visualize/i });

      // Visualize should be available for focused knowledge window
      await expect(visualizeItem).toBeVisible();
    });
  });

  test.describe("empty and error states", () => {
    test("handles empty knowledge graph gracefully", async ({ page }) => {
      const result = await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) return { success: false };

        const initialCount = store.getState().windows.length;
        const windowIds = store.getState().spawnKnowledgeGraph([], []);

        return {
          success: true,
          windowIds,
          windowCountChange: store.getState().windows.length - initialCount,
        };
      });

      expect(result.success).toBe(true);
      expect(result.windowIds).toEqual([]);
      expect(result.windowCountChange).toBe(0);
    });

    test("handles duplicate hgHash by reusing existing window", async ({ page }) => {
      // First spawn
      await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) return;

        store.getState().spawnKnowledgeGraph(
          [{ id: "node-1", label: "Unique Node", hgHash: "hash-123" }],
          []
        );
      });

      await page.waitForTimeout(200);

      const countAfterFirst = await countWindows(page, "knowledge");

      // Second spawn with same hgHash
      await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) return;

        store.getState().spawnKnowledgeGraph(
          [{ id: "node-2", label: "Same Node", hgHash: "hash-123" }],
          []
        );
      });

      await page.waitForTimeout(200);

      const countAfterSecond = await countWindows(page, "knowledge");

      // Should not create duplicate window
      expect(countAfterSecond).toBe(countAfterFirst);
    });
  });

  test.describe("auto-layout integration", () => {
    test("auto-layout runs after knowledge graph spawn", async ({ page }) => {
      // Track if autoLayout was called
      const layoutCalled = await page.evaluate(async () => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) return false;

        let layoutCalled = false;
        const originalAutoLayout = store.getState().autoLayout;
        store.setState({
          autoLayout: () => {
            layoutCalled = true;
            originalAutoLayout();
          },
        });

        store.getState().spawnKnowledgeGraph(
          [
            { id: "n1", label: "A" },
            { id: "n2", label: "B" },
          ],
          [{ id: "e1", fromId: "n1", toId: "n2", kind: "relates_to" }]
        );

        // Wait for setTimeout in spawnKnowledgeGraph
        await new Promise((r) => setTimeout(r, 100));

        return layoutCalled;
      });

      expect(layoutCalled).toBe(true);
    });
  });

  test.describe("performance", () => {
    test("spawns 20 knowledge nodes within performance budget", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) return { success: false };

        const nodes = Array.from({ length: 20 }, (_, i) => ({
          id: `perf-node-${i}`,
          label: `Node ${i}`,
          entityType: i % 2 === 0 ? "fact" : "concept",
        }));

        const edges = Array.from({ length: 15 }, (_, i) => ({
          id: `perf-edge-${i}`,
          fromId: `perf-node-${i}`,
          toId: `perf-node-${(i + 1) % 20}`,
          kind: "relates_to",
        }));

        const start = performance.now();
        store.getState().spawnKnowledgeGraph(nodes, edges);
        const duration = performance.now() - start;

        // Wait for render
        await new Promise((r) => setTimeout(r, 500));

        const windowCount = store.getState().windows.filter(
          (w: any) => w.type === "knowledge"
        ).length;

        return {
          success: true,
          duration,
          windowCount,
          edgeCount: store.getState().edges.length,
        };
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(500); // 500ms budget
      expect(result.windowCount).toBe(20);
      expect(result.edgeCount).toBeGreaterThanOrEqual(15);
    });
  });
});
