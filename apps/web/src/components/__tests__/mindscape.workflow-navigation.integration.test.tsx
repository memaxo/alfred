import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../../test/testing-library";
import { act, fireEvent, waitFor } from "@testing-library/react";

import { useMindscapeStore } from "@/store/mindscape";
import {
  createTestTrpcClient,
  renderRoute,
  type TestTrpcHandlers,
} from "@/test/render-route";

describe("Mindscape workflow CTA integration", () => {
  beforeEach(() => {
    if (typeof process !== "undefined") {
      process.env.MINDSCAPE_DISABLE_CHAT_AUTOSPAWN = "1";
    }

    useMindscapeStore.setState({
      nodes: [],
      edges: [],
      focusedNodeId: null,
      isSpaceMode: false,
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
      contextCache: {},
    });
  });

  it("invokes the workflow navigation callback when the CTA is clicked", async () => {
    const { MindscapeCanvas } = await import("@/components/mindscape/canvas");
    const runtimeNodeId = "knowledge-runtime-test";
    useMindscapeStore.setState((state) => ({
      ...state,
      nodes: [
        {
          id: runtimeNodeId,
          type: "knowledge",
          position: { x: 0, y: 0 },
          data: {
            type: "knowledge",
            label: "Runtime CTA Node",
            source: "runtime",
            runId: "run-provenance-1",
          },
          selectable: true,
          draggable: true,
        },
      ],
      edges: [],
      focusedNodeId: runtimeNodeId,
    }));

    const handlers: TestTrpcHandlers = {
      queries: {
        "note.list": () => [],
        "remind.due": () => [],
        "graph.getEdges": () => [],
        "graph.runQuery": () => ({ nodes: [], edges: [] }),
        "graph.explainedBy": () => ({ nodes: [], edges: [] }),
        "workflow.get": () => ({
          id: "run-provenance-1",
          workflowId: "workflow-cta",
          status: "completed",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          inputData: { requirement: "CTA test" },
        }),
        "workflow.events": () => [],
        "workflow.reasoning": () => ({
          runId: "run-provenance-1",
          resource: "user",
          executionId: "exec-cta",
          chain: [],
          provenance: { ragDocuments: [] },
        }),
      },
      subscriptions: {
        "graph.watchEdges": (_input, observer) => observer.complete(),
      },
    };

    const trpcClient = createTestTrpcClient(handlers);
    const navigateMock = mock<(runId: string) => void>(() => {});

    renderRoute(<MindscapeCanvas onWorkflowNavigate={navigateMock} />, {
      trpcClient,
    });

    const button = await waitFor(
      () =>
        document.querySelector(
          '[data-testid="mindscape-workflow-link"]'
        ) as HTMLButtonElement | null
    );
    expect(button).toBeTruthy();

    if (button) {
      await act(async () => {
        fireEvent.click(button);
      });
    }

    const drawerAction = await waitFor(
      () =>
        document.querySelector(
          '[data-testid="mindscape-drawer-open-full"]'
        ) as HTMLButtonElement | null
    );
    expect(drawerAction).toBeTruthy();

    if (drawerAction) {
      await act(async () => {
        fireEvent.click(drawerAction);
      });
    }

    expect(navigateMock).toHaveBeenCalledWith("run-provenance-1");
  });
});
