import type { StateCreator } from "zustand";
import type { DesktopState, ViewportSlice } from "./types";

export const createViewportSlice: StateCreator<
  DesktopState,
  [],
  [],
  ViewportSlice
> = (set) => ({
  focusedWindowId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  isSpaceMode: false,

  focusWindow: (windowId) => {
    set({ focusedWindowId: windowId });
  },

  setViewport: (viewport) => {
    set({ viewport });
  },

  setSpaceMode: (isSpaceMode) => {
    set({ isSpaceMode });
  },
});
