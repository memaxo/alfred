import { beforeEach, describe, expect, it } from "bun:test";
import { useDesktopStore } from "../desktop";
import {
  selectEdgeById,
  selectEdgeCount,
  selectEdges,
  selectEdgesForWindow,
  selectFocusedWindow,
  selectFocusedWindowId,
  selectStats,
  selectWindowById,
  selectWindowCount,
  selectWindows,
  selectWindowsByType,
  selectWindowWithEdges,
  selectZoom,
} from "../desktop/selectors";

describe("Desktop Store Selectors", () => {
  beforeEach(() => {
    useDesktopStore.setState({
      windows: [
        {
          id: "win-1",
          type: "chat",
          position: { x: 0, y: 0 },
          data: { type: "chat", viewMode: "full" },
        },
        {
          id: "win-2",
          type: "note",
          position: { x: 100, y: 0 },
          data: { type: "note", viewMode: "full" },
        },
        {
          id: "win-3",
          type: "note",
          position: { x: 200, y: 0 },
          data: { type: "note", viewMode: "compact" },
        },
      ],
      edges: [
        { id: "e1", source: "win-1", target: "win-2" },
        { id: "e2", source: "win-2", target: "win-3" },
      ],
      activeEdges: new Set(["e1"]),
      highlightedEdgeIds: new Set(),
      focusedWindowId: "win-1",
      viewport: { x: 0, y: 0, zoom: 0.75 },
      isSpaceMode: false,
      dockPins: ["chat", "note"],
    });
  });

  describe("Window selectors", () => {
    it("selectWindows returns all windows", () => {
      const state = useDesktopStore.getState();
      const windows = selectWindows(state);
      expect(windows).toHaveLength(3);
    });

    it("selectWindowById returns correct window", () => {
      const state = useDesktopStore.getState();
      const window = selectWindowById(state, "win-2");
      expect(window?.id).toBe("win-2");
      expect(window?.data.type).toBe("note");
    });

    it("selectWindowById returns undefined for missing window", () => {
      const state = useDesktopStore.getState();
      const window = selectWindowById(state, "nonexistent");
      expect(window).toBeUndefined();
    });

    it("selectWindowsByType filters by type", () => {
      const state = useDesktopStore.getState();
      const notes = selectWindowsByType(state, "note");
      expect(notes).toHaveLength(2);
      expect(notes.every((w) => w.data.type === "note")).toBe(true);
    });

    it("selectWindowCount returns correct count", () => {
      const state = useDesktopStore.getState();
      expect(selectWindowCount(state)).toBe(3);
    });
  });

  describe("Edge selectors", () => {
    it("selectEdges returns all edges", () => {
      const state = useDesktopStore.getState();
      const edges = selectEdges(state);
      expect(edges).toHaveLength(2);
    });

    it("selectEdgeById returns correct edge", () => {
      const state = useDesktopStore.getState();
      const edge = selectEdgeById(state, "e1");
      expect(edge?.source).toBe("win-1");
      expect(edge?.target).toBe("win-2");
    });

    it("selectEdgesForWindow returns connected edges", () => {
      const state = useDesktopStore.getState();
      const edges = selectEdgesForWindow(state, "win-2");
      expect(edges).toHaveLength(2); // e1 (target) and e2 (source)
    });

    it("selectEdgeCount returns correct count", () => {
      const state = useDesktopStore.getState();
      expect(selectEdgeCount(state)).toBe(2);
    });
  });

  describe("Viewport selectors", () => {
    it("selectZoom returns current zoom", () => {
      const state = useDesktopStore.getState();
      expect(selectZoom(state)).toBe(0.75);
    });

    it("selectFocusedWindowId returns focused ID", () => {
      const state = useDesktopStore.getState();
      expect(selectFocusedWindowId(state)).toBe("win-1");
    });

    it("selectFocusedWindow returns focused window", () => {
      const state = useDesktopStore.getState();
      const window = selectFocusedWindow(state);
      expect(window?.id).toBe("win-1");
    });

    it("selectFocusedWindow returns undefined when nothing focused", () => {
      useDesktopStore.setState({ focusedWindowId: null });
      const state = useDesktopStore.getState();
      expect(selectFocusedWindow(state)).toBeUndefined();
    });
  });

  describe("Composite selectors", () => {
    it("selectWindowWithEdges returns window and its edges", () => {
      const state = useDesktopStore.getState();
      const { window, edges } = selectWindowWithEdges(state, "win-2");
      expect(window?.id).toBe("win-2");
      expect(edges).toHaveLength(2);
    });

    it("selectStats returns aggregated stats", () => {
      const state = useDesktopStore.getState();
      const stats = selectStats(state);
      expect(stats.windowCount).toBe(3);
      expect(stats.edgeCount).toBe(2);
      expect(stats.focusedWindowId).toBe("win-1");
    });
  });
});
