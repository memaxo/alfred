import "@/test/dom";
import { beforeEach, describe, expect, it, jest } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useDesktopStore } from "@/store/desktop";
import {
  createTestQueryClient,
  createTestTrpcClient,
  type TestTrpcHandlers,
} from "@/test/render-route";
import { trpc } from "@/utils/trpc";
import { useFocusedContext } from "../use-focused-context";

describe("useFocusedContext", () => {
  beforeEach(() => {
    useDesktopStore.setState({
      windows: [],
      edges: [],
      focusedWindowId: null,
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
      contextCache: {},
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

  it("returns empty context when nothing is focused", () => {
    const wrapper = createWrapper({
      queries: {
        "assistant.getConfig": () => ({ contextWindow: 128_000 }),
      },
    });
    const { result } = renderHook(() => useFocusedContext(), { wrapper });

    expect(result.current).toEqual({
      content: null,
      nodeType: null,
      label: null,
      isLoading: false,
      isError: false,
      ragDocuments: [],
      contextSnapshot: null,
    });
  });

  it("returns local context for simple windows (Note) without triggering RAG", async () => {
    const runQuerySpy = jest.fn();
    const wrapper = createWrapper({
      queries: {
        "graph.runQuery": runQuerySpy,
        "assistant.getConfig": () => ({ contextWindow: 128_000 }),
      },
    });

    useDesktopStore.setState({
      windows: [
        {
          id: "note-1",
          type: "note",
          data: {
            type: "note",
            label: "My Note",
            content: "Note content",
            viewMode: "full",
          },
          position: { x: 0, y: 0 },
        } as any,
      ],
      focusedWindowId: "note-1",
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
      contextCache: {},
    });

    const { result } = renderHook(() => useFocusedContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.label).toBe("My Note");
    });

    expect(result.current.content).toBe("Note content");
    expect(result.current.nodeType).toBe("note");

    // Should NOT trigger RAG for notes
    expect(runQuerySpy).not.toHaveBeenCalled();
  });

  it("triggers Active RAG for Knowledge windows and merges semantic + structural results", async () => {
    const runQuerySpy = jest.fn(() => ({
      nodes: [
        // Semantic Match
        {
          id: "rag-1",
          kind: "note",
          data: { label: "Related Doc", summary: "Relevant info from RAG." },
        },
        // Structural Match
        {
          id: "graph-1",
          kind: "link",
          label: "Dependent Node",
          properties: { relation: "DEPENDS_ON", direction: "outgoing" },
        },
      ],
      edges: [],
    }));

    const wrapper = createWrapper({
      queries: {
        "graph.runQuery": runQuerySpy,
        "assistant.getConfig": () => ({ contextWindow: 10_000 }),
      },
    });

    const graphDbId = "123e4567-e89b-12d3-a456-426614174000";
    useDesktopStore.setState({
      windows: [
        {
          id: "know-1",
          type: "knowledge",
          data: {
            type: "knowledge",
            label: "Quantum Physics",
            summary: "Study of small things.",
            viewMode: "full",
            graph: { resource: "user", dbId: graphDbId },
          },
          position: { x: 0, y: 0 },
        } as any,
      ],
      focusedWindowId: "know-1",
    });

    const { result } = renderHook(() => useFocusedContext(), { wrapper });

    // 1. Should immediately have local context
    expect(result.current.label).toBe("Quantum Physics");
    expect(result.current.content).toContain("Summary: Study of small things.");

    // 2. Should trigger RAG
    await waitFor(() => {
      expect(runQuerySpy).toHaveBeenCalled();
    });

    // Check payload
    const lastCall = runQuerySpy.mock.calls[0][0] as any;
    expect(lastCall).toMatchObject({
      kind: "context",
      nodeId: graphDbId,
    });
    expect(lastCall.text).toContain("Quantum Physics");

    // 3. Should eventually update content with merged results
    await waitFor(() => {
      expect(result.current.content).toContain("[Active RAG Context]");
    });

    // Check Vector Doc
    expect(result.current.content).toContain(
      "- [Vector] Related Doc: Relevant info from RAG."
    );

    // Check Graph Doc
    expect(result.current.content).toContain(
      "- [Graph] Dependent Node: (Graph Edge) DEPENDS_ON Quantum Physics"
    );

    // Check ragDocuments structure
    expect(result.current.ragDocuments).toHaveLength(2);
    expect(result.current.ragDocuments).toContainEqual(
      expect.objectContaining({ label: "Related Doc", source: "vector" })
    );
    expect(result.current.ragDocuments).toContainEqual(
      expect.objectContaining({ label: "Dependent Node", source: "graph" })
    );
  });
});
