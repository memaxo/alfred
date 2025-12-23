import "@/test/dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useMindscapeStore } from "@/store/mindscape";
import {
  createTestQueryClient,
  createTestTrpcClient,
  type TestTrpcHandlers,
} from "@/test/render-route";
import { trpc } from "@/utils/trpc";
import { useRagCache } from "../use-rag-cache";

// Mock toast
const mockToastError = mock(() => {});
const mockToastInfo = mock(() => {});
mock.module("sonner", () => ({
  toast: {
    error: mockToastError,
    info: mockToastInfo,
  },
}));

// Mock clearSearchParams
const mockClearSearchParams = mock(() => {});
mock.module("@/lib/mindscape/url", () => ({
  clearSearchParams: mockClearSearchParams,
}));

describe("useRagCache", () => {
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
    mockToastInfo.mockClear();
    mockClearSearchParams.mockClear();
  });

  afterEach(() => {
    useMindscapeStore.getState().nodes = [];
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

  it("returns empty state when no ragDocQuery provided", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useRagCache({ ragDocQuery: null }),
      { wrapper }
    );

    expect(result.current.ragDocTargetNode).toBeNull();
    expect(result.current.cachedRagDoc).toBeUndefined();
    expect(result.current.ragDocCacheEntryCount).toBe(0);
    expect(result.current.ragDocCacheHitRate).toBe(0);
  });

  it("finds existing node by dbId", () => {
    useMindscapeStore.setState({
      nodes: [
        {
          id: "rag-knowledge-doc-123",
          type: "knowledge",
          position: { x: 0, y: 0 },
          data: {
            type: "knowledge",
            label: "Test Doc",
            graph: { dbId: "doc-123", resource: "user" },
          },
        } as any,
      ],
    });

    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useRagCache({ ragDocQuery: "doc-123" }),
      { wrapper }
    );

    expect(result.current.ragDocTargetNode).not.toBeNull();
    expect(result.current.ragDocTargetNode?.id).toBe("rag-knowledge-doc-123");
  });

  it("returns cached document when available and not expired", () => {
    const cachedData = {
      type: "knowledge" as const,
      label: "Cached Doc",
      kind: "document",
      source: "rag" as const,
      graph: { dbId: "doc-456", resource: "user" },
    };

    useMindscapeStore.setState({
      ragDocCache: {
        "doc-456": {
          data: cachedData,
          cachedAt: Date.now(), // Fresh cache
        },
      },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useRagCache({ ragDocQuery: "doc-456" }),
      { wrapper }
    );

    expect(result.current.cachedRagDoc).toEqual(cachedData);
  });

  it("records cache hit when document is in cache", async () => {
    const cachedData = {
      type: "knowledge" as const,
      label: "Cached Doc",
      kind: "document",
      source: "rag" as const,
      graph: { dbId: "doc-789", resource: "user" },
    };

    useMindscapeStore.setState({
      ragDocCache: {
        "doc-789": {
          data: cachedData,
          cachedAt: Date.now(),
        },
      },
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
    });

    const wrapper = createWrapper();
    renderHook(
      () => useRagCache({ ragDocQuery: "doc-789" }),
      { wrapper }
    );

    await waitFor(() => {
      const stats = useMindscapeStore.getState().ragDocCacheStats;
      expect(stats.hits).toBe(1);
    });
  });

  it("records cache miss when document not in cache or nodes", async () => {
    useMindscapeStore.setState({
      nodes: [],
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
    });

    const wrapper = createWrapper({
      queries: {
        "graph.runQuery": () => ({ nodes: [], edges: [] }),
      },
    });

    renderHook(
      () => useRagCache({ ragDocQuery: "missing-doc" }),
      { wrapper }
    );

    await waitFor(() => {
      const stats = useMindscapeStore.getState().ragDocCacheStats;
      expect(stats.misses).toBe(1);
    });
  });

  it("computes cache hit rate correctly", () => {
    useMindscapeStore.setState({
      ragDocCache: {
        "doc-1": { data: {} as any, cachedAt: Date.now() },
        "doc-2": { data: {} as any, cachedAt: Date.now() },
      },
      ragDocCacheStats: { hits: 8, misses: 2, evictions: 0 },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useRagCache({ ragDocQuery: null }),
      { wrapper }
    );

    expect(result.current.ragDocCacheEntryCount).toBe(2);
    expect(result.current.ragDocCacheHitRate).toBe(80); // 8/(8+2) = 80%
  });

  it("evicts stale cache entries", async () => {
    const staleTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago

    useMindscapeStore.setState({
      ragDocCache: {
        "stale-doc": {
          data: { type: "knowledge", label: "Stale" } as any,
          cachedAt: staleTimestamp,
        },
      },
    });

    const wrapper = createWrapper({
      queries: {
        "graph.runQuery": () => ({ nodes: [], edges: [] }),
      },
    });

    renderHook(
      () => useRagCache({ ragDocQuery: "stale-doc" }),
      { wrapper }
    );

    await waitFor(() => {
      const cache = useMindscapeStore.getState().ragDocCache;
      expect(cache["stale-doc"]).toBeUndefined();
    });
  });

  it("hydrates document from graph query", async () => {
    const onHydrated = mock(() => {});
    
    const wrapper = createWrapper({
      queries: {
        "graph.runQuery": () => ({
          nodes: [
            {
              id: { dbId: "new-doc", hgHash: "hash-123" },
              label: "New Document",
              kind: "document",
              properties: { content: "Document content" },
            },
          ],
          edges: [],
        }),
      },
    });

    renderHook(
      () => useRagCache({ ragDocQuery: "new-doc", onHydrated }),
      { wrapper }
    );

    await waitFor(() => {
      const nodes = useMindscapeStore.getState().nodes;
      const hydratedNode = nodes.find((n) => n.id === "rag-knowledge-new-doc");
      expect(hydratedNode).toBeDefined();
      expect(hydratedNode?.data?.label).toBe("New Document");
    });

    await waitFor(() => {
      expect(onHydrated).toHaveBeenCalledWith("rag-knowledge-new-doc");
    });
  });

  it("handles hydration when graph returns empty nodes", async () => {
    // Test that empty results are handled gracefully
    const wrapper = createWrapper({
      queries: {
        "graph.runQuery": () => ({ nodes: [], edges: [] }),
      },
    });

    const { result } = renderHook(
      () => useRagCache({ ragDocQuery: "empty-doc" }),
      { wrapper }
    );

    // Should not crash and should return no target node
    expect(result.current.ragDocTargetNode).toBeNull();
  });

  it("shows info toast when document not in graph", async () => {
    const wrapper = createWrapper({
      queries: {
        "graph.runQuery": () => ({
          nodes: [
            {
              id: { dbId: "other-doc" },
              label: "Other Doc",
              kind: "document",
            },
          ],
          edges: [],
        }),
      },
    });

    renderHook(
      () => useRagCache({ ragDocQuery: "missing-doc" }),
      { wrapper }
    );

    await waitFor(() => {
      expect(mockToastInfo).toHaveBeenCalledWith(
        "RAG document is not available in the graph yet."
      );
    });
  });

  it("does not duplicate cache hit/miss recording", async () => {
    useMindscapeStore.setState({
      ragDocCache: {
        "doc-dup": {
          data: { type: "knowledge", label: "Dup" } as any,
          cachedAt: Date.now(),
        },
      },
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
    });

    const wrapper = createWrapper();
    const { rerender } = renderHook(
      () => useRagCache({ ragDocQuery: "doc-dup" }),
      { wrapper }
    );

    // Multiple rerenders should not duplicate recording
    rerender();
    rerender();
    rerender();

    await waitFor(() => {
      const stats = useMindscapeStore.getState().ragDocCacheStats;
      expect(stats.hits).toBe(1); // Only recorded once
    });
  });
});
