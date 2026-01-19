import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import { spawnNode } from "./helpers/mindscape";

test.describe("Workflow phase journey (plan → edit → approve → execute)", () => {
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page);
  });

  test("can plan, edit a phase, approve, and see dry-run completion", async ({
    page,
  }) => {
    await spawnNode(page, "New Workflow");

    const workflowWindowId = await page
      .evaluate(() => {
        const w = globalThis as unknown as {
          __DESKTOP_STORE__?: {
            getState: () => {
              windows: Array<{ id: string; type: string; createdAt?: number }>;
              focusedWindowId: string | null;
            };
          };
        };
        const state = w.__DESKTOP_STORE__?.getState();
        if (!state) {
          return null;
        }
        const newestWorkflow = state.windows
          .filter((win) => win.type === "workflow")
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
        return newestWorkflow?.id ?? state.focusedWindowId ?? null;
      })
      .catch(() => null);

    const workflow = workflowWindowId
      ? page.locator(`[data-window-id="${workflowWindowId}"]`)
      : page.getByRole("dialog", { name: /workflow/i });
    await expect(workflow).toBeVisible();

    await workflow
      .getByPlaceholder("What should the workflow accomplish?")
      .fill("Ship workflow consolidation (dry run)");

    await workflow.getByRole("button", { name: "Generate Plan" }).click();

    // Planning should transition into the canvas view with approval controls.
    await expect(
      workflow.getByRole("button", { name: "Approve Plan" })
    ).toBeVisible({ timeout: 60_000 });

    // Select the first phase node and edit it (exercises updatePlan wiring).
    const firstPhase = workflow.locator(".react-flow__node-phase").first();
    await firstPhase.click();

    const nameInput = workflow.locator("input").first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Edited Phase");

    await workflow.getByRole("button", { name: "Approve Plan" }).click();

    // Execution panel should show progress then completion (dry run in VITE_TEST_MODE).
    await expect(
      workflow.locator("text=/Running\\.\\.\\.|Completed/").first()
    ).toBeVisible({
      timeout: 60_000,
    });
    await expect(workflow.locator("text=Completed").first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
