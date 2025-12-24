import "@/test/dom";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useDesktopStore } from "@/store/desktop";
import type { WindowInstance } from "@/store/desktop/types";
import {
  createTestQueryClient,
  createTestTrpcClient,
  type TestTrpcHandlers,
} from "@/test/render-route";
import { trpc } from "@/utils/trpc";
import { useFocusedContext } from "../use-focused-context";

// Inline performance helper
async function withBudget<T>(
  _name: string,
  budgetMs: number,
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number; withinBudget: boolean }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs, withinBudget: durationMs <= budgetMs };
}

function createTestWindow(
  id: string,
  type: string,
  data: Record<string, unknown> = {}
): WindowInstance {
  return {
    id,
    type,
    position: { x: 100, y: 100 },
    data: {
      type: type as any,
      label: (data.label as string) ?? `Test ${type}`,
      viewMode: "full",
      ...data,
    },
  };
}

function createWrapper(handlers: TestTrpcHandlers = {}) {
  const queryClient = createTestQueryClient();
  const trpcClient = createTestTrpcClient({
    queries: {
      "assistant.getConfig": () => ({ contextWindow: 128_000 }),
      "graph.runQuery": () => ({ nodes: [], edges: [] }),
      ...handlers.queries,
    },
    mutations: {
      "graph.runQuery": () => ({ nodes: [], edges: [] }),
      ...handlers.mutations,
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

describe("Desktop Context Flow Integration", () => {
  beforeEach(() => {
    // Reset store
    useDesktopStore.setState({
      windows: [],
      edges: [],
      focusedWindowId: null,
      contextCache: {},
      feedbackByWindow: {},
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
      activeEdges: new Set(),
      highlightedEdgeIds: new Set(),
      viewport: { x: 0, y: 0, zoom: 1 },
      isSpaceMode: false,
      dockPins: ["chat", "note"],
    });
  });

  afterEach(() => {
    useDesktopStore.setState({
      windows: [],
      edges: [],
      focusedWindowId: null,
      contextCache: {},
    });
  });

  describe("focus → context extraction", () => {
    it("returns empty context when no window focused", () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useFocusedContext(), { wrapper });

      expect(result.current.content).toBeNull();
      expect(result.current.nodeType).toBeNull();
      expect(result.current.label).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("extracts content from focused note window", async () => {
      const wrapper = createWrapper();

      // Add and focus a note window
      act(() => {
        useDesktopStore.getState().addWindow(
          createTestWindow("note-1", "note", {
            label: "My Note",
            content: "This is the note content",
          })
        );
        useDesktopStore.getState().focusWindow("note-1");
      });

      const { result } = renderHook(() => useFocusedContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.label).toBe("My Note");
      });

      expect(result.current.content).toBe("This is the note content");
      expect(result.current.nodeType).toBe("note");
    });

    it("extracts summary from focused window", async () => {
      const wrapper = createWrapper();

      act(() => {
        useDesktopStore.getState().addWindow(
          createTestWindow("knowledge-1", "knowledge", {
            label: "Quantum Physics",
            summary: "Study of subatomic particles",
          })
        );
        useDesktopStore.getState().focusWindow("knowledge-1");
      });

      const { result } = renderHook(() => useFocusedContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.content).toContain("Summary: Study of subatomic particles");
      });
    });

    it("extracts description from focused window", async () => {
      const wrapper = createWrapper();

      act(() => {
        useDesktopStore.getState().addWindow(
          createTestWindow("concept-1", "concept", {
            label: "Relativity",
            description: "Einstein's theory of space-time",
          })
        );
        useDesktopStore.getState().focusWindow("concept-1");
      });

      const { result } = renderHook(() => useFocusedContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.content).toContain("Description: Einstein's theory");
      });
    });
  });

  describe("chat window → connected context", () => {
    it("resolves to connected window when chat is focused", async () => {
      const wrapper = createWrapper();

      // Add chat and knowledge windows with edge
      act(() => {
        useDesktopStore.getState().addWindow(
          createTestWindow("chat-1", "chat", { label: "Chat" })
        );
        useDesktopStore.getState().addWindow(
          createTestWindow("knowledge-1", "knowledge", {
            label: "Topic",
            summary: "Connected topic content",
          })
        );
        useDesktopStore.getState().setEdges([
          {
            id: "edge-1",
            source: "chat-1",
            target: "knowledge-1",
            type: "default",
          },
        ]);
        useDesktopStore.getState().focusWindow("chat-1");
      });

      const { result } = renderHook(() => useFocusedContext(), { wrapper });

      // Should resolve to the connected knowledge window
      await waitFor(() => {
        expect(result.current.label).toBe("Topic");
      });

      expect(result.current.content).toContain("Connected topic content");
    });
  });

  describe("context cache population", () => {
    it("records context receipt in store", async () => {
      const wrapper = createWrapper();

      act(() => {
        useDesktopStore.getState().addWindow(
          createTestWindow("note-1", "note", { label: "Test" })
        );
        useDesktopStore.getState().focusWindow("note-1");
      });

      renderHook(() => useFocusedContext(), { wrapper });

      // Manually record context (simulating what happens after RAG)
      act(() => {
        useDesktopStore.getState().recordContextReceipt("note-1", {
          focusedGraphNodeId: "graph-123",
          ragDocIds: ["doc-1", "doc-2"],
          timestamp: Date.now(),
        });
      });

      const cache = useDesktopStore.getState().contextCache;
      expect(cache["note-1"]).toBeDefined();
      expect(cache["note-1"]?.ragDocIds).toContain("doc-1");
    });

    it("clears context cache on window removal", async () => {
      act(() => {
        useDesktopStore.getState().addWindow(
          createTestWindow("note-1", "note", { label: "Test" })
        );
        useDesktopStore.getState().recordContextReceipt("note-1", {
          focusedGraphNodeId: "graph-123",
          ragDocIds: ["doc-1"],
          timestamp: Date.now(),
        });
      });

      expect(useDesktopStore.getState().contextCache["note-1"]).toBeDefined();

      act(() => {
        useDesktopStore.getState().removeWindow("note-1");
        useDesktopStore.getState().clearContextReceipt("note-1");
      });

      expect(useDesktopStore.getState().contextCache["note-1"]).toBeUndefined();
    });
  });

  describe("feedback recording", () => {
    it("records positive feedback for window", () => {
      act(() => {
        useDesktopStore.getState().addWindow(
          createTestWindow("note-1", "note")
        );
        useDesktopStore.getState().recordFeedback("note-1", "positive");
      });

      const feedback = useDesktopStore.getState().feedbackByWindow["note-1"];
      expect(feedback).toBeDefined();
      expect(feedback?.intent).toBe("positive");
      expect(feedback?.updatedAt).toBeDefined();
    });

    it("records negative feedback for window", () => {
      act(() => {
        useDesktopStore.getState().addWindow(
          createTestWindow("note-1", "note")
        );
        useDesktopStore.getState().recordFeedback("note-1", "negative");
      });

      const feedback = useDesktopStore.getState().feedbackByWindow["note-1"];
      expect(feedback?.intent).toBe("negative");
    });
  });

  describe("performance", () => {
    it("extracts context within budget for simple window", async () => {
      const wrapper = createWrapper();

      act(() => {
        useDesktopStore.getState().addWindow(
          createTestWindow("note-1", "note", {
            label: "Test Note",
            content: "Simple content",
          })
        );
        useDesktopStore.getState().focusWindow("note-1");
      });

      const { withinBudget } = await withBudget(
        "context-extraction",
        16, // 16ms (frame budget)
        async () => {
          const { result } = renderHook(() => useFocusedContext(), { wrapper });
          await waitFor(() => {
            expect(result.current.label).toBe("Test Note");
          });
          return result.current;
        }
      );

      expect(withinBudget).toBe(true);
    });

    it("handles rapid focus changes", async () => {
      const wrapper = createWrapper();

      // Add multiple windows
      act(() => {
        for (let i = 0; i < 10; i++) {
          useDesktopStore.getState().addWindow(
            createTestWindow(`note-${i}`, "note", {
              label: `Note ${i}`,
              content: `Content ${i}`,
            })
          );
        }
      });

      const { result } = renderHook(() => useFocusedContext(), { wrapper });

      // Rapidly change focus
      for (let i = 0; i < 10; i++) {
        act(() => {
          useDesktopStore.getState().focusWindow(`note-${i}`);
        });
      }

      // Should settle on last focused
      await waitFor(() => {
        expect(result.current.label).toBe("Note 9");
      });
    });
  });

  describe("edge cases", () => {
    it("handles window with no data gracefully", async () => {
      const wrapper = createWrapper();

      act(() => {
        useDesktopStore.getState().addWindow({
          id: "empty-1",
          type: "note",
          position: { x: 0, y: 0 },
          data: {
            type: "note",
            viewMode: "full",
          },
        });
        useDesktopStore.getState().focusWindow("empty-1");
      });

      const { result } = renderHook(() => useFocusedContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.nodeType).toBe("note");
      });

      // Should have fallback label
      expect(result.current.label).toBeDefined();
    });

    it("handles deleted window while focused", async () => {
      const wrapper = createWrapper();

      act(() => {
        useDesktopStore.getState().addWindow(
          createTestWindow("note-1", "note", { label: "Test" })
        );
        useDesktopStore.getState().focusWindow("note-1");
      });

      const { result } = renderHook(() => useFocusedContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.label).toBe("Test");
      });

      // Delete the window
      act(() => {
        useDesktopStore.getState().removeWindow("note-1");
      });

      // Should return empty context
      await waitFor(() => {
        expect(result.current.content).toBeNull();
      });
    });
  });
});
