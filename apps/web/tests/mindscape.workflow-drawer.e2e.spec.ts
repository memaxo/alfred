import type { Route } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";

const WORKFLOW_ID = "run-provenance-1";
const RAG_DOC_ID = "doc-drawer-1";
const RAG_DOC_NODE_DBID = "223e4567-e89b-12d3-a456-426614174001";

const trpcResponse = (json: unknown) =>
  JSON.stringify([{ result: { data: json } }]);

async function handleTrpcRequest(
  route: Route,
  mocks: Record<string, () => unknown>
) {
  const url = new URL(route.request().url());
  const path = url.pathname.split("/api/trpc/")[1];
  if (!path) return route.continue();

  const procedures = path.split(",");
  const results = procedures.map((proc) => {
    const resolver = mocks[proc];
    if (!resolver) {
      return { result: { data: null } };
    }
    // We ignore input for now and just call resolver
    return { result: { data: resolver() } };
  });

  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(results),
  });
}

test.describe("Mindscape workflow drawer loop", () => {
  let feedbackCalled = false;

  test.beforeEach(async ({ page }) => {
    feedbackCalled = false;
    const mocks = {
      "workflow.get": () => ({
        id: WORKFLOW_ID,
        workflowId: "workflow-cta",
        status: "completed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        inputData: { requirement: "CTA provenance test" },
      }),
      "workflow.events": () => [
        {
          id: "evt-1",
          eventType: "step.started",
          timestamp: new Date().toISOString(),
          eventData: { info: "boot" },
        },
      ],
      "workflow.reasoning": () => ({
        runId: WORKFLOW_ID,
        resource: "user",
        executionId: "exec-cta",
        chain: [],
        provenance: {
          ragDocuments: [{ documentId: RAG_DOC_ID, label: "Drawer Doc" }],
        },
      }),
      "graph.explainedBy": () => ({
        nodes: [
          {
            id: RAG_DOC_NODE_DBID,
            label: "Drawer Doc",
            kind: "knowledge",
            properties: { title: "Drawer Doc", documentId: RAG_DOC_ID },
          },
        ],
        edges: [],
      }),
      "graph.runQuery": () => ({
        nodes: [
          {
            id: {
              dbId: RAG_DOC_NODE_DBID,
            },
            label: "Drawer Doc",
            kind: "knowledge",
            properties: { content: "Drawer doc summary", documentId: RAG_DOC_ID },
          },
        ],
        edges: [],
      }),
      // Add other procs if needed to avoid 404/warnings
      "graph.getEdges": () => [],
      "graph.watchEdges": () => ({ edges: [] }),
      "note.list": () => [],
      "remind.due": () => [],
      "assistant.getConfig": () => ({}),
      "cognitive.feedback": () => {
        feedbackCalled = true;
        return {
          state: {
            _: "reflecting",
            outcome: { _: "success", result: null, duration: 0 },
            expected: "CTA provenance test",
            actual: "CTA provenance test",
            error: 0,
            physiology: { energy: 1, boredom: 0, frustration: 0 },
          },
          obligations: [],
        };
      },
    };

    await page.route("**/api/trpc/*", (route) =>
      handleTrpcRequest(route, mocks)
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
              graph: {
                resource: "user",
                dbId: "123e4567-e89b-12d3-a456-426614174000",
              },
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

    // Wait for drawer to open (header visible)
    await expect(page.getByText("Workflow run")).toBeVisible();

    await page
      .getByTestId("mindscape-drawer-feedback-positive")
      .click({ force: true });
    await expect.poll(() => feedbackCalled, { timeout: 2000 }).toBeTruthy();

    // Click "Open full view" button in the header
    await page.getByTestId("mindscape-drawer-open-full").click({ force: true });
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
