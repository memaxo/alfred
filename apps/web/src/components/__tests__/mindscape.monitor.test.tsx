import "@/test/reset-mocks";
import "@/test/dom";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import type { WorkflowEvent } from "@alfred/type";
import { act, render, waitFor } from "@testing-library/react";
import type { UseWorkflowSseStreamOptions } from "@/hooks/use-workflow-sse-stream";

const tokenMock = vi.fn();
const dispatchMindscapeEventMock = vi.fn();
let latestHandlers: UseWorkflowSseStreamOptions | null = null;
let useWorkflowSseStreamSpy: ReturnType<typeof vi.spyOn> | null = null;
const resumeMock = {
  isOpen: false,
  pending: null as any,
  prompt: vi.fn(),
  close: vi.fn(),
};

mock.module("@/lib/token", () => ({
  getToolToken: tokenMock,
}));

mock.module("@/hooks/use-mindscape-activations", () => ({
  dispatchMindscapeEvent: dispatchMindscapeEventMock,
}));

mock.module("@/hooks/use-biometric-resume", () => ({
  useObligationResume: () => resumeMock,
}));

mock.module("@/components/biometric-challenge-dialog", () => ({
  ObligationChallengeDialog: () => null,
}));

import { WorkflowManager } from "@/components/mindscape/monitor";
import { useMindscapeStore } from "@/store/mindscape";

describe("WorkflowManager context cache events", () => {
  beforeAll(async () => {
    const hookModule = await import("@/hooks/use-workflow-sse-stream");
    useWorkflowSseStreamSpy = vi
      .spyOn(hookModule, "useWorkflowSseStream")
      .mockImplementation((options: UseWorkflowSseStreamOptions) => {
        latestHandlers = options;
        return { status: "open", error: null };
      });
  });

  afterAll(() => {
    useWorkflowSseStreamSpy?.mockRestore();
  });

  beforeEach(() => {
    latestHandlers = null;
    tokenMock.mockReset();
    dispatchMindscapeEventMock.mockReset();
    tokenMock.mockResolvedValue("test-token");
    resumeMock.isOpen = false;
    resumeMock.pending = null;
    resumeMock.prompt.mockReset();
    resumeMock.close.mockReset();
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

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(latestHandlers?.onWorkflowEvent).toBeDefined();
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
      latestHandlers?.onWorkflowEvent?.(cacheEvent);
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
      latestHandlers?.onWorkflowEvent?.(contextEvent);
    });

    await waitFor(() => {
      const entry = useMindscapeStore.getState().contextCache[nodeId];
      expect(entry?.source).toBe("scan");
      expect(entry?.receipt?.summary).toBe("Fresh context");
    });

    act(() => {
      latestHandlers?.onWorkflowEvent?.({
        type: "complete",
        eventId: "done",
      } as any);
    });

    await waitFor(() => {
      expect(useMindscapeStore.getState().contextCache[nodeId]).toBeUndefined();
    });
  });

  it("appends UI messages and clears context when transport errors occur", async () => {
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
            label: "Stream Run",
            status: "running",
            requirement: "Check messages",
            auto: "low",
            mode: "sequential",
            messages: [
              {
                id: "seed",
                role: "assistant",
                parts: [{ type: "text", text: "Seed" }],
              },
            ],
          },
          selectable: true,
          draggable: false,
        } as any,
      ],
      contextCache: {
        [nodeId]: {
          source: "handoff",
          updatedAt: Date.now(),
        },
      },
    }));

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(latestHandlers?.onUiMessages).toBeDefined();
    });

    act(() => {
      latestHandlers?.onUiMessages?.(
        [
          {
            id: "msg-new",
            role: "assistant",
            parts: [{ type: "text", text: "New" }],
          } as any,
        ],
        { runId: "run-1", eventId: "evt", eventType: "run" }
      );
    });

    const nodeAfterMessages = useMindscapeStore
      .getState()
      .nodes.find((n) => n.id === nodeId);
    expect((nodeAfterMessages?.data as any)?.messages).toHaveLength(2);

    act(() => {
      try {
        latestHandlers?.onError?.(new Error("network"));
      } catch {
        // ignore to keep test focused on side effects
      }
    });

    expect(useMindscapeStore.getState().contextCache[nodeId]).toBeUndefined();
    const nodeAfterError = useMindscapeStore
      .getState()
      .nodes.find((n) => n.id === nodeId);
    expect(nodeAfterError?.data?.status).toBe("failed");
  });
});
