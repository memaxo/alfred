import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";

test("Workflow window renders GenUI timeline from runId", async ({ page }) => {
  await signUpTestUser(page);

  const workflowWindowId = await page.evaluate(() => {
    const w = globalThis as unknown as {
      __DESKTOP_STORE__?: {
        getState: () => {
          spawnWindow: (type: string) => string;
          updateWindowData: (id: string, data: unknown) => void;
          setSpaceMode?: (enabled: boolean) => void;
          toggleMindscape?: () => void;
        };
      };
    };
    const store = w.__DESKTOP_STORE__?.getState();
    if (!store) {
      return null;
    }

    // Ensure we're in the desktop/mindscape surface so window UI is mounted.
    store.setSpaceMode?.(true);
    store.toggleMindscape?.();

    const id = store.spawnWindow("workflow");
    store.updateWindowData(id, {
      runId: "run-test-1",
      status: "running",
      steps: [
        { id: "plan", name: "Plan", status: "completed", duration: 25 },
        { id: "execute", name: "Execute", status: "running" },
      ],
      activeView: "list",
    });
    return id;
  });

  expect(workflowWindowId).toBeTruthy();
  const workflow = page.locator(
    `[role="dialog"][data-window-id="${workflowWindowId}"]`
  );
  await expect(workflow).toBeVisible({ timeout: 10_000 });

  // GenUI WorkflowTimeline defaults to "Workflow Execution" title.
  await expect(workflow.getByText(/Workflow Execution/i)).toBeVisible({
    timeout: 10_000,
  });
});
