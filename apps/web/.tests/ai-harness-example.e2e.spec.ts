/**
 * Example test demonstrating AI-optimized test harness
 *
 * This test shows how to use the new AI test harness with integrated
 * timeout handling, crash monitoring, and screenshot capture.
 */

import { expect, test } from "./helpers/ai-harness";

test("AI harness example - workflow renders", async ({
  page,
  screenshots,
  safeAction,
  safeAssert,
}) => {
  // Safe navigation with timeout and screenshot on failure
  await safeAction(
    "navigate-home",
    async () => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
    },
    5000
  );

  // Capture initial page load
  await screenshots.capturePageLoad("home");

  // Safe action with automatic screenshot on timeout
  await safeAction("click-workflow-button", async () => {
    const button = page.locator('[data-testid="workflow-button"]');
    await button.waitFor({ state: "visible" });
    await button.click();
  });

  // Safe assertion with screenshot on failure
  await safeAssert("workflow-panel-visible", async () => {
    const panel = page.locator('[data-testid="workflow-panel"]');
    await expect(panel).toBeVisible();
  });

  // Capture milestone
  await screenshots.captureMilestone("workflow-complete");
});
