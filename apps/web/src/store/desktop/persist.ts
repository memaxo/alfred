import type { PersistOptions } from "zustand/middleware";

import { toast } from "sonner";

import type { DesktopState, WindowData, WindowInstance } from "./types.new";

/** Shared storage identifier for desktop layout persistence */
export const DESKTOP_STORAGE_ID = "desktop-layout-v1";
/** Storage budget in bytes (50KB) */
export const STORAGE_BUDGET_BYTES = 50 * 1024;

const WORKSPACE_COUNT = 6;

const DEFAULT_TILING_CONFIG = {
  layout: "float",
  gap: 8,
  mainRatio: 0.6,
  respectMinSize: true,
} as const;

interface PersistedWorkspace {
  id: number;
  label?: string;
  windowIds: string[];
  tilingConfig: {
    layout: string;
    gap: number;
    mainRatio: number;
    respectMinSize: boolean;
  };
}

function calculateStorageSize(state: unknown): number {
  try {
    const serialized = JSON.stringify(state);
    return new TextEncoder().encode(serialized).length;
  } catch {
    return 0;
  }
}

function clampWorkspaceId(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  const n = Math.trunc(value);
  if (n < 1 || n > WORKSPACE_COUNT) {
    return 1;
  }
  return n;
}

function createDefaultWorkspaces(): PersistedWorkspace[] {
  return Array.from({ length: WORKSPACE_COUNT }, (_, i) => ({
    id: i + 1,
    windowIds: [],
    tilingConfig: { ...DEFAULT_TILING_CONFIG },
  }));
}

function normalizeWorkspaces(input: unknown): PersistedWorkspace[] {
  const defaults = createDefaultWorkspaces();
  if (!Array.isArray(input)) {
    return defaults;
  }

  const byId = new Map<number, PersistedWorkspace>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const obj = raw as Record<string, unknown>;
    const id = clampWorkspaceId(obj.id);
    if (byId.has(id)) {
      continue;
    }

    const windowIds = Array.isArray(obj.windowIds)
      ? obj.windowIds.filter((v): v is string => typeof v === "string")
      : [];
    const tiling = (obj.tilingConfig ?? {}) as Record<string, unknown>;

    byId.set(id, {
      id,
      label: typeof obj.label === "string" ? obj.label : undefined,
      windowIds,
      tilingConfig: {
        layout:
          typeof tiling.layout === "string"
            ? tiling.layout
            : DEFAULT_TILING_CONFIG.layout,
        gap:
          typeof tiling.gap === "number"
            ? tiling.gap
            : DEFAULT_TILING_CONFIG.gap,
        mainRatio:
          typeof tiling.mainRatio === "number"
            ? tiling.mainRatio
            : DEFAULT_TILING_CONFIG.mainRatio,
        respectMinSize:
          typeof tiling.respectMinSize === "boolean"
            ? tiling.respectMinSize
            : DEFAULT_TILING_CONFIG.respectMinSize,
      },
    });
  }

  return defaults.map((d) => byId.get(d.id) ?? d);
}

function normalizeLastFocusedWindowIds(
  input: unknown
): Map<number, string | null> {
  if (input instanceof Map) {
    return input;
  }
  if (!Array.isArray(input)) {
    return new Map();
  }

  const entries: [number, string | null][] = [];
  for (const raw of input) {
    if (!Array.isArray(raw) || raw.length !== 2) {
      continue;
    }
    const [k, v] = raw as [unknown, unknown];
    const key = clampWorkspaceId(k);
    const value = typeof v === "string" ? v : null;
    entries.push([key, value]);
  }
  return new Map(entries);
}

function rebuildWorkspaceWindowIds(
  workspaces: PersistedWorkspace[],
  windows: { id: string; workspaceId: number }[]
): PersistedWorkspace[] {
  const idsByWorkspace = new Map<number, string[]>();
  for (let i = 1; i <= WORKSPACE_COUNT; i += 1) {
    idsByWorkspace.set(i, []);
  }
  for (const w of windows) {
    const list = idsByWorkspace.get(w.workspaceId);
    if (list) {
      list.push(w.id);
    }
  }
  return workspaces.map((ws) => ({
    ...ws,
    windowIds: idsByWorkspace.get(ws.id) ?? [],
  }));
}

function ensureWindowWorkspaceIds(
  windows: unknown,
  workspaces: PersistedWorkspace[]
): WindowInstance[] {
  if (!Array.isArray(windows)) {
    return [];
  }

  const membership = new Map<string, number>();
  for (const ws of workspaces) {
    for (const id of ws.windowIds) {
      if (!membership.has(id)) {
        membership.set(id, ws.id);
      }
    }
  }

  const out: WindowInstance[] = [];
  for (const raw of windows) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const w = raw as Record<string, unknown>;
    const id = typeof w.id === "string" ? w.id : undefined;
    if (!id) {
      continue;
    }

    const data = (w.data ?? {}) as Record<string, unknown>;
    const workspaceId =
      typeof w.workspaceId === "number"
        ? clampWorkspaceId(w.workspaceId)
        : typeof data.workspaceId === "number"
          ? clampWorkspaceId(data.workspaceId)
          : (membership.get(id) ?? 1);

    out.push({ ...(w as unknown as WindowInstance), workspaceId });
  }
  return out;
}

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
    workspaceId: clampWorkspaceId(window.workspaceId),
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
  version: 5,
  partialize: (state) => {
    const persisted = {
      // Layout state (persisted)
      windows: state.windows.map(sanitizeWindowForPersist),
      focusedWindowId: state.focusedWindowId,
      isSpaceMode: state.isSpaceMode,
      pinnedApps: state.pinnedApps,
      mode: state.mode,
      config: state.config,
      // Workspace state (persisted)
      workspaces: state.workspaces,
      activeWorkspaceId: state.activeWorkspaceId,
      lastFocusedWindowIds: [...state.lastFocusedWindowIds.entries()],
      // Context/feedback state (persisted, small footprint)
      contextCache: state.contextCache,
      feedbackByWindow: state.feedbackByWindow,
      // Note: ragDocCache is NOT persisted - it's ephemeral and can be large
    };

    const size = calculateStorageSize(persisted);
    if (
      size > STORAGE_BUDGET_BYTES &&
      Object.keys(persisted.contextCache).length > 0
    ) {
      // Basic pruning: clear old context caches if over budget
      persisted.contextCache = {};
      toast.warning("Pruning old desktop context to save space.");
    }

    return persisted as unknown as DesktopState;
  },
  migrate: (persistedState, version) => {
    let state = (persistedState ?? {}) as Record<string, unknown>;

    if (version < 3) {
      // Migration from v1/v2: restructure for new type system
      const oldState = state;
      state = {
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
      };
    }

    if (version < 4) {
      // Migration to v4: add workspace support
      state = {
        ...state,
        workspaces: Array.from({ length: 6 }, (_, i) => ({
          id: i + 1,
          windowIds: [],
          tilingConfig: {
            layout: "float",
            gap: 8,
            mainRatio: 0.6,
            respectMinSize: true,
          },
        })),
        activeWorkspaceId: 1,
        lastFocusedWindowIds: [],
      };
    }

    if (version < 5) {
      const workspaces = normalizeWorkspaces(state.workspaces);
      const windows = ensureWindowWorkspaceIds(state.windows, workspaces);
      const workspacesRebuilt = rebuildWorkspaceWindowIds(
        workspaces,
        windows.map((w) => ({
          id: w.id,
          workspaceId: clampWorkspaceId(w.workspaceId),
        }))
      );
      const activeWorkspaceId = clampWorkspaceId(state.activeWorkspaceId);
      const lastFocusedWindowIds = normalizeLastFocusedWindowIds(
        state.lastFocusedWindowIds
      );

      return {
        ...state,
        windows,
        workspaces: workspacesRebuilt,
        activeWorkspaceId,
        lastFocusedWindowIds,
      } as unknown as DesktopState;
    }

    return state as unknown as DesktopState;
  },
  merge: (persistedState, currentState) => {
    const merged = {
      ...currentState,
      ...(persistedState as Record<string, unknown>),
    } as unknown as DesktopState;

    const workspaces = normalizeWorkspaces(
      (merged as unknown as { workspaces?: unknown }).workspaces
    );
    const windows = ensureWindowWorkspaceIds(
      (merged as unknown as { windows?: unknown }).windows,
      workspaces
    );
    const workspacesRebuilt = rebuildWorkspaceWindowIds(
      workspaces,
      windows.map((w) => ({
        id: w.id,
        workspaceId: clampWorkspaceId(w.workspaceId),
      }))
    );

    return {
      ...merged,
      windows,
      workspaces: workspacesRebuilt,
      activeWorkspaceId: clampWorkspaceId(
        (merged as unknown as { activeWorkspaceId?: unknown }).activeWorkspaceId
      ),
      lastFocusedWindowIds: normalizeLastFocusedWindowIds(
        (merged as unknown as { lastFocusedWindowIds?: unknown })
          .lastFocusedWindowIds
      ),
    } as DesktopState;
  },
};
