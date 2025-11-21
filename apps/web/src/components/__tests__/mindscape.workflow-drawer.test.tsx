import "../../test/testing-library";
import { describe, expect, it, mock } from "bun:test";
import { MindscapeWorkflowDrawer } from "@/components/mindscape/workflow-drawer";
import {
  createTestQueryClient,
  createTestTrpcClient,
  renderRoute,
  type TestTrpcHandlers,
} from "@/test/render-route";
import { fireEvent } from "../../test/testing-library";

describe("MindscapeWorkflowDrawer", () => {
  it("invokes onNavigateFull when the CTA is pressed", async () => {
    const handlers: TestTrpcHandlers = {
      queries: {
        "workflow.get": () => ({
          id: "run-123",
          workflowId: "workflow-123",
          status: "completed",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          inputData: {},
        }),
        "workflow.events": () => [],
        "workflow.reasoning": () => ({
          runId: "run-123",
          resource: "user",
          executionId: "exec-123",
          chain: [],
          provenance: { ragDocuments: [] },
        }),
      },
    };

    const trpcClient = createTestTrpcClient(handlers);
    const queryClient = createTestQueryClient();
    const navigateMock = mock<(runId: string) => void>(() => {});

    const view = renderRoute(
      <MindscapeWorkflowDrawer
        onClose={() => {}}
        onNavigateFull={navigateMock}
        onNavigateToMindscape={() => {}}
        runId="run-123"
      />,
      {
        queryClient,
        trpcClient,
      }
    );

    await view.findByText("Workflow Details");
    const openButtons = view.getAllByTestId("mindscape-drawer-open-full");
    fireEvent.click(openButtons[openButtons.length - 1]);

    expect(navigateMock).toHaveBeenCalledWith("run-123");
  });

  it("surfaces the retry control when the workflow query fails", async () => {
    const handlers: TestTrpcHandlers = {
      queries: {
        "workflow.get": () => {
          throw new Error("Failed to load run");
        },
      },
    };

    const trpcClient = createTestTrpcClient(handlers);

    const view = renderRoute(
      <MindscapeWorkflowDrawer
        onClose={() => {}}
        onNavigateFull={() => {}}
        onNavigateToMindscape={() => {}}
        runId="run-err"
      />,
      {
        trpcClient,
      }
    );

    const errorMessage = await view.findByText(
      "Unable to load workflow run."
    );
    expect(errorMessage).toBeTruthy();
    expect(view.getByText("Retry")).toBeTruthy();
  });
});
