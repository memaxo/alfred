/**
 * Groups Slice - Window Tabs/Groups Management
 *
 * Manages tabbed window groups where multiple windows share a container.
 */

import type { StateCreator } from "zustand";
import type {
  Bounds,
  DesktopState,
  GroupSlice,
  WindowGroup,
} from "./types.new";

function generateGroupId(): string {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const createGroupSlice: StateCreator<
  DesktopState,
  [],
  [],
  GroupSlice
> = (set, get) => ({
  groups: [],

  createGroup: (windowIds) => {
    if (windowIds.length < 2) {
      return "";
    }

    const { windows, zIndexCounter } = get();
    const groupWindows = windows.filter((w) => windowIds.includes(w.id));

    if (groupWindows.length < 2) {
      return "";
    }

    const firstWindow = groupWindows[0];
    if (!firstWindow) {
      return "";
    }

    const groupId = generateGroupId();
    const now = Date.now();
    const activeId = windowIds[0];

    if (!activeId) {
      return "";
    }

    const bounds: Bounds = {
      x: firstWindow.bounds.x,
      y: firstWindow.bounds.y,
      width: Math.max(...groupWindows.map((w) => w.bounds.width)),
      height: Math.max(...groupWindows.map((w) => w.bounds.height)),
    };

    const newGroup: WindowGroup = {
      id: groupId,
      windowIds,
      activeWindowId: activeId,
      bounds,
      state: "normal",
      zIndex: zIndexCounter + 1,
      isFocused: true,
      createdAt: now,
    };

    set((state) => ({
      groups: [...state.groups, newGroup],
      windows: state.windows.map((w) => {
        if (!windowIds.includes(w.id)) {
          return { ...w, isFocused: false };
        }
        return {
          ...w,
          groupId,
          isFocused: w.id === windowIds[0],
        };
      }),
      zIndexCounter: state.zIndexCounter + 1,
    }));

    return groupId;
  },

  dissolveGroup: (groupId) => {
    const { groups } = get();
    const group = groups.find((g) => g.id === groupId);

    if (!group) {
      return;
    }

    const offset = 30;

    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
      windows: state.windows.map((w) => {
        if (w.groupId !== groupId) {
          return w;
        }
        const windowIndex = group.windowIds.indexOf(w.id);
        return {
          ...w,
          groupId: undefined,
          bounds: {
            ...group.bounds,
            x: group.bounds.x + windowIndex * offset,
            y: group.bounds.y + windowIndex * offset,
          },
        };
      }),
    }));
  },

  addToGroup: (groupId, windowId) => {
    const { groups, windows } = get();
    const group = groups.find((g) => g.id === groupId);
    const window = windows.find((w) => w.id === windowId);

    if (!(group && window) || window.groupId) {
      return;
    }

    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) {
          return g;
        }
        return {
          ...g,
          windowIds: [...g.windowIds, windowId],
        };
      }),
      windows: state.windows.map((w) => {
        if (w.id !== windowId) {
          return w;
        }
        return { ...w, groupId };
      }),
    }));
  },

  removeFromGroup: (groupId, windowId) => {
    const { groups } = get();
    const group = groups.find((g) => g.id === groupId);

    if (!group) {
      return;
    }

    const remainingIds = group.windowIds.filter((id) => id !== windowId);

    if (remainingIds.length < 2) {
      get().dissolveGroup(groupId);
      return;
    }

    const newActiveId =
      group.activeWindowId === windowId
        ? (remainingIds[0] ?? group.activeWindowId)
        : group.activeWindowId;

    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) {
          return g;
        }
        return {
          ...g,
          windowIds: remainingIds,
          activeWindowId: newActiveId,
        };
      }),
      windows: state.windows.map((w) => {
        if (w.id !== windowId) {
          return w;
        }
        return {
          ...w,
          groupId: undefined,
          bounds: {
            ...group.bounds,
            x: group.bounds.x + 30,
            y: group.bounds.y + 30,
          },
        };
      }),
    }));
  },

  setActiveTab: (groupId, windowId) => {
    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId || !g.windowIds.includes(windowId)) {
          return g;
        }
        return { ...g, activeWindowId: windowId };
      }),
      windows: state.windows.map((w) => {
        if (w.groupId !== groupId) {
          return w;
        }
        return { ...w, isFocused: w.id === windowId };
      }),
    }));
  },

  nextTab: (groupId) => {
    const { groups } = get();
    const group = groups.find((g) => g.id === groupId);

    if (!group || group.windowIds.length < 2) {
      return;
    }

    const currentIndex = group.windowIds.indexOf(group.activeWindowId);
    const nextIndex = (currentIndex + 1) % group.windowIds.length;
    const nextId = group.windowIds[nextIndex];
    if (nextId) {
      get().setActiveTab(groupId, nextId);
    }
  },

  prevTab: (groupId) => {
    const { groups } = get();
    const group = groups.find((g) => g.id === groupId);

    if (!group || group.windowIds.length < 2) {
      return;
    }

    const currentIndex = group.windowIds.indexOf(group.activeWindowId);
    const prevIndex =
      (currentIndex - 1 + group.windowIds.length) % group.windowIds.length;
    const prevId = group.windowIds[prevIndex];
    if (prevId) {
      get().setActiveTab(groupId, prevId);
    }
  },

  focusGroup: (groupId) => {
    const { zIndexCounter } = get();

    set((state) => ({
      groups: state.groups.map((g) => ({
        ...g,
        isFocused: g.id === groupId,
        zIndex: g.id === groupId ? zIndexCounter + 1 : g.zIndex,
      })),
      zIndexCounter: state.zIndexCounter + 1,
    }));
  },
});
