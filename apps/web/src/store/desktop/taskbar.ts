/**
 * Taskbar Slice - Renamed from DockSlice
 *
 * Manages taskbar state including pinned apps and window spawning.
 *
 * @see docs/execplans/desktop-type-migration.md Section 2
 */

import type { StateCreator } from "zustand";

import type {
  DesktopState,
  ResourceRef,
  TaskbarSlice,
  WindowType,
} from "./types.new";

const DEFAULT_PINNED_APPS: WindowType[] = [
  "chat",
  "focus",
  "terminal",
  "agents",
  "workflow",
  "settings",
];

export const createTaskbarSlice: StateCreator<
  DesktopState,
  [],
  [],
  TaskbarSlice
> = (set, get) => ({
  pinnedApps: DEFAULT_PINNED_APPS,
  recentApps: [],

  // Legacy compatibility
  dockPins: DEFAULT_PINNED_APPS,

  // ─────────────────────────────────────────────────────────────────────────
  // PIN MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  pinApp: (type: WindowType) => {
    set((state) => {
      if (state.pinnedApps.includes(type)) {
        return state;
      }
      return {
        pinnedApps: [...state.pinnedApps, type],
        dockPins: [...state.pinnedApps, type], // Legacy
      };
    });
  },

  unpinApp: (type: WindowType) => {
    set((state) => ({
      pinnedApps: state.pinnedApps.filter((t) => t !== type),
      dockPins: state.pinnedApps.filter((t) => t !== type), // Legacy
    }));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // WINDOW SPAWNING
  // ─────────────────────────────────────────────────────────────────────────

  spawnWindow: (
    type: WindowType,
    resourceRef?: ResourceRef,
    position?: { x: number; y: number }
  ) => {
    const { openWindow, addRecentApp } = get();
    addRecentApp(type);
    return openWindow(
      type,
      resourceRef ? { resourceRef } : undefined,
      position ? { x: position.x, y: position.y } : undefined
    );
  },

  addRecentApp: (type: WindowType) => {
    set((state) => {
      // Don't add if already the most recent
      if (state.recentApps[0] === type) {
        return state;
      }

      const filtered = state.recentApps.filter((t) => t !== type);
      return {
        recentApps: [type, ...filtered].slice(0, 10), // Keep last 10
      };
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LEGACY COMPATIBILITY
  // ─────────────────────────────────────────────────────────────────────────

  pinType: (type: WindowType) => {
    get().pinApp(type);
  },

  unpinType: (type: WindowType) => {
    get().unpinApp(type);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // KNOWLEDGE GRAPH SPAWNING
  // ─────────────────────────────────────────────────────────────────────────

  spawnKnowledgeGraph: (
    nodes: Array<{
      id: string;
      label: string;
      entityType?: string;
      confidence?: number;
      archived?: string;
      description?: string;
      hgHash?: string;
    }>,
    edges: Array<{
      id: string;
      fromId: string;
      toId: string;
      kind: string;
      weight?: number;
    }>,
    centerPosition?: { x: number; y: number }
  ) => {
    const { spawnKnowledgeGraph: spawnGraph } = get();
    return spawnGraph(nodes, edges, centerPosition);
  },
});
