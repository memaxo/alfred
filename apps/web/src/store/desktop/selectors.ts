/**
 * Desktop Store Selectors
 *
 * Memoized selectors for optimized state access.
 * Use these instead of inline selectors for better performance.
 */

import type {
  DesktopEdge,
  DesktopState,
  WindowInstance,
  WindowType,
} from "./types";

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

// Edge selectors
export const selectEdges = (state: DesktopState): DesktopEdge[] => state.edges;

export const selectEdgeById = (
  state: DesktopState,
  id: string
): DesktopEdge | undefined => state.edges.find((e) => e.id === id);

export const selectEdgesForWindow = (
  state: DesktopState,
  windowId: string
): DesktopEdge[] =>
  state.edges.filter((e) => e.source === windowId || e.target === windowId);

export const selectEdgeCount = (state: DesktopState): number =>
  state.edges.length;

export const selectActiveEdges = (state: DesktopState): Set<string> =>
  state.activeEdges;

export const selectHighlightedEdgeIds = (state: DesktopState): Set<string> =>
  state.highlightedEdgeIds;

// Viewport selectors
export const selectViewport = (state: DesktopState) => state.viewport;

export const selectZoom = (state: DesktopState): number => state.viewport.zoom;

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

// Dock selectors
export const selectDockPins = (state: DesktopState): WindowType[] =>
  state.dockPins;

export const selectIsPinned = (
  state: DesktopState,
  type: WindowType
): boolean => state.dockPins.includes(type);

// Composite selectors
export const selectWindowWithEdges = (
  state: DesktopState,
  windowId: string
): { window: WindowInstance | undefined; edges: DesktopEdge[] } => ({
  window: selectWindowById(state, windowId),
  edges: selectEdgesForWindow(state, windowId),
});

// Performance selectors
export const selectStats = (
  state: DesktopState
): {
  windowCount: number;
  edgeCount: number;
  focusedWindowId: string | null;
} => ({
  windowCount: state.windows.length,
  edgeCount: state.edges.length,
  focusedWindowId: state.focusedWindowId,
});
