import type { PersistOptions } from "zustand/middleware";
import type { DesktopState, WindowData, WindowInstance } from "./types";

/** Shared storage identifier for desktop layout persistence */
export const DESKTOP_STORAGE_ID = "desktop-layout-v1";

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
  name: DESKTOP_STORAGE_ID,
  version: 2,
  partialize: (state) =>
    ({
      // Layout state (persisted)
      windows: state.windows.map(sanitizeWindowForPersist),
      edges: state.edges.filter((e) => !e.data?.scope),
      focusedWindowId: state.focusedWindowId,
      isSpaceMode: state.isSpaceMode,
      dockPins: state.dockPins,
      // Context/feedback state (persisted, small footprint)
      contextCache: state.contextCache,
      feedbackByWindow: state.feedbackByWindow,
      // Note: ragDocCache is NOT persisted - it's ephemeral and can be large
    }) as unknown as DesktopState,
  migrate: (persistedState, version) => {
    if (version === 1) {
      // Migration from v1: add empty context/feedback
      return {
        ...(persistedState as DesktopState),
        contextCache: {},
        feedbackByWindow: {},
      };
    }
    return persistedState as DesktopState;
  },
};
