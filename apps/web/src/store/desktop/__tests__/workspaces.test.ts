/**
 * Workspace Slice Tests
 *
 * @see docs/execplans/desktop-critical-features-implementation.md Milestone 1
 */

import { describe, expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";

import type { WindowInstance } from "../types.new";
import type { WorkspaceSlice } from "../workspaces";

import { persistOptions } from "../persist";
import { createWorkspaceSlice } from "../workspaces";

type WorkspaceTestState = WorkspaceSlice & {
  windows: WindowInstance[];
  focusedWindowId: string | null;
  focusWindow: (windowId: string) => void;
};

function createTestWindow(params: {
  id: string;
  type: WindowInstance["type"];
  workspaceId: number;
  zIndex: number;
  isFocused?: boolean;
}): WindowInstance {
  const now = Date.now();
  return {
    id: params.id,
    type: params.type,
    data: { type: params.type, viewMode: "full" },
    workspaceId: params.workspaceId,
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    state: "normal",
    isTiled: false,
    zIndex: params.zIndex,
    isFocused: params.isFocused ?? false,
    minSize: { width: 100, height: 100 },
    resizable: true,
    createdAt: now,
    lastFocusedAt: now,
  };
}

function createWorkspaceTestStore() {
  return createStore<WorkspaceTestState>()((set, get, store) => ({
    windows: [],
    focusedWindowId: null,
    focusWindow: (windowId) => {
      set((state) => ({
        focusedWindowId: windowId,
        windows: state.windows.map((w) => ({
          ...w,
          isFocused: w.id === windowId,
        })),
      }));
    },
    ...createWorkspaceSlice(set as never, get as never, store as never),
  }));
}

describe("WorkspaceSlice", () => {
  test("switchWorkspace: switches to valid workspace", () => {
    const store = createWorkspaceTestStore();

    expect(store.getState().activeWorkspaceId).toBe(1);
    store.getState().switchWorkspace(3);
    expect(store.getState().activeWorkspaceId).toBe(3);
  });

  test("switchWorkspace: ignores invalid workspace IDs", () => {
    const store = createWorkspaceTestStore();

    store.getState().switchWorkspace(3);
    expect(store.getState().activeWorkspaceId).toBe(3);

    store.getState().switchWorkspace(0);
    expect(store.getState().activeWorkspaceId).toBe(3);

    store.getState().switchWorkspace(7);
    expect(store.getState().activeWorkspaceId).toBe(3);
  });

  test("nextWorkspace: cycles forward and wraps", () => {
    const store = createWorkspaceTestStore();

    store.setState({ activeWorkspaceId: 1 });
    store.getState().nextWorkspace();
    expect(store.getState().activeWorkspaceId).toBe(2);

    store.setState({ activeWorkspaceId: 6 });
    store.getState().nextWorkspace();
    expect(store.getState().activeWorkspaceId).toBe(1);
  });

  test("previousWorkspace: cycles backward and wraps", () => {
    const store = createWorkspaceTestStore();

    store.setState({ activeWorkspaceId: 3 });
    store.getState().previousWorkspace();
    expect(store.getState().activeWorkspaceId).toBe(2);

    store.setState({ activeWorkspaceId: 1 });
    store.getState().previousWorkspace();
    expect(store.getState().activeWorkspaceId).toBe(6);
  });

  test("switchWorkspace: clears focus when switching to empty workspace", () => {
    const store = createWorkspaceTestStore();

    store.setState({
      windows: [
        createTestWindow({
          id: "w1",
          type: "chat",
          workspaceId: 1,
          zIndex: 1,
          isFocused: true,
        }),
      ],
      focusedWindowId: "w1",
    });

    store.getState().switchWorkspace(2);
    expect(store.getState().activeWorkspaceId).toBe(2);
    expect(store.getState().focusedWindowId).toBeNull();
    expect(store.getState().windows[0]?.isFocused).toBe(false);
  });

  test("switchWorkspace: restores last focused window when available", () => {
    const store = createWorkspaceTestStore();

    const w1 = createTestWindow({
      id: "w1",
      type: "chat",
      workspaceId: 1,
      zIndex: 1,
      isFocused: true,
    });
    const w2a = createTestWindow({
      id: "w2a",
      type: "terminal",
      workspaceId: 2,
      zIndex: 2,
    });
    const w2b = createTestWindow({
      id: "w2b",
      type: "code",
      workspaceId: 2,
      zIndex: 3,
    });

    store.setState({
      windows: [w1, w2a, w2b],
      focusedWindowId: "w1",
      lastFocusedWindowIds: new Map([[2, "w2a"]]),
    });

    store.getState().switchWorkspace(2);
    expect(store.getState().activeWorkspaceId).toBe(2);
    expect(store.getState().focusedWindowId).toBe("w2a");
  });

  test("assignWindowToWorkspace: updates window and workspace membership", () => {
    const store = createWorkspaceTestStore();

    store.setState({
      windows: [
        createTestWindow({
          id: "w1",
          type: "chat",
          workspaceId: 1,
          zIndex: 1,
        }),
      ],
      workspaces: store
        .getState()
        .workspaces.map((ws) =>
          ws.id === 1 ? { ...ws, windowIds: ["w1"] } : ws
        ),
    });

    store.getState().assignWindowToWorkspace("w1", 2);
    expect(store.getState().windows[0]?.workspaceId).toBe(2);
    expect(
      store.getState().workspaces.find((ws) => ws.id === 1)?.windowIds
    ).toEqual([]);
    expect(
      store.getState().workspaces.find((ws) => ws.id === 2)?.windowIds
    ).toEqual(["w1"]);
  });

  test("moveWindowToWorkspace: switches workspace and focuses moved window", () => {
    const store = createWorkspaceTestStore();

    store.setState({
      windows: [
        createTestWindow({
          id: "w1",
          type: "chat",
          workspaceId: 1,
          zIndex: 1,
          isFocused: true,
        }),
      ],
      focusedWindowId: "w1",
      workspaces: store
        .getState()
        .workspaces.map((ws) =>
          ws.id === 1 ? { ...ws, windowIds: ["w1"] } : ws
        ),
    });

    store.getState().moveWindowToWorkspace("w1", 2);
    expect(store.getState().activeWorkspaceId).toBe(2);
    expect(store.getState().focusedWindowId).toBe("w1");
    expect(store.getState().windows[0]?.workspaceId).toBe(2);
  });

  test("isWindowInActiveWorkspace: checks by window.workspaceId", () => {
    const store = createWorkspaceTestStore();

    store.setState({
      activeWorkspaceId: 1,
      windows: [
        createTestWindow({ id: "w1", type: "chat", workspaceId: 1, zIndex: 1 }),
        createTestWindow({
          id: "w2",
          type: "terminal",
          workspaceId: 2,
          zIndex: 2,
        }),
      ],
    });

    expect(store.getState().isWindowInActiveWorkspace("w1")).toBe(true);
    expect(store.getState().isWindowInActiveWorkspace("w2")).toBe(false);
  });

  test("persist migration (v4->v5): assigns WindowInstance.workspaceId + hydrates Map", () => {
    const v4State = {
      windows: [
        {
          id: "w1",
          type: "chat",
          data: { type: "chat", viewMode: "full", workspaceId: 2 },
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          state: "normal",
          isTiled: false,
          zIndex: 1,
          isFocused: false,
          minSize: { width: 100, height: 100 },
          resizable: true,
          createdAt: 1,
          lastFocusedAt: 1,
        },
        {
          id: "w2",
          type: "terminal",
          data: { type: "terminal", viewMode: "full" },
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          state: "normal",
          isTiled: false,
          zIndex: 2,
          isFocused: false,
          minSize: { width: 100, height: 100 },
          resizable: true,
          createdAt: 1,
          lastFocusedAt: 1,
        },
      ],
      workspaces: [
        {
          id: 1,
          windowIds: ["w2"],
          tilingConfig: {
            layout: "float",
            gap: 8,
            mainRatio: 0.6,
            respectMinSize: true,
          },
        },
        {
          id: 2,
          windowIds: ["w1"],
          tilingConfig: {
            layout: "float",
            gap: 8,
            mainRatio: 0.6,
            respectMinSize: true,
          },
        },
        {
          id: 3,
          windowIds: [],
          tilingConfig: {
            layout: "float",
            gap: 8,
            mainRatio: 0.6,
            respectMinSize: true,
          },
        },
        {
          id: 4,
          windowIds: [],
          tilingConfig: {
            layout: "float",
            gap: 8,
            mainRatio: 0.6,
            respectMinSize: true,
          },
        },
        {
          id: 5,
          windowIds: [],
          tilingConfig: {
            layout: "float",
            gap: 8,
            mainRatio: 0.6,
            respectMinSize: true,
          },
        },
        {
          id: 6,
          windowIds: [],
          tilingConfig: {
            layout: "float",
            gap: 8,
            mainRatio: 0.6,
            respectMinSize: true,
          },
        },
      ],
      activeWorkspaceId: 2,
      lastFocusedWindowIds: [[2, "w1"]],
    };

    const migrated = persistOptions.migrate?.(
      v4State as never,
      4
    ) as unknown as {
      windows: { id: string; workspaceId: number }[];
      workspaces: { id: number; windowIds: string[] }[];
      lastFocusedWindowIds: Map<number, string | null>;
      activeWorkspaceId: number;
    };

    expect(migrated.activeWorkspaceId).toBe(2);
    expect(migrated.lastFocusedWindowIds instanceof Map).toBe(true);

    const w1 = migrated.windows.find((w) => w.id === "w1");
    const w2 = migrated.windows.find((w) => w.id === "w2");
    expect(w1?.workspaceId).toBe(2);
    expect(w2?.workspaceId).toBe(1);

    expect(migrated.workspaces.find((ws) => ws.id === 1)?.windowIds).toEqual([
      "w2",
    ]);
    expect(migrated.workspaces.find((ws) => ws.id === 2)?.windowIds).toEqual([
      "w1",
    ]);
  });
});
