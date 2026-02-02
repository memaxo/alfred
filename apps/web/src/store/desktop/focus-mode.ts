/**
 * Focus Mode Slice - Distraction-free productivity state
 *
 * Manages focus mode state for single-window fullscreen mode.
 *
 * @see docs/execplans/desktop-evolution-prd.md Part IV - Creative Ideas (Focus Mode)
 */

import type { StateCreator } from "zustand";

import type { WindowState } from "./types.new";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface FocusModeState {
  windowId: string;
  previousFocusedWindowId: string | null;
  focusWindowPrevState: WindowState;
  minimizedWindows: { id: string; prevState: WindowState }[];
}

export interface FocusModeSlice {
  isFocusMode: boolean;
  focusModeState: FocusModeState | null;

  enterFocusMode: (windowId: string) => void;
  exitFocusMode: () => void;
  toggleFocusMode: (windowId?: string) => void;
}

// Combined state type for the slice
interface FocusModeFullState extends FocusModeSlice {
  windows: {
    id: string;
    state: WindowState;
    bounds: { x: number; y: number; width: number; height: number };
  }[];
  focusedWindowId: string | null;
  minimizeWindow: (windowId: string) => void;
  maximizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  updateWindow: (
    windowId: string,
    updates: Partial<{ state: WindowState }>
  ) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

export const createFocusModeSlice: StateCreator<
  FocusModeFullState,
  [],
  [],
  FocusModeSlice
> = (set, get) => ({
  isFocusMode: false,
  focusModeState: null,

  enterFocusMode: (windowId: string) => {
    const window = get().windows.find((w) => w.id === windowId);
    if (!window || window.state === "minimized") {
      return;
    }

    set({
      isFocusMode: true,
      focusModeState: {
        windowId,
        previousFocusedWindowId: get().focusedWindowId ?? null,
        focusWindowPrevState: window.state,
        minimizedWindows: get()
          .windows.filter((w) => w.id !== windowId && w.state !== "minimized")
          .map((w) => ({ id: w.id, prevState: w.state })),
      },
    });

    // Ensure the focus window is focused before minimizing others.
    get().focusWindow(windowId);

    // Minimize all other visible windows (track state for restoration).
    for (const w of get().windows) {
      if (w.id !== windowId && w.state !== "minimized") {
        get().minimizeWindow(w.id);
      }
    }

    // Maximize the focused window
    get().maximizeWindow(windowId);
  },

  exitFocusMode: () => {
    const { focusModeState } = get();

    if (!focusModeState) {
      set({
        isFocusMode: false,
        focusModeState: null,
      });
      return;
    }

    const {
      windowId,
      focusWindowPrevState,
      minimizedWindows,
      previousFocusedWindowId,
    } = focusModeState;

    // Restore the focus window to its previous state.
    if (focusWindowPrevState === "normal") {
      get().restoreWindow(windowId);
    } else {
      // Avoid calling maximizeWindow again (it overwrites _restoreBounds).
      get().updateWindow(windowId, { state: focusWindowPrevState });
    }

    // Restore other windows to their prior (pre-focus-mode) states.
    for (const win of minimizedWindows) {
      // Avoid restoreWindow here: it may apply stale _restoreBounds even when
      // the window was only minimized. We only need to restore the state.
      get().updateWindow(win.id, { state: win.prevState });
    }

    set({
      isFocusMode: false,
      focusModeState: null,
    });

    // Re-focus the focus window if it still exists.
    const stillExists = get().windows.some((w) => w.id === windowId);
    if (stillExists) {
      get().focusWindow(windowId);
      return;
    }
    if (
      previousFocusedWindowId &&
      get().windows.some((w) => w.id === previousFocusedWindowId)
    ) {
      get().focusWindow(previousFocusedWindowId);
    }
  },

  toggleFocusMode: (windowId?: string) => {
    const { isFocusMode, exitFocusMode, enterFocusMode, focusedWindowId } =
      get();

    if (isFocusMode) {
      exitFocusMode();
    } else if (windowId) {
      enterFocusMode(windowId);
    } else if (focusedWindowId) {
      enterFocusMode(focusedWindowId);
    }
  },
});
