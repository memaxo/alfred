/**
 * Desktop Store Selectors
 *
 * Memoized selectors for optimized state access.
 * Use these instead of inline selectors for better performance.
 */

import type { DesktopState, WindowInstance, WindowType } from "./types.new";

// Window selectors
export const selectWindows = (state: DesktopState): WindowInstance[] =>
  state.windows;

export const selectWindowById = (
  state: DesktopState,
  id: string
): WindowInstance | undefined => state.windows.find((w) => w.id === id);

export const selectWindowsByType = (
  state: DesktopState,
  type: WindowType
): WindowInstance[] => state.windows.filter((w) => w.data.type === type);

export const selectWindowCount = (state: DesktopState): number =>
  state.windows.length;

// Viewport selectors
export const selectDesktopMode = (state: DesktopState) => state.mode;

export const selectDesktopArea = (state: DesktopState) => state.desktopArea;

export const selectFocusedWindowId = (state: DesktopState): string | null =>
  state.focusedWindowId;

export const selectFocusedWindow = (
  state: DesktopState
): WindowInstance | undefined => {
  if (!state.focusedWindowId) {
    return;
  }
  return state.windows.find((w) => w.id === state.focusedWindowId);
};

export const selectIsSpaceMode = (state: DesktopState): boolean =>
  state.isSpaceMode;

// Taskbar selectors
export const selectPinnedApps = (state: DesktopState): WindowType[] =>
  state.pinnedApps;

export const selectIsPinned = (
  state: DesktopState,
  type: WindowType
): boolean => state.pinnedApps.includes(type);

// Composite selectors
export const selectWindowWithEdges = (
  state: DesktopState,
  windowId: string
): { window: WindowInstance | undefined } => ({
  window: selectWindowById(state, windowId),
});

// Performance selectors
export const selectStats = (
  state: DesktopState
): {
  windowCount: number;
  focusedWindowId: string | null;
} => ({
  windowCount: state.windows.length,
  focusedWindowId: state.focusedWindowId,
});

// Tiling selectors
export const selectTilingConfig = (state: DesktopState) => state.config;

export const selectTilingZones = (state: DesktopState) => state.zones;

export const selectActiveTilePreview = (state: DesktopState) =>
  state.activeTilePreview;
