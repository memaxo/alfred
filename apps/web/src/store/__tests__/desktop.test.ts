import { beforeEach, describe, expect, it } from "bun:test";

import type { WindowInstance } from "../desktop/types.new";

import { useDesktopStore } from "../desktop";

function createTestWindow(
  id: string,
  type: WindowInstance["type"] = "chat"
): WindowInstance {
  return {
    id,
    type,
    data: { type, viewMode: "full" },
    bounds: { x: 100, y: 100, width: 400, height: 300 },
    state: "normal",
    isTiled: false,
    zIndex: 0,
    isFocused: false,
    minSize: { width: 200, height: 150 },
    resizable: true,
    createdAt: Date.now(),
    lastFocusedAt: Date.now(),
  };
}

describe("useDesktopStore", () => {
  beforeEach(() => {
    useDesktopStore.setState({
      windows: [],
      focusedWindowId: null,
      isSpaceMode: false,
      pinnedApps: ["chat", "terminal", "agents", "workflow", "settings"],
      dockPins: ["chat", "terminal", "agents", "workflow", "settings"],
      zIndexCounter: 0,
    });
  });

  describe("WindowSlice", () => {
    it("adds a window", () => {
      const store = useDesktopStore.getState();
      const window = createTestWindow("test-1", "chat");

      store.addWindow(window);

      const state = useDesktopStore.getState();
      expect(state.windows).toHaveLength(1);
      expect(state.windows[0]?.id).toBe("test-1");
    });

    it("prevents duplicate windows", () => {
      const store = useDesktopStore.getState();
      const window = createTestWindow("test-1", "chat");

      store.addWindow(window);
      store.addWindow(window);

      const state = useDesktopStore.getState();
      expect(state.windows).toHaveLength(1);
    });

    it("removes a window", () => {
      const store = useDesktopStore.getState();
      store.addWindow(createTestWindow("test-1", "chat"));

      store.removeWindow("test-1");

      const state = useDesktopStore.getState();
      expect(state.windows).toHaveLength(0);
    });

    it("updates window data", () => {
      const store = useDesktopStore.getState();
      store.addWindow(createTestWindow("test-1", "chat"));

      store.updateWindowData("test-1", { viewMode: "compact" });

      const state = useDesktopStore.getState();
      expect(state.windows[0]?.data.viewMode).toBe("compact");
    });

    it("opens window with openWindow", () => {
      const store = useDesktopStore.getState();
      const id = store.openWindow("note", { label: "My Note" });

      const state = useDesktopStore.getState();
      expect(state.windows).toHaveLength(1);
      expect(state.windows[0]?.id).toBe(id);
      expect(state.windows[0]?.data.type).toBe("note");
      expect(state.windows[0]?.data.label).toBe("My Note");
    });

    it("closes window with closeWindow", () => {
      const store = useDesktopStore.getState();
      const id = store.openWindow("chat");

      store.closeWindow(id);

      const state = useDesktopStore.getState();
      expect(state.windows).toHaveLength(0);
    });
  });

  describe("ViewportSlice", () => {
    it("focuses a window", () => {
      const store = useDesktopStore.getState();
      store.addWindow(createTestWindow("test-1", "chat"));

      store.focusWindow("test-1");

      const state = useDesktopStore.getState();
      expect(state.focusedWindowId).toBe("test-1");
      expect(state.windows[0]?.isFocused).toBe(true);
    });

    it("blurs a window", () => {
      const store = useDesktopStore.getState();
      store.addWindow(createTestWindow("test-1", "chat"));
      store.focusWindow("test-1");

      store.blurWindow("test-1");

      const state = useDesktopStore.getState();
      expect(state.windows[0]?.isFocused).toBe(false);
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

  describe("TaskbarSlice", () => {
    it("pins an app type", () => {
      const store = useDesktopStore.getState();
      store.pinApp("knowledge");

      const state = useDesktopStore.getState();
      expect(state.pinnedApps).toContain("knowledge");
    });

    it("unpins an app type", () => {
      const store = useDesktopStore.getState();
      store.unpinApp("chat");

      const state = useDesktopStore.getState();
      expect(state.pinnedApps).not.toContain("chat");
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
      expect(state.windows[0]?.bounds.x).toBe(500);
      expect(state.windows[0]?.bounds.y).toBe(300);
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

  describe("Window State Transitions", () => {
    it("minimizes a window", () => {
      const store = useDesktopStore.getState();
      store.addWindow(createTestWindow("test-1", "chat"));

      store.minimizeWindow("test-1");

      const state = useDesktopStore.getState();
      expect(state.windows[0]?.state).toBe("minimized");
    });

    it("maximizes a window", () => {
      const store = useDesktopStore.getState();
      store.addWindow(createTestWindow("test-1", "chat"));
      useDesktopStore.setState({
        desktopArea: { x: 0, y: 32, width: 1920, height: 1000 },
      });

      store.maximizeWindow("test-1");

      const state = useDesktopStore.getState();
      expect(state.windows[0]?.state).toBe("maximized");
    });

    it("restores a window from maximized", () => {
      const store = useDesktopStore.getState();
      const originalWindow = createTestWindow("test-1", "chat");
      store.addWindow(originalWindow);
      useDesktopStore.setState({
        desktopArea: { x: 0, y: 32, width: 1920, height: 1000 },
      });

      store.maximizeWindow("test-1");
      store.restoreWindow("test-1");

      const state = useDesktopStore.getState();
      expect(state.windows[0]?.state).toBe("normal");
    });
  });

  describe("Window Geometry", () => {
    it("moves a window", () => {
      const store = useDesktopStore.getState();
      store.addWindow(createTestWindow("test-1", "chat"));

      store.moveWindow("test-1", { x: 200, y: 150 });

      const state = useDesktopStore.getState();
      expect(state.windows[0]?.bounds.x).toBe(200);
      expect(state.windows[0]?.bounds.y).toBe(150);
    });

    it("resizes a window", () => {
      const store = useDesktopStore.getState();
      store.addWindow(createTestWindow("test-1", "chat"));

      store.resizeWindow("test-1", { width: 600, height: 500 });

      const state = useDesktopStore.getState();
      expect(state.windows[0]?.bounds.width).toBe(600);
      expect(state.windows[0]?.bounds.height).toBe(500);
    });

    it("respects minimum size constraints", () => {
      const store = useDesktopStore.getState();
      store.addWindow(createTestWindow("test-1", "chat"));

      store.resizeWindow("test-1", { width: 50, height: 50 });

      const state = useDesktopStore.getState();
      expect(state.windows[0]?.bounds.width).toBe(200); // minSize.width
      expect(state.windows[0]?.bounds.height).toBe(150); // minSize.height
    });

    it("sets bounds directly", () => {
      const store = useDesktopStore.getState();
      store.addWindow(createTestWindow("test-1", "chat"));

      store.setBounds("test-1", { x: 50, y: 60, width: 700, height: 550 });

      const state = useDesktopStore.getState();
      expect(state.windows[0]?.bounds).toEqual({
        x: 50,
        y: 60,
        width: 700,
        height: 550,
      });
    });
  });
});
