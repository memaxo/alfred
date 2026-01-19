import { create } from "zustand";

import type {
  Bounds,
  DesktopMode,
  TileZone,
  WindowData,
  WindowInstance,
  WindowState,
  WindowType,
} from "./desktop.types";

type DesktopState = {
  mode: DesktopMode;
  setMode: (mode: DesktopMode) => void;
  toggleMode: () => void;

  windows: WindowInstance[];
  focusedWindowId: string | null;
  zIndexCounter: number;

  openWindow: (
    type: WindowType,
    data?: Partial<WindowData>,
    bounds?: Partial<Bounds>
  ) => string;
  closeWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  blurWindow: () => void;

  minimizeWindow: (windowId: string) => void;
  maximizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;

  moveWindow: (windowId: string, pos: { x: number; y: number }) => void;
  resizeWindow: (
    windowId: string,
    size: { width: number; height: number }
  ) => void;
  setTile: (windowId: string, zone: TileZone | null) => void;
};

function now() {
  return Date.now();
}

function newId() {
  return `w_${Math.random().toString(16).slice(2)}_${now()}`;
}

function defaultBounds(): Bounds {
  return { x: 24, y: 72, width: 360, height: 520 };
}

export const useDesktopStore = create<DesktopState>((set, get) => ({
  mode: "desktop",
  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set((s) => ({ mode: s.mode === "desktop" ? "mindscape" : "desktop" })),

  windows: [],
  focusedWindowId: null,
  zIndexCounter: 100,

  openWindow: (type, data, bounds) => {
    const id = newId();
    const zIndex = get().zIndexCounter + 1;
    const b0 = defaultBounds();
    const win: WindowInstance = {
      id,
      type,
      data: {
        type,
        viewMode: "full",
        ...data,
      },
      bounds: { ...b0, ...bounds },
      state: "normal",
      isTiled: false,
      tileZone: undefined,
      zIndex,
      isFocused: true,
      createdAt: now(),
      lastFocusedAt: now(),
    };
    set((s) => ({
      windows: s.windows.map((w) => ({ ...w, isFocused: false })).concat(win),
      focusedWindowId: id,
      zIndexCounter: zIndex,
    }));
    return id;
  },

  closeWindow: (windowId) => {
    set((s) => {
      const remaining = s.windows.filter((w) => w.id !== windowId);
      const nextFocused = remaining
        .slice()
        .sort((a, b) => b.lastFocusedAt - a.lastFocusedAt)[0];
      return {
        windows: remaining.map((w) => ({
          ...w,
          isFocused: nextFocused ? w.id === nextFocused.id : false,
        })),
        focusedWindowId: nextFocused?.id ?? null,
      };
    });
  },

  focusWindow: (windowId) => {
    const zIndex = get().zIndexCounter + 1;
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId
          ? { ...w, isFocused: true, lastFocusedAt: now(), zIndex }
          : { ...w, isFocused: false }
      ),
      focusedWindowId: windowId,
      zIndexCounter: zIndex,
    }));
  },

  blurWindow: () => {
    set((s) => ({
      windows: s.windows.map((w) => ({ ...w, isFocused: false })),
      focusedWindowId: null,
    }));
  },

  minimizeWindow: (windowId) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId ? { ...w, state: "minimized" } : w
      ),
    }));
  },

  maximizeWindow: (windowId) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId ? { ...w, state: "maximized" } : w
      ),
    }));
  },

  restoreWindow: (windowId) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId ? { ...w, state: "normal" } : w
      ),
    }));
  },

  moveWindow: (windowId, pos) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId ? { ...w, bounds: { ...w.bounds, ...pos } } : w
      ),
    }));
  },

  resizeWindow: (windowId, size) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId ? { ...w, bounds: { ...w.bounds, ...size } } : w
      ),
    }));
  },

  setTile: (windowId, zone) => {
    const state: WindowState = zone ? "normal" : "normal";
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              state,
              isTiled: !!zone,
              tileZone: zone ?? undefined,
            }
          : w
      ),
    }));
  },
}));
