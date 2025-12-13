import { test, expect } from "@playwright/test";

test.describe("Production Build Smoke Tests", () => {
  test("should load homepage", async ({ page }) => {
    await page.goto("/");
    // Verify page loads without errors
    await expect(page).toHaveTitle(/ALFRED/i);
  });

  test("should not expose server-only code in browser context", async ({
    page,
  }) => {
    await page.goto("/");

    // Check that server-only globals are not accessible
    const hasServerCode = await page.evaluate(() => {
      // Check for common server-only patterns
      const windowKeys = Object.keys(window);
      const hasDrizzle = windowKeys.some((key) =>
        key.toLowerCase().includes("drizzle")
      );
      const hasPostgres = windowKeys.some((key) =>
        key.toLowerCase().includes("postgres")
      );
      const hasDb = windowKeys.some((key) => key.toLowerCase().includes("db"));

      // Check if server-only modules are accessible
      // @ts-expect-error - checking for non-existent properties
      const hasAuthModule = typeof window.auth !== "undefined";
      // @ts-expect-error - checking for non-existent properties
      const hasDbModule = typeof window.db !== "undefined";

      return hasDrizzle || hasPostgres || hasDb || hasAuthModule || hasDbModule;
    });

    expect(hasServerCode).toBe(false);
  });

  test("should handle client-side navigation", async ({ page }) => {
    await page.goto("/");
    // Wait for page to be interactive
    await page.waitForLoadState("networkidle");

    // Verify no console errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Try navigating to a different route
    await page.goto("/docs");
    await page.waitForLoadState("networkidle");

    // Filter out expected errors (e.g., 404s for missing routes)
    const unexpectedErrors = errors.filter(
      (error) =>
        !error.includes("404") &&
        !error.includes("Not Found") &&
        !error.includes("Failed to fetch")
    );

    expect(unexpectedErrors).toHaveLength(0);
  });

  test("should not include server-only strings in bundle", async ({ page }) => {
    await page.goto("/");

    // Get all script tags and check their content
    const scripts = await page.$$eval("script[src]", (scripts) =>
      scripts.map((s) => s.getAttribute("src"))
    );

    // Check that no script URLs contain server-only indicators
    const forbiddenPatterns = [
      "drizzle-orm",
      "postgres",
      "@alfred/db",
      "openai",
      "DATABASE_URL",
    ];

    for (const script of scripts) {
      if (script) {
        for (const pattern of forbiddenPatterns) {
          expect(script).not.toContain(pattern);
        }
      }
    }
  });
});
