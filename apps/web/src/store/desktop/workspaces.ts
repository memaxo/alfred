/**
 * Workspace Slice - Virtual desktop workspaces
 *
 * Manages multiple virtual workspaces (1-6) for organizing windows.
 * Each workspace maintains its own set of windows and tiling configuration.
 *
 * @see docs/execplans/desktop-critical-features-implementation.md Milestone 1
 */

import type { StateCreator } from "zustand";

import type { DesktopState, TilingConfig, WindowInstance } from "./types.new";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Workspace {
  /** Workspace ID (1-6) */
  id: number;
  /** Optional custom label */
  label?: string;
  /** IDs of windows assigned to this workspace */
  windowIds: string[];
  /** Tiling configuration for this workspace */
  tilingConfig: TilingConfig;
}

export interface WorkspaceSlice {
  /** All workspaces (1-6) */
  workspaces: Workspace[];
  /** Currently active workspace ID */
  activeWorkspaceId: number;
  /** Window ID that was last active in each workspace (for focus restoration) */
  lastFocusedWindowIds: Map<number, string | null>;

  // Workspace navigation
  switchWorkspace: (id: number) => void;
  nextWorkspace: () => void;
  previousWorkspace: () => void;

  // Window assignment
  assignWindowToWorkspace: (windowId: string, workspaceId: number) => void;
  moveWindowToWorkspace: (windowId: string, workspaceId: number) => void;
  getWorkspaceWindows: (workspaceId: number) => WindowInstance[];

  // Workspace queries
  getActiveWorkspace: () => Workspace;
  isWindowInActiveWorkspace: (windowId: string) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TILING_CONFIG: TilingConfig = {
  layout: "float",
  gap: 8,
  mainRatio: 0.6,
  respectMinSize: true,
};

const INITIAL_WORKSPACES: Workspace[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  windowIds: [],
  tilingConfig: { ...DEFAULT_TILING_CONFIG },
}));

// ─────────────────────────────────────────────────────────────────────────────
// SLICE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export const createWorkspaceSlice: StateCreator<
  DesktopState,
  [],
  [],
  WorkspaceSlice
> = (set, get) => ({
  workspaces: INITIAL_WORKSPACES,
  activeWorkspaceId: 1,
  lastFocusedWindowIds: new Map(),

  // ─────────────────────────────────────────────────────────────────────────
  // WORKSPACE NAVIGATION
  // ─────────────────────────────────────────────────────────────────────────

  switchWorkspace: (id: number) => {
    const { windows, focusWindow, activeWorkspaceId } = get();

    // Validate workspace ID
    if (id < 1 || id > 6 || id === activeWorkspaceId) {
      return;
    }

    // Save currently focused window for the workspace we're leaving
    const currentFocusedWindow = windows.find((w) => w.isFocused);
    if (currentFocusedWindow) {
      set((state) => ({
        lastFocusedWindowIds: new Map(state.lastFocusedWindowIds).set(
          activeWorkspaceId,
          currentFocusedWindow.id
        ),
      }));
    }

    // Switch to new workspace
    set({ activeWorkspaceId: id });

    // Focus the topmost window in the new workspace, or restore last focused
    const workspaceWindows = windows.filter(
      (w) => w.workspaceId === id && w.state !== "minimized"
    );

    if (workspaceWindows.length === 0) {
      set((state) => ({
        focusedWindowId: null,
        windows: state.windows.map((w) => ({ ...w, isFocused: false })),
      }));
      return;
    }

    // Try to restore last focused window for this workspace
    const lastFocusedId = get().lastFocusedWindowIds.get(id);
    const windowToFocus = lastFocusedId
      ? workspaceWindows.find((w) => w.id === lastFocusedId)
      : undefined;

    if (windowToFocus) {
      focusWindow(windowToFocus.id);
      return;
    }

    // Focus topmost by z-index
    const topmost = workspaceWindows.reduce((a, b) =>
      a.zIndex > b.zIndex ? a : b
    );
    focusWindow(topmost.id);
  },

  nextWorkspace: () => {
    const { activeWorkspaceId } = get();
    const nextId = activeWorkspaceId >= 6 ? 1 : activeWorkspaceId + 1;
    get().switchWorkspace(nextId);
  },

  previousWorkspace: () => {
    const { activeWorkspaceId } = get();
    const prevId = activeWorkspaceId <= 1 ? 6 : activeWorkspaceId - 1;
    get().switchWorkspace(prevId);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // WINDOW ASSIGNMENT
  // ─────────────────────────────────────────────────────────────────────────

  assignWindowToWorkspace: (windowId: string, workspaceId: number) => {
    const nextWorkspaceId =
      workspaceId >= 1 && workspaceId <= 6 ? workspaceId : 1;
    const { workspaces } = get();
    const workspace = workspaces.find((w) => w.id === nextWorkspaceId);
    if (!workspace) {
      return;
    }

    // Update workspace membership and window assignment atomically
    set((state) => ({
      workspaces: state.workspaces.map((ws) => ({
        ...ws,
        windowIds:
          ws.id === nextWorkspaceId
            ? [...ws.windowIds.filter((id) => id !== windowId), windowId]
            : ws.windowIds.filter((id) => id !== windowId),
      })),
      windows: state.windows.map((w) =>
        w.id === windowId ? { ...w, workspaceId: nextWorkspaceId } : w
      ),
    }));
  },

  moveWindowToWorkspace: (windowId: string, workspaceId: number) => {
    const { switchWorkspace } = get();
    const nextWorkspaceId =
      workspaceId >= 1 && workspaceId <= 6 ? workspaceId : 1;

    // Assign window to workspace
    get().assignWindowToWorkspace(windowId, nextWorkspaceId);

    // Switch to that workspace and focus the moved window
    switchWorkspace(nextWorkspaceId);
    get().focusWindow(windowId);
  },

  getWorkspaceWindows: (workspaceId: number) => {
    const { windows } = get();
    if (workspaceId < 1 || workspaceId > 6) {
      return [];
    }
    return windows.filter((w) => w.workspaceId === workspaceId);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────────────────────────────────

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0]!;
  },

  isWindowInActiveWorkspace: (windowId: string) => {
    const { activeWorkspaceId, windows } = get();
    const win = windows.find((w) => w.id === windowId);
    return win?.workspaceId === activeWorkspaceId;
  },
});
