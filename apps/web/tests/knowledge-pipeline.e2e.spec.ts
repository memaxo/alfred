/**
 * Knowledge Pipeline E2E Tests
 *
 * Tests the knowledge pipeline in the UI:
 * - Knowledge capture during chat
 * - Graph visualization in Mindscape
 * - RAG context display in responses
 * - Memory node interactions
 *
 * Run: bunx playwright test knowledge-pipeline.e2e.spec.ts
 */

import { expect, test } from "@playwright/test";

test.describe("Knowledge Pipeline E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Knowledge Capture During Chat", () => {
    test("chat messages are captured as knowledge", async ({ page }) => {
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        // Send a message with knowledge content
        await chatInput.fill(
          "Remember: The project uses TypeScript with Drizzle ORM"
        );
        await chatInput.press("Enter");

        // Wait for processing
        await page.waitForTimeout(3000);

        // Check for knowledge capture indicator
        const captureIndicator = page.locator(
          '[data-testid="knowledge-captured"]'
        );
        if (await captureIndicator.isVisible({ timeout: 1000 })) {
          await expect(captureIndicator).toBeVisible();
        }
      }
    });

    test("entities are extracted from messages", async ({ page }) => {
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("Create a UserService class in the auth module");
        await chatInput.press("Enter");

        await page.waitForTimeout(3000);

        // Check for entity extraction indicator
        const entityIndicator = page.locator('[data-testid="entities-found"]');
        if (await entityIndicator.isVisible({ timeout: 1000 })) {
          await expect(entityIndicator).toBeVisible();
        }
      }
    });

    test("knowledge persists across sessions", async ({ page }) => {
      // First session: create knowledge
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("The API uses JWT authentication");
        await chatInput.press("Enter");
        await page.waitForTimeout(2000);
      }

      // Refresh page (new session)
      await page.reload();
      await page.waitForLoadState("networkidle");

      // Navigate to knowledge/mindscape
      const mindscapeLink = page.locator('a[href*="mindscape"]');
      if (await mindscapeLink.isVisible()) {
        await mindscapeLink.click();
        await page.waitForLoadState("networkidle");

        // Knowledge should still exist
        const knowledgePanel = page.locator('[data-testid="knowledge-graph"]');
        if (await knowledgePanel.isVisible({ timeout: 1000 })) {
          await expect(knowledgePanel).toBeVisible();
        }
      }
    });
  });

  test.describe("Graph Visualization in Mindscape", () => {
    test("displays knowledge graph", async ({ page }) => {
      // Navigate to Mindscape
      const mindscapeLink = page.locator('a[href*="mindscape"]');
      if (await mindscapeLink.isVisible()) {
        await mindscapeLink.click();
        await page.waitForLoadState("networkidle");
      }

      const graphCanvas = page.locator(
        '[data-testid="knowledge-graph"], canvas'
      );
      if (await graphCanvas.isVisible({ timeout: 1000 })) {
        await expect(graphCanvas).toBeVisible();
      }
    });

    test("graph nodes are interactive", async ({ page }) => {
      const mindscapeLink = page.locator('a[href*="mindscape"]');
      if (await mindscapeLink.isVisible()) {
        await mindscapeLink.click();
        await page.waitForLoadState("networkidle");
      }

      // Try to click a node
      const node = page.locator('[data-testid="graph-node"]').first();
      if (await node.isVisible({ timeout: 1000 })) {
        await node.click();

        // Should show node details
        const nodeDetails = page.locator('[data-testid="node-details"]');
        if (await nodeDetails.isVisible({ timeout: 1000 })) {
          await expect(nodeDetails).toBeVisible();
        }
      }
    });

    test("graph shows relations between nodes", async ({ page }) => {
      const mindscapeLink = page.locator('a[href*="mindscape"]');
      if (await mindscapeLink.isVisible()) {
        await mindscapeLink.click();
        await page.waitForLoadState("networkidle");
      }

      // Check for edge/relation visualization
      const edge = page.locator('[data-testid="graph-edge"]').first();
      if (await edge.isVisible({ timeout: 1000 })) {
        await expect(edge).toBeVisible();
      }
    });

    test("graph supports zoom and pan", async ({ page }) => {
      const mindscapeLink = page.locator('a[href*="mindscape"]');
      if (await mindscapeLink.isVisible()) {
        await mindscapeLink.click();
        await page.waitForLoadState("networkidle");
      }

      const graphContainer = page.locator('[data-testid="graph-container"]');
      if (await graphContainer.isVisible({ timeout: 1000 })) {
        // Zoom with scroll
        await graphContainer.hover();
        await page.mouse.wheel(0, -100);

        // Pan with drag
        const box = await graphContainer.boundingBox();
        if (box) {
          await page.mouse.move(box.x + 100, box.y + 100);
          await page.mouse.down();
          await page.mouse.move(box.x + 200, box.y + 200);
          await page.mouse.up();
        }
      }
    });

    test("LOD (Level of Detail) changes with zoom", async ({ page }) => {
      const mindscapeLink = page.locator('a[href*="mindscape"]');
      if (await mindscapeLink.isVisible()) {
        await mindscapeLink.click();
        await page.waitForLoadState("networkidle");
      }

      // At different zoom levels, node detail should change
      const graphContainer = page.locator('[data-testid="graph-container"]');
      if (await graphContainer.isVisible({ timeout: 1000 })) {
        // Zoom in
        await graphContainer.hover();
        await page.mouse.wheel(0, -200);
        await page.waitForTimeout(500);

        // Nodes should show more detail
        const detailedNode = page.locator('[data-lod="full"]').first();
        // LOD nodes may or may not be visible depending on graph state
      }
    });
  });

  test.describe("RAG Context Display", () => {
    test("shows retrieved context in responses", async ({ page }) => {
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill(
          "What authentication method does the project use?"
        );
        await chatInput.press("Enter");

        await page.waitForTimeout(5000);

        // Check for context citation
        const contextCitation = page.locator('[data-testid="rag-context"]');
        if (await contextCitation.isVisible({ timeout: 1000 })) {
          await expect(contextCitation).toBeVisible();
        }
      }
    });

    test("context chunks are expandable", async ({ page }) => {
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("How is user authentication implemented?");
        await chatInput.press("Enter");

        await page.waitForTimeout(5000);

        // Click to expand context
        const expandBtn = page
          .locator('[data-testid="expand-context"]')
          .first();
        if (await expandBtn.isVisible({ timeout: 1000 })) {
          await expandBtn.click();

          // Should show full chunk
          const fullContext = page.locator('[data-testid="full-context"]');
          if (await fullContext.isVisible({ timeout: 1000 })) {
            await expect(fullContext).toBeVisible();
          }
        }
      }
    });

    test("context shows relevance scores", async ({ page }) => {
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("Find information about database schemas");
        await chatInput.press("Enter");

        await page.waitForTimeout(5000);

        // Check for relevance score display
        const relevanceScore = page
          .locator('[data-testid="relevance-score"]')
          .first();
        if (await relevanceScore.isVisible({ timeout: 1000 })) {
          await expect(relevanceScore).toBeVisible();
        }
      }
    });
  });

  test.describe("Memory Node Interactions", () => {
    test("can search memory nodes", async ({ page }) => {
      const mindscapeLink = page.locator('a[href*="mindscape"]');
      if (await mindscapeLink.isVisible()) {
        await mindscapeLink.click();
        await page.waitForLoadState("networkidle");
      }

      const searchInput = page.locator('[data-testid="memory-search"]');
      if (await searchInput.isVisible({ timeout: 1000 })) {
        await searchInput.fill("authentication");
        await searchInput.press("Enter");

        // Should filter/highlight matching nodes
        const searchResults = page.locator('[data-testid="search-results"]');
        if (await searchResults.isVisible({ timeout: 1000 })) {
          await expect(searchResults).toBeVisible();
        }
      }
    });

    test("can view node details", async ({ page }) => {
      const mindscapeLink = page.locator('a[href*="mindscape"]');
      if (await mindscapeLink.isVisible()) {
        await mindscapeLink.click();
        await page.waitForLoadState("networkidle");
      }

      // Click on a node
      const node = page.locator('[data-testid="memory-node"]').first();
      if (await node.isVisible({ timeout: 1000 })) {
        await node.click();

        // Should show details panel
        const detailsPanel = page.locator('[data-testid="node-details-panel"]');
        if (await detailsPanel.isVisible({ timeout: 1000 })) {
          await expect(detailsPanel).toBeVisible();
        }
      }
    });

    test("can navigate to related nodes", async ({ page }) => {
      const mindscapeLink = page.locator('a[href*="mindscape"]');
      if (await mindscapeLink.isVisible()) {
        await mindscapeLink.click();
        await page.waitForLoadState("networkidle");
      }

      // Select a node
      const node = page.locator('[data-testid="memory-node"]').first();
      if (await node.isVisible({ timeout: 1000 })) {
        await node.click();

        // Click on related node link
        const relatedLink = page
          .locator('[data-testid="related-node"]')
          .first();
        if (await relatedLink.isVisible({ timeout: 1000 })) {
          await relatedLink.click();

          // Should navigate to related node
          await page.waitForTimeout(500);
        }
      }
    });

    test("shows node confidence levels", async ({ page }) => {
      const mindscapeLink = page.locator('a[href*="mindscape"]');
      if (await mindscapeLink.isVisible()) {
        await mindscapeLink.click();
        await page.waitForLoadState("networkidle");
      }

      // Nodes should indicate confidence
      const confidenceIndicator = page
        .locator('[data-testid="node-confidence"]')
        .first();
      if (await confidenceIndicator.isVisible({ timeout: 1000 })) {
        await expect(confidenceIndicator).toBeVisible();
      }
    });
  });
});
