import type { Route } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";

const WORKFLOW_ID = "run-provenance-1";
const RAG_DOC_ID = "doc-drawer-1";

const trpcResponse = (json: unknown) =>
  JSON.stringify([{ result: { data: json } }]);

async function mockTrpcResponse(
  route: Route,
  resolver: () => unknown
): Promise<void> {
  const payload = resolver();
  await route.fulfill({
    contentType: "application/json",
    body: trpcResponse(payload),
  });
}

test.describe("Mindscape workflow drawer loop", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/trpc/workflow.get*", (route) =>
      mockTrpcResponse(route, () => ({
        id: WORKFLOW_ID,
        workflowId: "workflow-cta",
        status: "completed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        inputData: { requirement: "CTA provenance test" },
      }))
    );
    await page.route("**/api/trpc/workflow.events*", (route) =>
      mockTrpcResponse(route, () => [
        {
          id: "evt-1",
          eventType: "step.started",
          timestamp: new Date().toISOString(),
          eventData: { info: "boot" },
        },
      ])
    );
    await page.route("**/api/trpc/workflow.reasoning*", (route) =>
      mockTrpcResponse(route, () => ({
        runId: WORKFLOW_ID,
        resource: "user",
        executionId: "exec-cta",
        chain: [],
        provenance: {
          ragDocuments: [{ documentId: RAG_DOC_ID, label: "Drawer Doc" }],
        },
      }))
    );
    await page.route("**/api/trpc/graph.explainedBy*", (route) =>
      mockTrpcResponse(route, () => ({
        nodes: [
          {
            id: RAG_DOC_ID,
            label: "Drawer Doc",
            kind: "knowledge",
            properties: { title: "Drawer Doc" },
          },
        ],
        edges: [],
      }))
    );
    await page.route("**/api/trpc/graph.runQuery*", (route) =>
      mockTrpcResponse(route, () => ({
        nodes: [
          {
            id: {
              dbId: RAG_DOC_ID,
            },
            label: "Drawer Doc",
            kind: "knowledge",
            properties: { content: "Drawer doc summary" },
          },
        ],
        edges: [],
      }))
    );
  });

  test("inspect → drawer → full view parity", async ({ page }) => {
    await signUpTestUser(page);

    await page.evaluate(
      ({ workflowId }) => {
        const store = (
          window as unknown as {
            __MINDSCAPE_STORE__?: {
              setState: (updater: (state: any) => any) => void;
            };
          }
        ).__MINDSCAPE_STORE__;
        if (!store) {
          throw new Error("Mindscape store is not available");
        }
        store.setState((state: any) => {
          const runtimeNode = {
            id: "runtime-drawer-node",
            type: "knowledge",
            position: { x: 120, y: 80 },
            data: {
              type: "knowledge",
              label: "Runtime Drawer Node",
              source: "runtime",
              runId: workflowId,
              graph: { dbId: "123e4567-e89b-12d3-a456-426614174000" },
            },
            selectable: true,
            draggable: true,
          };
          return {
            ...state,
            nodes: [
              ...state.nodes.filter((n: any) => n.id !== runtimeNode.id),
              runtimeNode,
            ],
            focusedNodeId: runtimeNode.id,
          };
        });
      },
      { workflowId: WORKFLOW_ID }
    );

    const inspectButton = page.getByTestId("mindscape-workflow-link").first();
    await inspectButton.click();

    const drawer = page
      .getByRole("dialog")
      .filter({ hasText: "Workflow run" })
      .last();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Drawer Doc")).toBeVisible();

    await drawer.getByRole("button", { name: "View in Mindscape" }).click();
    await expect(page).toHaveURL(/ragDoc=doc-drawer-1/);

    await drawer.getByTestId("mindscape-drawer-open-full").click();
    await page.waitForURL(/\/workflow\/run-provenance-1\?drawer=1/);

    const workflowDrawer = page
      .getByRole("dialog")
      .filter({ hasText: "Workflow run" })
      .last();
    await expect(workflowDrawer).toBeVisible();
    await workflowDrawer.getByRole("button", { name: "Close" }).click();
    await expect(page).toHaveURL(/\/workflow\/run-provenance-1$/);

    await page.getByRole("button", { name: "← Back to Mindscape" }).click();
    await page.waitForURL(/\/mindscape$/);
  });
});
