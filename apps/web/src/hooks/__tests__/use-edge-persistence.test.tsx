import "@/test/dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useMindscapeStore } from "@/store/mindscape";
import {
  createTestQueryClient,
  createTestTrpcClient,
  type TestTrpcHandlers,
} from "@/test/render-route";
import { trpc } from "@/utils/trpc";
import { useEdgePersistence } from "../use-edge-persistence";

// Mock toast
const mockToastError = mock(() => {});
const mockToastInfo = mock(() => {});
mock.module("sonner", () => ({
  toast: {
    error: mockToastError,
    info: mockToastInfo,
  },
}));

describe("useEdgePersistence", () => {
  beforeEach(() => {
    useMindscapeStore.setState({
      nodes: [],
      edges: [],
      focusedNodeId: null,
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
      contextCache: {},
    });
    mockToastError.mockClear();
  });

  afterEach(() => {
    useMindscapeStore.setState({
      nodes: [],
      edges: [],
    });
  });

  const createWrapper = (handlers: TestTrpcHandlers = {}) => {
    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient(handlers);

    return ({ children }: { children: ReactNode }) => (
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </trpc.Provider>
    );
  };

  it("creates edge optimistically and persists to backend", async () => {
    const mockConnect = mock(() => Promise.resolve({}));

    useMindscapeStore.setState({
      nodes: [
        {
          id: "node-1",
          type: "knowledge",
          position: { x: 0, y: 0 },
          data: {
            type: "knowledge",
            graph: { dbId: "db-1", resource: "user" },
          },
        } as any,
        {
          id: "node-2",
          type: "knowledge",
          position: { x: 100, y: 100 },
          data: {
            type: "knowledge",
            graph: { dbId: "db-2", resource: "user" },
          },
        } as any,
      ],
      edges: [],
    });

    const wrapper = createWrapper({
      mutations: {
        "graph.connect": mockConnect,
      },
    });

    const { result } = renderHook(() => useEdgePersistence(), { wrapper });

    await act(async () => {
      await result.current.onConnectPersisting({
        source: "node-1",
        target: "node-2",
        sourceHandle: null,
        targetHandle: null,
      });
    });

    // Edge should be added to store
    const edges = useMindscapeStore.getState().edges;
    expect(edges.length).toBe(1);
    expect(edges[0].source).toBe("node-1");
    expect(edges[0].target).toBe("node-2");

    // Backend should be called
    expect(mockConnect).toHaveBeenCalledWith({
      fromId: "db-1",
      toId: "db-2",
      kind: "relates_to",
      resource: "user",
    });
  });

  it("rolls back edge when source node has no graph data", async () => {
    useMindscapeStore.setState({
      nodes: [
        {
          id: "node-no-graph",
          type: "note",
          position: { x: 0, y: 0 },
          data: { type: "note", label: "Note" },
        } as any,
        {
          id: "node-with-graph",
          type: "knowledge",
          position: { x: 100, y: 100 },
          data: {
            type: "knowledge",
            graph: { dbId: "db-2", resource: "user" },
          },
        } as any,
      ],
      edges: [],
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useEdgePersistence(), { wrapper });

    await act(async () => {
      await result.current.onConnectPersisting({
        source: "node-no-graph",
        target: "node-with-graph",
        sourceHandle: null,
        targetHandle: null,
      });
    });

    const edges = useMindscapeStore.getState().edges;
    expect(edges.length).toBe(0);
    expect(mockToastError).toHaveBeenCalledWith(
      "Only graph-backed nodes can be linked."
    );
  });

  it("rolls back edge when nodes have different resources", async () => {
    useMindscapeStore.setState({
      nodes: [
        {
          id: "node-user",
          type: "knowledge",
          position: { x: 0, y: 0 },
          data: {
            type: "knowledge",
            graph: { dbId: "db-1", resource: "user" },
          },
        } as any,
        {
          id: "node-system",
          type: "knowledge",
          position: { x: 100, y: 100 },
          data: {
            type: "knowledge",
            graph: { dbId: "db-2", resource: "system" },
          },
        } as any,
      ],
      edges: [],
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useEdgePersistence(), { wrapper });

    await act(async () => {
      await result.current.onConnectPersisting({
        source: "node-user",
        target: "node-system",
        sourceHandle: null,
        targetHandle: null,
      });
    });

    const edges = useMindscapeStore.getState().edges;
    expect(edges.length).toBe(0);
    expect(mockToastError).toHaveBeenCalledWith(
      "Cannot link nodes from different resources."
    );
  });

  it("rolls back edge on backend API error", async () => {
    const mockConnect = mock(() => Promise.reject(new Error("API Error")));

    useMindscapeStore.setState({
      nodes: [
        {
          id: "node-1",
          type: "knowledge",
          position: { x: 0, y: 0 },
          data: {
            type: "knowledge",
            graph: { dbId: "db-1", resource: "user" },
          },
        } as any,
        {
          id: "node-2",
          type: "knowledge",
          position: { x: 100, y: 100 },
          data: {
            type: "knowledge",
            graph: { dbId: "db-2", resource: "user" },
          },
        } as any,
      ],
      edges: [],
    });

    const wrapper = createWrapper({
      mutations: {
        "graph.connect": mockConnect,
      },
    });

    const { result } = renderHook(() => useEdgePersistence(), { wrapper });

    await act(async () => {
      await result.current.onConnectPersisting({
        source: "node-1",
        target: "node-2",
        sourceHandle: null,
        targetHandle: null,
      });
    });

    const edges = useMindscapeStore.getState().edges;
    expect(edges.length).toBe(0);
    expect(mockToastError).toHaveBeenCalledWith("Failed to persist edge.");
  });
});
