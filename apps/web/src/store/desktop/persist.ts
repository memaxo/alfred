import type { PersistOptions } from "zustand/middleware";
import type { DesktopState, WindowData, WindowInstance } from "./types.new";

/** Shared storage identifier for desktop layout persistence */
export const DESKTOP_STORAGE_ID = "desktop-layout-v1";

function sanitizeWindowForPersist(window: WindowInstance): WindowInstance {
  return {
    id: window.id,
    type: window.type,
    bounds: window.bounds,
    state: window.state,
    isTiled: window.isTiled,
    tileZone: window.tileZone,
    zIndex: window.zIndex,
    isFocused: window.isFocused,
    minSize: window.minSize,
    resizable: window.resizable,
    createdAt: window.createdAt,
    lastFocusedAt: window.lastFocusedAt,
    data: sanitizeWindowData(window.data),
  };
}

function sanitizeWindowData(data: WindowData | undefined): WindowData {
  if (!data) {
    return { type: "chat", viewMode: "full" };
  }
  return {
    type: data.type,
    label: data.label,
    resourceRef: data.resourceRef,
    viewMode: data.viewMode,
  };
}

export const persistOptions: PersistOptions<DesktopState> = {
  name: DESKTOP_STORAGE_ID,
  version: 3,
  partialize: (state) =>
    ({
      // Layout state (persisted)
      windows: state.windows.map(sanitizeWindowForPersist),
      focusedWindowId: state.focusedWindowId,
      isSpaceMode: state.isSpaceMode,
      pinnedApps: state.pinnedApps,
      mode: state.mode,
      config: state.config,
      // Context/feedback state (persisted, small footprint)
      contextCache: state.contextCache,
      feedbackByWindow: state.feedbackByWindow,
      // Note: ragDocCache is NOT persisted - it's ephemeral and can be large
    }) as unknown as DesktopState,
  migrate: (persistedState, version) => {
    if (version < 3) {
      // Migration from v1/v2: restructure for new type system
      const oldState = persistedState as Record<string, unknown>;
      return {
        ...oldState,
        contextCache: {},
        feedbackByWindow: {},
        pinnedApps: (oldState.dockPins as string[] | undefined) ?? [
          "chat",
          "terminal",
          "agents",
          "workflow",
          "settings",
        ],
        mode: "desktop",
        config: {
          layout: "float",
          gap: 8,
          mainRatio: 0.6,
          respectMinSize: true,
        },
      } as unknown as DesktopState;
    }
    return persistedState as DesktopState;
  },
};
