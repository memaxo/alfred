import type { PersistOptions } from "zustand/middleware";
import type { DesktopState, WindowData, WindowInstance } from "./types";

function sanitizeWindowForPersist(window: WindowInstance): WindowInstance {
  return {
    id: window.id,
    type: window.type,
    position: window.position,
    dragging: false,
    data: sanitizeWindowData(window.data),
    draggable: window.draggable,
    height: window.height,
    width: window.width,
    selectable: window.selectable,
  };
}

function sanitizeWindowData(data: WindowData): WindowData {
  return {
    type: data.type,
    label: data.label,
    resourceRef: data.resourceRef,
    viewMode: data.viewMode,
  };
}

export const persistOptions: PersistOptions<DesktopState> = {
  name: "desktop-layout-v1",
  version: 1,
  partialize: (state) =>
    ({
      windows: state.windows.map(sanitizeWindowForPersist),
      edges: state.edges.filter((e) => !e.data?.scope),
      focusedWindowId: state.focusedWindowId,
      isSpaceMode: state.isSpaceMode,
      dockPins: state.dockPins,
    }) as unknown as DesktopState,
  migrate: (persistedState, version) => {
    if (version === 0) {
      return persistedState as DesktopState;
    }
    return persistedState as DesktopState;
  },
};
