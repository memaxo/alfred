/**
 * Viewport Slice - Phase 0 Migration (Adapted for Desktop Mode)
 *
 * This slice manages the desktop viewport and mode switching between
 * traditional desktop view and Mindscape infinite canvas.
 *
 * @see docs/execplans/desktop-type-migration.md Section 2.3
 */

import type { StateCreator } from "zustand";

import type {
  DesktopArea,
  DesktopMode,
  DesktopState,
  ViewportSlice,
} from "./types.new";

const DEFAULT_DESKTOP_AREA: DesktopArea = {
  x: 0,
  y: 32, // Menu bar height
  width: typeof window !== "undefined" ? window.innerWidth : 1920,
  height: typeof window !== "undefined" ? window.innerHeight - 32 - 48 : 1000, // Minus menu bar and taskbar
};

export const createViewportSliceNew: StateCreator<
  DesktopState,
  [],
  [],
  ViewportSlice
> = (set, get) => ({
  mode: "desktop",
  desktopArea: DEFAULT_DESKTOP_AREA,
  focusedWindowId: null,
  onboardingCompleted: false,

  // Legacy compatibility
  isSpaceMode: false,

  // ─────────────────────────────────────────────────────────────────────────
  // MODE SWITCHING
  // ─────────────────────────────────────────────────────────────────────────

  setMode: (mode: DesktopMode) => {
    set({
      mode,
      isSpaceMode: mode === "mindscape", // Legacy compatibility
    });
  },

  toggleMindscape: () => {
    const { mode } = get();
    const newMode = mode === "desktop" ? "mindscape" : "desktop";
    set({
      mode: newMode,
      isSpaceMode: newMode === "mindscape",
    });
  },

  setOnboardingCompleted: (onboardingCompleted: boolean) => {
    set({ onboardingCompleted });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DESKTOP AREA
  // ─────────────────────────────────────────────────────────────────────────

  setDesktopArea: (area: DesktopArea) => {
    set({ desktopArea: area });
    // Recalculate tiling zones when area changes
    get().calculateZones?.();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FOCUS MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  setFocusedWindow: (windowId: string | null) => {
    set({ focusedWindowId: windowId });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LEGACY COMPATIBILITY
  // ─────────────────────────────────────────────────────────────────────────

  setSpaceMode: (isSpaceMode: boolean) => {
    set({
      isSpaceMode,
      mode: isSpaceMode ? "mindscape" : "desktop",
    });
  },
});
