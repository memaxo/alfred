import { beforeEach, describe, expect, it, mock } from "bun:test";
import { fireEvent, within } from "@testing-library/react";
import "../../test/testing-library";

import type { Node } from "@xyflow/react";
import { MindscapeDetailPanel } from "@/components/mindscape/detail-panel";
import { type ArtifactData, useMindscapeStore } from "@/store/mindscape";
import { createTestTrpcClient, renderRoute } from "@/test/render-route";

describe("MindscapeDetailPanel workflow navigation", () => {
  beforeEach(() => {
    useMindscapeStore.setState({
      nodes: [],
      edges: [],
      focusedNodeId: null,
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
      contextCache: {},
    });
  });

  it("navigates to the workflow run from runtime knowledge nodes", async () => {
    const runtimeNode: Node<ArtifactData> = {
      id: "knowledge-runtime-1",
      type: "knowledge",
      position: { x: 0, y: 0 },
      data: {
        type: "knowledge",
        label: "Runtime Insight",
        source: "runtime",
        runId: "run-abc123",
        graph: undefined,
      },
      selectable: true,
      draggable: true,
    };

    useMindscapeStore.setState((state) => ({
      ...state,
      nodes: [runtimeNode],
      edges: [],
      focusedNodeId: runtimeNode.id,
    }));

    const trpcClient = createTestTrpcClient({
      queries: {
        "graph.explainedBy": () => ({ nodes: [], edges: [] }),
      },
    });

    const navigateMock = mock<(runId: string) => void>(() => {});

    const { container } = renderRoute(
      <MindscapeDetailPanel onWorkflowNavigate={navigateMock} />,
      {
        trpcClient,
      }
    );

    const button = await within(container).findByTestId(
      "mindscape-workflow-link"
    );
    fireEvent.click(button);

    expect(navigateMock).toHaveBeenCalledWith("run-abc123");
  });

  it("prefers the inspect callback when both inspect and navigate handlers exist", async () => {
    const runtimeNode: Node<ArtifactData> = {
      id: "knowledge-runtime-2",
      type: "knowledge",
      position: { x: 0, y: 0 },
      data: {
        type: "knowledge",
        label: "Runtime Insight",
        source: "runtime",
        runId: "run-inline-1",
      },
      selectable: true,
      draggable: true,
    };

    useMindscapeStore.setState((state) => ({
      ...state,
      nodes: [runtimeNode],
      edges: [],
      focusedNodeId: runtimeNode.id,
    }));

    const trpcClient = createTestTrpcClient({
      queries: {
        "graph.explainedBy": () => ({ nodes: [], edges: [] }),
      },
    });

    const inspectMock = mock<(runId: string) => void>(() => {});
    const navigateMock = mock<(runId: string) => void>(() => {});

    const { container } = renderRoute(
      <MindscapeDetailPanel
        onWorkflowInspect={inspectMock}
        onWorkflowNavigate={navigateMock}
      />,
      { trpcClient }
    );

    const button = await within(container).findByTestId(
      "mindscape-workflow-link"
    );
    fireEvent.click(button);

    expect(inspectMock).toHaveBeenCalledWith("run-inline-1");
    expect(navigateMock).not.toHaveBeenCalled();

    const fullButton = await within(container).findByTestId(
      "mindscape-workflow-open-full"
    );
    fireEvent.click(fullButton);

    expect(navigateMock).toHaveBeenCalledWith("run-inline-1");
  });
});
