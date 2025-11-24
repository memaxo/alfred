import "@/test/dom";
import { act, render, waitFor } from "@testing-library/react";
import type { WorkflowEvent } from "@alfred/type";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";

const subscriptionMock = vi.fn();
const tokenMock = vi.fn();
const dispatchMindscapeEventMock = vi.fn();

mock.module("@/utils/trpc", () => ({
  trpc: {
    workflow: {
      stream: {
        useSubscription: subscriptionMock,
      },
    },
  },
}));

mock.module("@/lib/token", () => ({
  getToolToken: tokenMock,
}));

mock.module("@/hooks/use-mindscape-activations", () => ({
  dispatchMindscapeEvent: dispatchMindscapeEventMock,
}));

import { WorkflowManager } from "@/components/mindscape/monitor";
import { useMindscapeStore } from "@/store/mindscape";

describe("WorkflowManager context cache events", () => {
  beforeEach(() => {
    subscriptionMock.mockReset();
    tokenMock.mockReset();
    dispatchMindscapeEventMock.mockReset();
    tokenMock.mockResolvedValue("test-token");
    useMindscapeStore.setState({
      nodes: [],
      edges: [],
      focusedNodeId: null,
      activeEdges: new Set(),
      highlightedEdgeIds: new Set(),
      isSpaceMode: false,
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
      contextCache: {},
    });
  });

  it("records cache handoffs and clears them on completion", async () => {
    const nodeId = "workflow-node";
    useMindscapeStore.setState((state) => ({
      ...state,
      nodes: [
        {
          id: nodeId,
          type: "workflow",
          position: { x: 0, y: 0 },
          data: {
            type: "workflow",
            label: "Cache Run",
            status: "pending",
            requirement: "Check cache",
            auto: "low",
            mode: "sequential",
            messages: [],
          },
          selectable: true,
          draggable: false,
        } as any,
      ],
    }));

    let subscriptionHandler:
      | { onData?: (event: WorkflowEvent) => void }
      | undefined;
    subscriptionMock.mockImplementation((_input, handler) => {
      subscriptionHandler = handler;
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(subscriptionMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(subscriptionHandler?.onData).toBeDefined();
    });

    const cacheEvent: WorkflowEvent = {
      type: "data-cache-handoff",
      eventId: "cache-1",
      receipts: {
        summary: "Cached match",
        created: new Date().toISOString(),
        code: [],
      },
    } as any;

    act(() => {
      subscriptionHandler?.onData?.(cacheEvent);
    });

    await waitFor(() => {
      const entry = useMindscapeStore.getState().contextCache[nodeId];
      expect(entry?.source).toBe("handoff");
    });
    expect(dispatchMindscapeEventMock).toHaveBeenCalledWith({
      sourceId: nodeId,
      type: "context-cache",
    });

    const contextEvent: WorkflowEvent = {
      type: "context",
      phase: "scan",
      eventId: "ctx-1",
      receipts: {
        summary: "Fresh context",
        created: new Date().toISOString(),
        code: [],
      },
    } as any;

    act(() => {
      subscriptionHandler?.onData?.(contextEvent);
    });

    await waitFor(() => {
      const entry = useMindscapeStore.getState().contextCache[nodeId];
      expect(entry?.source).toBe("scan");
      expect(entry?.receipt?.summary).toBe("Fresh context");
    });

    act(() => {
      subscriptionHandler?.onData?.({
        type: "complete",
        eventId: "done",
      } as any);
    });

    await waitFor(() => {
      expect(useMindscapeStore.getState().contextCache[nodeId]).toBeUndefined();
    });
  });
});
