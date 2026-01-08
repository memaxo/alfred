import { beforeEach, describe, expect, it } from "bun:test";
import { useDesktopStore } from "../desktop";
import {
  selectFocusedWindow,
  selectFocusedWindowId,
  selectIsPinned,
  selectIsSpaceMode,
  selectPinnedApps,
  selectStats,
  selectWindowById,
  selectWindowCount,
  selectWindows,
  selectWindowsByType,
  selectWindowWithEdges,
} from "../desktop/selectors";
import type { WindowInstance } from "../desktop/types.new";

function createTestWindow(
  id: string,
  type: WindowInstance["type"] = "chat",
  viewMode: "full" | "compact" = "full"
): WindowInstance {
  return {
    id,
    type,
    data: { type, viewMode },
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

describe("Desktop Store Selectors", () => {
  beforeEach(() => {
    useDesktopStore.setState({
      windows: [
        createTestWindow("win-1", "chat"),
        createTestWindow("win-2", "note"),
        createTestWindow("win-3", "note", "compact"),
      ],
      focusedWindowId: "win-1",
      isSpaceMode: false,
      pinnedApps: ["chat", "note"],
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

  describe("Viewport selectors", () => {
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

    it("selectIsSpaceMode returns current mode", () => {
      const state = useDesktopStore.getState();
      expect(selectIsSpaceMode(state)).toBe(false);

      useDesktopStore.setState({ isSpaceMode: true });
      expect(selectIsSpaceMode(useDesktopStore.getState())).toBe(true);
    });
  });

  describe("Taskbar selectors", () => {
    it("selectPinnedApps returns pinned apps", () => {
      const state = useDesktopStore.getState();
      const pinned = selectPinnedApps(state);
      expect(pinned).toContain("chat");
      expect(pinned).toContain("note");
    });

    it("selectIsPinned returns true for pinned type", () => {
      const state = useDesktopStore.getState();
      expect(selectIsPinned(state, "chat")).toBe(true);
      expect(selectIsPinned(state, "knowledge")).toBe(false);
    });
  });

  describe("Composite selectors", () => {
    it("selectWindowWithEdges returns window", () => {
      const state = useDesktopStore.getState();
      const { window } = selectWindowWithEdges(state, "win-2");
      expect(window?.id).toBe("win-2");
    });

    it("selectStats returns aggregated stats", () => {
      const state = useDesktopStore.getState();
      const stats = selectStats(state);
      expect(stats.windowCount).toBe(3);
      expect(stats.focusedWindowId).toBe("win-1");
    });
  });
});
