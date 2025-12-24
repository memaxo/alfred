import { beforeEach, describe, expect, it } from "bun:test";
import { useDesktopStore } from "../desktop";
import type { WindowInstance } from "../desktop/types";

describe("useDesktopStore", () => {
  beforeEach(() => {
    useDesktopStore.setState({
      windows: [],
      edges: [],
      activeEdges: new Set(),
      highlightedEdgeIds: new Set(),
      focusedWindowId: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      isSpaceMode: false,
      dockPins: ["chat", "terminal", "note", "workflow", "droid"],
    });
  });

  describe("WindowSlice", () => {
    it("adds a window", () => {
      const store = useDesktopStore.getState();
      const window: WindowInstance = {
        id: "test-1",
        type: "chat",
        position: { x: 100, y: 100 },
        data: { type: "chat", viewMode: "full" },
      };

      store.addWindow(window);

      const state = useDesktopStore.getState();
      expect(state.windows).toHaveLength(1);
      expect(state.windows[0]?.id).toBe("test-1");
    });

    it("prevents duplicate windows", () => {
      const store = useDesktopStore.getState();
      const window: WindowInstance = {
        id: "test-1",
        type: "chat",
        position: { x: 100, y: 100 },
        data: { type: "chat", viewMode: "full" },
      };

      store.addWindow(window);
      store.addWindow(window);

      const state = useDesktopStore.getState();
      expect(state.windows).toHaveLength(1);
    });

    it("removes a window", () => {
      const store = useDesktopStore.getState();
      store.addWindow({
        id: "test-1",
        type: "chat",
        position: { x: 0, y: 0 },
        data: { type: "chat", viewMode: "full" },
      });

      store.removeWindow("test-1");

      const state = useDesktopStore.getState();
      expect(state.windows).toHaveLength(0);
    });

    it("removes edges when window is removed", () => {
      const store = useDesktopStore.getState();
      store.addWindow({
        id: "win-1",
        type: "chat",
        position: { x: 0, y: 0 },
        data: { type: "chat", viewMode: "full" },
      });
      store.addWindow({
        id: "win-2",
        type: "note",
        position: { x: 200, y: 0 },
        data: { type: "note", viewMode: "full" },
      });
      store.setEdges([
        { id: "e1", source: "win-1", target: "win-2" },
        { id: "e2", source: "win-2", target: "win-1" },
      ]);

      store.removeWindow("win-1");

      const state = useDesktopStore.getState();
      expect(state.edges).toHaveLength(0);
    });

    it("updates window data", () => {
      const store = useDesktopStore.getState();
      store.addWindow({
        id: "test-1",
        type: "chat",
        position: { x: 0, y: 0 },
        data: { type: "chat", viewMode: "full" },
      });

      store.updateWindow("test-1", { viewMode: "compact" });

      const state = useDesktopStore.getState();
      expect(state.windows[0]?.data.viewMode).toBe("compact");
    });
  });

  describe("ViewportSlice", () => {
    it("focuses a window", () => {
      const store = useDesktopStore.getState();
      store.addWindow({
        id: "test-1",
        type: "chat",
        position: { x: 0, y: 0 },
        data: { type: "chat", viewMode: "full" },
      });

      store.focusWindow("test-1");

      const state = useDesktopStore.getState();
      expect(state.focusedWindowId).toBe("test-1");
    });

    it("clears focus with null", () => {
      const store = useDesktopStore.getState();
      store.focusWindow("test-1");
      store.focusWindow(null);

      const state = useDesktopStore.getState();
      expect(state.focusedWindowId).toBeNull();
    });

    it("sets viewport", () => {
      const store = useDesktopStore.getState();
      store.setViewport({ x: 100, y: 200, zoom: 0.5 });

      const state = useDesktopStore.getState();
      expect(state.viewport).toEqual({ x: 100, y: 200, zoom: 0.5 });
    });

    it("toggles space mode", () => {
      const store = useDesktopStore.getState();
      expect(store.isSpaceMode).toBe(false);

      store.setSpaceMode(true);
      expect(useDesktopStore.getState().isSpaceMode).toBe(true);

      store.setSpaceMode(false);
      expect(useDesktopStore.getState().isSpaceMode).toBe(false);
    });
  });

  describe("DockSlice", () => {
    it("pins a window type", () => {
      const store = useDesktopStore.getState();
      store.pinType("reminder");

      const state = useDesktopStore.getState();
      expect(state.dockPins).toContain("reminder");
    });

    it("unpins a window type", () => {
      const store = useDesktopStore.getState();
      store.unpinType("chat");

      const state = useDesktopStore.getState();
      expect(state.dockPins).not.toContain("chat");
    });

    it("spawns a new window", () => {
      const store = useDesktopStore.getState();
      const windowId = store.spawnWindow("note");

      const state = useDesktopStore.getState();
      expect(state.windows).toHaveLength(1);
      expect(state.windows[0]?.id).toBe(windowId);
      expect(state.windows[0]?.data.type).toBe("note");
    });

    it("spawns window at specified position", () => {
      const store = useDesktopStore.getState();
      store.spawnWindow("note", undefined, { x: 500, y: 300 });

      const state = useDesktopStore.getState();
      expect(state.windows[0]?.position).toEqual({ x: 500, y: 300 });
    });

    it("spawns window with resource reference", () => {
      const store = useDesktopStore.getState();
      store.spawnWindow("note", { type: "note", id: "note-123" });

      const state = useDesktopStore.getState();
      expect(state.windows[0]?.data.resourceRef).toEqual({
        type: "note",
        id: "note-123",
      });
    });
  });

  describe("Edge management", () => {
    it("sets edges", () => {
      const store = useDesktopStore.getState();
      store.setEdges([
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "c" },
      ]);

      const state = useDesktopStore.getState();
      expect(state.edges).toHaveLength(2);
    });

    it("sets highlighted edges", () => {
      const store = useDesktopStore.getState();
      store.setHighlightedEdges(["e1", "e2"]);

      const state = useDesktopStore.getState();
      expect(state.highlightedEdgeIds.has("e1")).toBe(true);
      expect(state.highlightedEdgeIds.has("e2")).toBe(true);
    });

    it("triggers edge activity", async () => {
      const store = useDesktopStore.getState();
      store.triggerEdgeActivity("e1", 100);

      expect(useDesktopStore.getState().activeEdges.has("e1")).toBe(true);

      await new Promise((r) => setTimeout(r, 150));
      expect(useDesktopStore.getState().activeEdges.has("e1")).toBe(false);
    });
  });
});
