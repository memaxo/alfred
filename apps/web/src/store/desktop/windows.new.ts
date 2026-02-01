/**
 * Window Slice - Phase 0 Migration (No ReactFlow)
 *
 * This is the new window slice implementation without ReactFlow dependencies.
 * It manages traditional DOM-based windows with pure TypeScript types.
 *
 * @see docs/execplans/desktop-type-migration.md Section 2.1
 */

import type { StateCreator } from "zustand";

import type {
  Bounds,
  DesktopState,
  WindowData,
  WindowInstance,
  WindowSlice,
  WindowType,
} from "./types.new";

/**
 * Generate a unique window ID
 */
function generateWindowId(type: WindowType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get default window configuration for a type
 */
function getWindowDefaults(type: WindowType): {
  minSize: { width: number; height: number };
  defaultBounds: Bounds;
} {
  // Import dynamically to avoid circular dependency
  const defaults = {
    chat: {
      minSize: { width: 400, height: 400 },
      defaultBounds: { x: 100, y: 100, width: 500, height: 600 },
    },
    terminal: {
      minSize: { width: 400, height: 300 },
      defaultBounds: { x: 150, y: 150, width: 600, height: 400 },
    },
    code: {
      minSize: { width: 600, height: 400 },
      defaultBounds: { x: 100, y: 100, width: 800, height: 600 },
    },
    agents: {
      minSize: { width: 500, height: 400 },
      defaultBounds: { x: 200, y: 100, width: 700, height: 500 },
    },
    droid: {
      minSize: { width: 400, height: 400 },
      defaultBounds: { x: 100, y: 100, width: 500, height: 500 },
    },
    knowledge: {
      minSize: { width: 400, height: 300 },
      defaultBounds: { x: 150, y: 100, width: 500, height: 400 },
    },
    workflow: {
      minSize: { width: 500, height: 400 },
      defaultBounds: { x: 100, y: 100, width: 700, height: 500 },
    },
    settings: {
      minSize: { width: 400, height: 400 },
      defaultBounds: { x: 200, y: 100, width: 500, height: 500 },
    },
  } as Record<
    string,
    { minSize: { width: number; height: number }; defaultBounds: Bounds }
  >;

  return (
    defaults[type] ?? {
      minSize: { width: 200, height: 150 },
      defaultBounds: { x: 100, y: 100, width: 400, height: 300 },
    }
  );
}

/**
 * Calculate cascaded position for new windows
 */
function getCascadedPosition(
  existingWindows: WindowInstance[],
  baseX = 100,
  baseY = 100,
  offset = 30
): { x: number; y: number } {
  const count = existingWindows.filter((w) => w.state === "normal").length;
  return {
    x: baseX + (count % 10) * offset,
    y: baseY + (count % 10) * offset,
  };
}

export const createWindowSliceNew: StateCreator<
  DesktopState,
  [],
  [],
  WindowSlice
> = (set, get) => ({
  windows: [],
  zIndexCounter: 0,

  // ─────────────────────────────────────────────────────────────────────────
  // WINDOW CRUD
  // ─────────────────────────────────────────────────────────────────────────

  openWindow: (type, data, bounds) => {
    const { windows, zIndexCounter, activeWorkspaceId } = get();
    const windowDefaults = getWindowDefaults(type);
    const position = getCascadedPosition(windows);

    const id = generateWindowId(type);
    const now = Date.now();

    // Assign window to active workspace if not explicitly specified
    const rawWorkspaceId = (
      data as unknown as { workspaceId?: unknown } | undefined
    )?.workspaceId;
    const requestedWorkspaceId =
      typeof rawWorkspaceId === "number" ? rawWorkspaceId : undefined;
    const workspaceId =
      (requestedWorkspaceId ?? activeWorkspaceId) >= 1 &&
      (requestedWorkspaceId ?? activeWorkspaceId) <= 6
        ? (requestedWorkspaceId ?? activeWorkspaceId)
        : 1;

    const dataWithWorkspaceStripped = (data ?? {}) as Record<string, unknown>;
    const { workspaceId: _ignoredWorkspaceId, ...dataWithoutWorkspace } =
      dataWithWorkspaceStripped;

    const newWindow: WindowInstance = {
      id,
      type,
      data: {
        type,
        viewMode: "full",
        ...dataWithoutWorkspace,
      } as WindowData,
      workspaceId,
      bounds: {
        x: bounds?.x ?? position.x,
        y: bounds?.y ?? position.y,
        width: bounds?.width ?? windowDefaults.defaultBounds.width,
        height: bounds?.height ?? windowDefaults.defaultBounds.height,
      },
      state: "normal",
      isTiled: false,
      zIndex: zIndexCounter + 1,
      isFocused: true,
      minSize: windowDefaults.minSize,
      resizable: true,
      createdAt: now,
      lastFocusedAt: now,
    };

    set((state) => ({
      windows: [
        ...state.windows.map((w) => ({ ...w, isFocused: false })),
        newWindow,
      ],
      zIndexCounter: state.zIndexCounter + 1,
      focusedWindowId: id,
      // Ensure the newly opened window's workspace is active
      activeWorkspaceId: workspaceId,
      // Update workspace windowIds
      workspaces: state.workspaces.map((ws) =>
        ws.id === workspaceId ? { ...ws, windowIds: [...ws.windowIds, id] } : ws
      ),
    }));

    return id;
  },

  closeWindow: (windowId) => {
    set((state) => {
      const filtered = state.windows.filter((w) => w.id !== windowId);
      const closedWindow = state.windows.find((w) => w.id === windowId);
      const wasFocused = closedWindow?.isFocused;
      const workspaceId = closedWindow?.workspaceId;

      // If the closed window was focused, focus the topmost remaining window
      let newFocusedId = state.focusedWindowId ?? null;
      if (wasFocused) {
        const focusWorkspaceId = workspaceId ?? state.activeWorkspaceId;
        const visible = filtered.filter(
          (w) => w.workspaceId === focusWorkspaceId && w.state !== "minimized"
        );
        if (visible.length > 0) {
          const topmost = visible.reduce((a, b) =>
            a.zIndex > b.zIndex ? a : b
          );
          newFocusedId = topmost.id;
        } else {
          newFocusedId = null;
        }
      }

      return {
        windows: filtered.map((w) => ({
          ...w,
          isFocused: wasFocused ? w.id === newFocusedId : w.isFocused,
        })),
        focusedWindowId: newFocusedId,
        // Remove window from all workspaces (defensive)
        workspaces: state.workspaces.map((ws) => ({
          ...ws,
          windowIds: ws.windowIds.filter((id) => id !== windowId),
        })),
      };
    });
  },

  updateWindow: (windowId, updates) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) {
          return w;
        }
        return { ...w, ...updates };
      }),
    }));
  },

  updateWindowData: (windowId, data) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) {
          return w;
        }
        return {
          ...w,
          data: { ...w.data, ...data } as WindowData,
        };
      }),
    }));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FOCUS MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  focusWindow: (windowId) => {
    const { zIndexCounter } = get();
    const now = Date.now();

    set((state) => ({
      windows: state.windows.map((w) => ({
        ...w,
        isFocused: w.id === windowId,
        zIndex: w.id === windowId ? zIndexCounter + 1 : w.zIndex,
        lastFocusedAt: w.id === windowId ? now : w.lastFocusedAt,
      })),
      zIndexCounter: state.zIndexCounter + 1,
      focusedWindowId: windowId,
    }));
  },

  blurWindow: (windowId) => {
    set((state) => ({
      windows: state.windows.map((w) => ({
        ...w,
        isFocused: w.id === windowId ? false : w.isFocused,
      })),
    }));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STATE TRANSITIONS
  // ─────────────────────────────────────────────────────────────────────────

  minimizeWindow: (windowId) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) {
          return w;
        }
        return { ...w, state: "minimized" as const, isFocused: false };
      }),
    }));

    // Focus next window
    const { activeWorkspaceId, focusedWindowId, windows } = get();
    if (focusedWindowId !== windowId) {
      return;
    }

    const visible = windows.filter(
      (w) => w.workspaceId === activeWorkspaceId && w.state !== "minimized"
    );
    if (visible.length > 0) {
      const topmost = visible.reduce((a, b) => (a.zIndex > b.zIndex ? a : b));
      get().focusWindow(topmost.id);
      return;
    }

    set({ focusedWindowId: null });
  },

  maximizeWindow: (windowId) => {
    const { desktopArea } = get();

    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) {
          return w;
        }
        return {
          ...w,
          state: "maximized" as const,
          // Store original bounds for restore (using data.draft)
          data: {
            ...w.data,
            _restoreBounds: w.bounds,
          } as WindowData,
          bounds: {
            x: desktopArea.x,
            y: desktopArea.y,
            width: desktopArea.width,
            height: desktopArea.height,
          },
        };
      }),
    }));
  },

  restoreWindow: (windowId) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) {
          return w;
        }
        const restoreBounds = (w.data as { _restoreBounds?: Bounds })
          ._restoreBounds;
        return {
          ...w,
          state: "normal" as const,
          bounds: restoreBounds ?? w.bounds,
        };
      }),
    }));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GEOMETRY
  // ─────────────────────────────────────────────────────────────────────────

  moveWindow: (windowId, position) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) {
          return w;
        }
        return {
          ...w,
          bounds: { ...w.bounds, x: position.x, y: position.y },
          isTiled: false, // Moving untiles the window
          tileZone: undefined,
        };
      }),
    }));
  },

  resizeWindow: (windowId, size) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) {
          return w;
        }
        // Respect min/max size constraints
        const width = Math.max(
          w.minSize.width,
          Math.min(size.width, w.maxSize?.width ?? Number.POSITIVE_INFINITY)
        );
        const height = Math.max(
          w.minSize.height,
          Math.min(size.height, w.maxSize?.height ?? Number.POSITIVE_INFINITY)
        );
        return {
          ...w,
          bounds: { ...w.bounds, width, height },
          isTiled: false, // Resizing untiles the window
          tileZone: undefined,
        };
      }),
    }));
  },

  setBounds: (windowId, bounds) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) {
          return w;
        }
        return { ...w, bounds };
      }),
    }));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BATCH OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  closeAllWindows: () => {
    set((state) => ({
      windows: [],
      focusedWindowId: null,
      workspaces: state.workspaces.map((ws) => ({ ...ws, windowIds: [] })),
      lastFocusedWindowIds: new Map(),
    }));
  },

  minimizeAllWindows: () => {
    set((state) => ({
      windows: state.windows.map((w) => ({
        ...w,
        state: "minimized" as const,
        isFocused: false,
      })),
      focusedWindowId: null,
    }));
  },

  cascadeWindows: () => {
    const baseX = 50;
    const baseY = 50;
    const offset = 30;

    set((state) => ({
      windows: state.windows
        .filter((w) => w.state === "normal")
        .map((w, index) => ({
          ...w,
          bounds: {
            ...w.bounds,
            x: baseX + index * offset,
            y: baseY + index * offset,
          },
          isTiled: false,
          tileZone: undefined,
        })),
    }));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LEGACY COMPATIBILITY (for gradual migration)
  // ─────────────────────────────────────────────────────────────────────────

  addWindow: (window) => {
    set((state) => {
      if (state.windows.some((w) => w.id === window.id)) {
        return state;
      }
      return {
        windows: [...state.windows, window],
        zIndexCounter: Math.max(state.zIndexCounter, window.zIndex) + 1,
        workspaces: state.workspaces.map((ws) =>
          ws.id === window.workspaceId
            ? { ...ws, windowIds: [...ws.windowIds, window.id] }
            : ws
        ),
      };
    });
  },

  removeWindow: (windowId) => {
    get().closeWindow(windowId);
  },

  setWindows: (windowsOrUpdater) => {
    set((state) => {
      const newWindows =
        typeof windowsOrUpdater === "function"
          ? windowsOrUpdater(state.windows)
          : windowsOrUpdater;
      return { windows: newWindows };
    });
  },
});
