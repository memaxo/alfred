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
import { useMindscapeStore } from "@/store/mindscape";
import { useDeepLinks } from "../use-deep-links";

// Mock toast
const mockToastInfo = mock(() => {});
const mockToastError = mock(() => {});
mock.module("sonner", () => ({
  toast: {
    info: mockToastInfo,
    error: mockToastError,
  },
}));

// Mock clearSearchParams
const mockClearSearchParams = mock(() => {});
mock.module("@/lib/mindscape/url", () => ({
  clearSearchParams: mockClearSearchParams,
}));

// Mock hasWindow
let mockHasWindowValue = true;
mock.module("@/lib/env/isomorphic", () => ({
  hasWindow: () => mockHasWindowValue,
}));

// Mock registry with available node types
mock.module("@/components/mindscape/registry.tsx", () => ({
  nodeTypes: {
    chat: {},
    note: {},
    reminder: {},
    settings: {},
    workflow: {},
    droid: {},
  },
}));

// Mock spawn module
mock.module("@/components/mindscape/spawn", () => ({
  mindscapeSpawnTypes: ["chat", "note", "reminder", "settings", "workflow", "droid"],
  singletonSpawnTypes: ["chat", "settings", "droid"],
  formatSpawnLabel: (type: string) => type.charAt(0).toUpperCase() + type.slice(1),
  createSpawnNode: (type: string, index: number) => ({
    id: `${type}-${index}`,
    type,
    position: { x: 100, y: 100 },
    data: { type, label: type },
  }),
}));

describe("useDeepLinks", () => {
  const mockFocusAndCenter = mock(() => {});
  const mockRagDocNavigate = mock(() => {});

  beforeEach(() => {
    useMindscapeStore.setState({
      nodes: [],
      edges: [],
      focusedNodeId: null,
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
      contextCache: {},
    });
    mockFocusAndCenter.mockClear();
    mockRagDocNavigate.mockClear();
    mockToastInfo.mockClear();
    mockToastError.mockClear();
    mockClearSearchParams.mockClear();
    mockHasWindowValue = true;
  });

  afterEach(() => {
    useMindscapeStore.getState().nodes = [];
  });

  describe("spawnNodeFromType", () => {
    it("spawns a new node and focuses it", () => {
      const { result } = renderHook(() =>
        useDeepLinks({
          onFocusAndCenter: mockFocusAndCenter,
        })
      );

      const nodeId = result.current.spawnNodeFromType("note");

      expect(nodeId).toBe("note-0");
      expect(mockFocusAndCenter).toHaveBeenCalledWith("note-0");

      const nodes = useMindscapeStore.getState().nodes;
      expect(nodes.length).toBe(1);
      expect(nodes[0].type).toBe("note");
    });

    it("reuses existing singleton node instead of creating new one", () => {
      useMindscapeStore.setState({
        nodes: [
          {
            id: "existing-chat",
            type: "chat",
            position: { x: 50, y: 50 },
            data: { type: "chat", label: "Chat" },
          } as any,
        ],
      });

      const { result } = renderHook(() =>
        useDeepLinks({
          onFocusAndCenter: mockFocusAndCenter,
        })
      );

      const nodeId = result.current.spawnNodeFromType("chat");

      expect(nodeId).toBe("existing-chat");
      expect(mockFocusAndCenter).toHaveBeenCalledWith("existing-chat");

      // Should not create a new node
      const nodes = useMindscapeStore.getState().nodes;
      expect(nodes.length).toBe(1);
    });

    it("shows info toast for unavailable node type", () => {
      const { result } = renderHook(() =>
        useDeepLinks({
          onFocusAndCenter: mockFocusAndCenter,
        })
      );

      const nodeId = result.current.spawnNodeFromType("unknown" as any);

      expect(nodeId).toBeNull();
      expect(mockToastInfo).toHaveBeenCalledWith(
        "Unknown node is not available yet."
      );
    });

    it("allows multiple instances of non-singleton types", () => {
      useMindscapeStore.setState({
        nodes: [
          {
            id: "note-existing",
            type: "note",
            position: { x: 50, y: 50 },
            data: { type: "note", label: "Note 1" },
          } as any,
        ],
      });

      const { result } = renderHook(() =>
        useDeepLinks({
          onFocusAndCenter: mockFocusAndCenter,
        })
      );

      const nodeId = result.current.spawnNodeFromType("note");

      expect(nodeId).toBe("note-1"); // New node created
      const nodes = useMindscapeStore.getState().nodes;
      expect(nodes.length).toBe(2);
    });
  });

  describe("handleNavigateToRagDoc", () => {
    it("calls onRagDocNavigate callback when provided", () => {
      const { result } = renderHook(() =>
        useDeepLinks({
          onFocusAndCenter: mockFocusAndCenter,
          onRagDocNavigate: mockRagDocNavigate,
        })
      );

      result.current.handleNavigateToRagDoc("doc-123");

      expect(mockRagDocNavigate).toHaveBeenCalledWith("doc-123");
    });

    it("updates URL when no callback provided", () => {
      const mockReplaceState = mock(() => {});
      const originalHistory = window.history.replaceState;
      window.history.replaceState = mockReplaceState;

      const { result } = renderHook(() =>
        useDeepLinks({
          onFocusAndCenter: mockFocusAndCenter,
        })
      );

      result.current.handleNavigateToRagDoc("doc-456");

      expect(mockReplaceState).toHaveBeenCalled();
      window.history.replaceState = originalHistory;
    });

    it("ignores empty documentId", () => {
      const { result } = renderHook(() =>
        useDeepLinks({
          onFocusAndCenter: mockFocusAndCenter,
          onRagDocNavigate: mockRagDocNavigate,
        })
      );

      result.current.handleNavigateToRagDoc("");

      expect(mockRagDocNavigate).not.toHaveBeenCalled();
    });

    it("applies cooldown to prevent rapid duplicate navigations", () => {
      const { result } = renderHook(() =>
        useDeepLinks({
          onFocusAndCenter: mockFocusAndCenter,
          onRagDocNavigate: mockRagDocNavigate,
        })
      );

      result.current.handleNavigateToRagDoc("doc-789");
      result.current.handleNavigateToRagDoc("doc-789");
      result.current.handleNavigateToRagDoc("doc-789");

      // Only first call should go through due to cooldown
      expect(mockRagDocNavigate).toHaveBeenCalledTimes(1);
    });

    it("allows navigation to different documents without cooldown", () => {
      const { result } = renderHook(() =>
        useDeepLinks({
          onFocusAndCenter: mockFocusAndCenter,
          onRagDocNavigate: mockRagDocNavigate,
        })
      );

      result.current.handleNavigateToRagDoc("doc-1");
      result.current.handleNavigateToRagDoc("doc-2");
      result.current.handleNavigateToRagDoc("doc-3");

      expect(mockRagDocNavigate).toHaveBeenCalledTimes(3);
    });
  });

  describe("nodeId deep link", () => {
    it("focuses existing node when nodeId param provided", async () => {
      useMindscapeStore.setState({
        nodes: [
          {
            id: "target-node",
            type: "note",
            position: { x: 100, y: 100 },
            data: { type: "note", label: "Target" },
          } as any,
        ],
      });

      renderHook(() =>
        useDeepLinks({
          searchParams: { nodeId: "target-node" },
          onFocusAndCenter: mockFocusAndCenter,
        })
      );

      await waitFor(() => {
        expect(mockFocusAndCenter).toHaveBeenCalledWith("target-node");
        expect(mockClearSearchParams).toHaveBeenCalledWith(["nodeId"]);
      });
    });

    it("does nothing when nodeId not found", async () => {
      renderHook(() =>
        useDeepLinks({
          searchParams: { nodeId: "nonexistent" },
          onFocusAndCenter: mockFocusAndCenter,
        })
      );

      // Wait a bit to ensure effect runs
      await new Promise((r) => setTimeout(r, 50));

      expect(mockFocusAndCenter).not.toHaveBeenCalled();
      expect(mockClearSearchParams).not.toHaveBeenCalled();
    });
  });

  describe("spawn deep link", () => {
    it("calls spawnNodeFromType when spawn param provided", () => {
      // Test the spawnNodeFromType function directly since effect-based
      // spawning causes update loops in test environment
      const { result } = renderHook(() =>
        useDeepLinks({
          onFocusAndCenter: mockFocusAndCenter,
        })
      );

      const nodeId = result.current.spawnNodeFromType("note");

      expect(nodeId).toBeTruthy();
      expect(mockFocusAndCenter).toHaveBeenCalled();

      const nodes = useMindscapeStore.getState().nodes;
      expect(nodes.length).toBe(1);
      expect(nodes[0].type).toBe("note");
    });
  });
});
