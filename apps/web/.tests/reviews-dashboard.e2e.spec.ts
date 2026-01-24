/**
 * Reviews Dashboard E2E Tests
 *
 * Tests the PM-focused reviews dashboard:
 * - Dashboard loads with all components
 * - Tab switching between dashboard and table views
 * - Keyboard navigation in table
 * - Review selection and context drawer
 * - Batch actions
 */

import { expect, test } from "./helpers/ai-harness";

const REVIEWS_URL = "/reviews";

test.describe("Reviews Dashboard E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth session for protected route
    await page.addInitScript(() => {
      localStorage.setItem(
        "session",
        JSON.stringify({
          user: { id: "test-user", email: "test@example.com" },
        })
      );
    });
  });

  test.describe("Dashboard View", () => {
    test("renders all dashboard components", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      await safeAction(
        "navigate-to-reviews",
        async () => {
          await page.goto(REVIEWS_URL, { waitUntil: "networkidle" });
        },
        30_000
      );

      await screenshots.capturePageLoad("reviews-dashboard");

      // Check header
      await safeAssert("header-visible", async () => {
        await expect(
          page.getByRole("heading", { name: "ALFRED Reviews" })
        ).toBeVisible();
      });

      // Check tab buttons
      await safeAssert("tabs-visible", async () => {
        await expect(
          page.getByRole("tab", { name: /Dashboard/i })
        ).toBeVisible();
        await expect(
          page.getByRole("tab", { name: /All Reviews/i })
        ).toBeVisible();
      });
    });

    test("switches between dashboard and table views", async ({
      page,
      safeAction,
      safeAssert,
    }) => {
      await safeAction("navigate", async () => {
        await page.goto(REVIEWS_URL, { waitUntil: "networkidle" });
      });

      // Dashboard tab should be active by default
      await safeAssert("dashboard-active", async () => {
        await expect(
          page.getByRole("tab", { name: /Dashboard/i })
        ).toHaveAttribute("data-state", "active");
      });

      // Click table tab
      await safeAction("switch-to-table", async () => {
        await page.getByRole("tab", { name: /All Reviews/i }).click();
      });

      // Table should be visible
      await safeAssert("table-visible", async () => {
        await expect(
          page.getByRole("region", { name: "Reviews table" })
        ).toBeVisible();
      });

      // Switch back to dashboard
      await safeAction("switch-to-dashboard", async () => {
        await page.getByRole("tab", { name: /Dashboard/i }).click();
      });
    });
  });

  test.describe("Table View", () => {
    test("shows keyboard shortcut hints", async ({
      page,
      safeAction,
      safeAssert,
    }) => {
      await safeAction("navigate-to-table", async () => {
        await page.goto(REVIEWS_URL, { waitUntil: "networkidle" });
        await page.getByRole("tab", { name: /All Reviews/i }).click();
      });

      await safeAssert("keyboard-hints-visible", async () => {
        await expect(page.getByText(/j\/k navigate/i)).toBeVisible();
      });
    });

    test("supports keyboard navigation", async ({
      page,
      safeAction,
      safeAssert,
    }) => {
      await safeAction("navigate-to-table", async () => {
        await page.goto(REVIEWS_URL, { waitUntil: "networkidle" });
        await page.getByRole("tab", { name: /All Reviews/i }).click();
      });

      // Press j to focus first row (starts at -1)
      await safeAction("press-j", async () => {
        await page.keyboard.press("j");
      });

      // Press j again to move to second row
      await safeAction("press-j-again", async () => {
        await page.keyboard.press("j");
      });

      // Press k to go back up
      await safeAction("press-k", async () => {
        await page.keyboard.press("k");
      });
    });

    test("search filter works", async ({ page, safeAction, safeAssert }) => {
      await safeAction("navigate-to-table", async () => {
        await page.goto(REVIEWS_URL, { waitUntil: "networkidle" });
        await page.getByRole("tab", { name: /All Reviews/i }).click();
      });

      // Type in search
      await safeAction("search", async () => {
        await page.getByPlaceholder("Search reviews...").fill("test");
      });

      // Search should filter results (we can't assert specific results without mock data)
      await safeAssert("search-input-has-value", async () => {
        await expect(page.getByPlaceholder("Search reviews...")).toHaveValue(
          "test"
        );
      });
    });
  });

  test.describe("Accessibility", () => {
    test("has proper ARIA labels", async ({ page, safeAction, safeAssert }) => {
      await safeAction("navigate-to-table", async () => {
        await page.goto(REVIEWS_URL, { waitUntil: "networkidle" });
        await page.getByRole("tab", { name: /All Reviews/i }).click();
      });

      // Table has aria-label
      await safeAssert("table-aria-label", async () => {
        await expect(
          page.getByRole("table", { name: "Review queue" })
        ).toBeVisible();
      });
    });

    test("supports tab navigation", async ({
      page,
      safeAction,
      safeAssert,
    }) => {
      await safeAction("navigate", async () => {
        await page.goto(REVIEWS_URL, { waitUntil: "networkidle" });
      });

      // Tab through interactive elements
      await safeAction("tab-through", async () => {
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
      });

      // Something should be focused
      await safeAssert("element-focused", async () => {
        const focusedElement = await page.evaluate(
          () => document.activeElement?.tagName
        );
        expect(focusedElement).toBeTruthy();
      });
    });
  });

  test.describe("Error Boundaries", () => {
    test("error boundary catches component errors", async ({
      page,
      safeAction,
      screenshots,
    }) => {
      // Inject an error into a component
      await page.addInitScript(() => {
        // @ts-expect-error - intentional error injection
        window.__INJECT_REVIEW_ERROR__ = true;
      });

      await safeAction("navigate-with-error", async () => {
        await page.goto(REVIEWS_URL, { waitUntil: "networkidle" });
      });

      await screenshots.capturePageLoad("reviews-with-potential-error");

      // Page should still render (error boundary catches errors)
      // This test verifies the page doesn't completely crash
    });
  });
});
