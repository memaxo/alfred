import { expect, test } from "./helpers/ai-harness";
import { signUpTestUser } from "./helpers/auth";

test.describe("Mindscape Stress Test", () => {
  test("Spawn Starfield (1000 Nodes)", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    await safeAction(
      "signup-test-user",
      async () => {
        await signUpTestUser(page);
      },
      60_000
    );
    await screenshots.captureMilestone("authenticated");

    await safeAction(
      "goto-mindscape",
      async () => {
        await page.goto("/mindscape");
      },
      20_000
    );
    await screenshots.captureMilestone("mindscape");

    // Wait for initialization
    await safeAssert("react-flow-visible", async () => {
      await expect(page.locator(".react-flow")).toBeVisible({
        timeout: 30_000,
      });
    });

    // Manually inject nodes via window store (exposed for debug in dev)
    await safeAction(
      "inject-1000-nodes",
      async () => {
        await page.evaluate(() => {
          const store = (window as any).__MINDSCAPE_STORE__;
          if (!store) {
            throw new Error(
              "Store not found - ensure window.__MINDSCAPE_STORE__ is exposed"
            );
          }

          const nodes: Array<{
            id: string;
            type: string;
            position: { x: number; y: number };
            data: { label: string };
          }> = [];
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
      },
      30_000
    );
    await screenshots.captureMilestone("nodes-injected");

    // Verify nodes exist
    await safeAssert("nodes-rendered", async () => {
      await expect(page.locator(".react-flow__node")).toHaveCount(1000, {
        timeout: 30_000,
      });
    });
    await screenshots.captureMilestone("completed");
  });
});
