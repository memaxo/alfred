import { expect, test } from "./helpers/ai-harness";
import { signUpTestUser } from "./helpers/auth";
import { spawnNode } from "./helpers/mindscape";

test.describe("Workflow phase journey (plan → edit → approve → execute)", () => {
  test.beforeEach(async ({ page, screenshots, safeAction }) => {
    await safeAction(
      "signup-test-user",
      async () => {
        await signUpTestUser(page);
      },
      60_000
    );
    await screenshots.captureMilestone("authenticated");
  });

  test("can plan, edit a phase, approve, and see dry-run completion", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    await safeAction(
      "spawn-workflow-node",
      async () => {
        await spawnNode(page, "New Workflow");
      },
      20_000
    );
    await screenshots.captureMilestone("workflow-spawned");

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
    await safeAssert("workflow-visible", async () => {
      await expect(workflow).toBeVisible();
    });
    await screenshots.captureMilestone("workflow-visible");

    await safeAction(
      "fill-goal",
      async () => {
        await workflow
          .getByPlaceholder("What should the workflow accomplish?")
          .fill("Ship workflow consolidation (dry run)");
      },
      20_000
    );
    await screenshots.captureMilestone("goal-entered");

    await safeAction(
      "generate-plan",
      async () => {
        await workflow.getByRole("button", { name: "Generate Plan" }).click();
      },
      20_000
    );
    await screenshots.captureMilestone("plan-generating");

    // Planning should transition into the canvas view with approval controls.
    await safeAssert("approve-plan-visible", async () => {
      await expect(
        workflow.getByRole("button", { name: "Approve Plan" })
      ).toBeVisible({ timeout: 60_000 });
    });
    await screenshots.captureMilestone("plan-ready");

    // Select the first phase node and edit it (exercises updatePlan wiring).
    const firstPhase = workflow.locator(".react-flow__node-phase").first();
    await safeAction(
      "select-first-phase",
      async () => {
        await firstPhase.click();
      },
      15_000
    );

    const nameInput = workflow.locator("input").first();
    await safeAssert("phase-name-input-visible", async () => {
      await expect(nameInput).toBeVisible();
    });
    await safeAction("edit-phase-name", async () => {
      await nameInput.fill("Edited Phase");
    });
    await screenshots.captureMilestone("phase-edited");

    await safeAction(
      "approve-plan",
      async () => {
        await workflow.getByRole("button", { name: "Approve Plan" }).click();
      },
      20_000
    );
    await screenshots.captureMilestone("execution-started");

    // Execution panel should show progress then completion (dry run in VITE_TEST_MODE).
    await safeAssert("execution-running-or-completed", async () => {
      await expect(
        workflow.locator("text=/Running\\.\\.\\.|Completed/").first()
      ).toBeVisible({
        timeout: 60_000,
      });
    });
    await screenshots.captureMilestone("execution-progress");

    await safeAssert("execution-completed", async () => {
      await expect(workflow.locator("text=Completed").first()).toBeVisible({
        timeout: 60_000,
      });
    });
    await screenshots.captureMilestone("completed");
  });
});
