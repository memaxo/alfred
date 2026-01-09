import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { create } from "zustand";
import { createCacheSlice } from "../cache";
import { createContextSlice } from "../context";
import { createGroupSlice } from "../groups";
import { createKnowledgeSlice } from "../knowledge";
import { createTaskbarSlice } from "../taskbar";
import { createTilingSlice } from "../tiling";
import type { DesktopState } from "../types.new";
import { createViewportSliceNew } from "../viewport.new";
import { createWindowSliceNew } from "../windows.new";

function createTestStore() {
  return create<DesktopState>()((...a) => ({
    ...createWindowSliceNew(...a),
    ...createGroupSlice(...a),
    ...createViewportSliceNew(...a),
    ...createTilingSlice(...a),
    ...createTaskbarSlice(...a),
    ...createCacheSlice(...a),
    ...createContextSlice(...a),
    ...createKnowledgeSlice(...a),
  }));
}

describe("groups slice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  afterEach(() => {
    store.getState().closeAllWindows();
  });

  describe("createGroup", () => {
    it("creates a group from two windows", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");

      const groupId = store.getState().createGroup([id1, id2]);

      expect(groupId).toBeTruthy();
      expect(store.getState().groups).toHaveLength(1);
      expect(store.getState().groups[0].windowIds).toEqual([id1, id2]);
      expect(store.getState().groups[0].activeWindowId).toBe(id1);
    });

    it("assigns groupId to windows", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");

      const groupId = store.getState().createGroup([id1, id2]);

      const w1 = store.getState().windows.find((w) => w.id === id1);
      const w2 = store.getState().windows.find((w) => w.id === id2);

      expect(w1?.groupId).toBe(groupId);
      expect(w2?.groupId).toBe(groupId);
    });

    it("returns empty string for less than 2 windows", () => {
      const id1 = store.getState().openWindow("chat");

      const groupId = store.getState().createGroup([id1]);

      expect(groupId).toBe("");
      expect(store.getState().groups).toHaveLength(0);
    });

    it("uses largest window bounds for group", () => {
      const id1 = store.getState().openWindow("chat", undefined, {
        x: 100,
        y: 100,
        width: 400,
        height: 300,
      });
      const id2 = store.getState().openWindow("terminal", undefined, {
        x: 150,
        y: 150,
        width: 600,
        height: 500,
      });

      store.getState().createGroup([id1, id2]);

      expect(store.getState().groups[0].bounds.width).toBe(600);
      expect(store.getState().groups[0].bounds.height).toBe(500);
    });
  });

  describe("dissolveGroup", () => {
    it("removes group and unassigns windows", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");
      const groupId = store.getState().createGroup([id1, id2]);

      store.getState().dissolveGroup(groupId);

      expect(store.getState().groups).toHaveLength(0);
      expect(
        store.getState().windows.find((w) => w.id === id1)?.groupId
      ).toBeUndefined();
      expect(
        store.getState().windows.find((w) => w.id === id2)?.groupId
      ).toBeUndefined();
    });

    it("cascades window positions when dissolving", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");
      const groupId = store.getState().createGroup([id1, id2]);

      const groupBounds = store.getState().groups[0].bounds;
      store.getState().dissolveGroup(groupId);

      const w1 = store.getState().windows.find((w) => w.id === id1);
      const w2 = store.getState().windows.find((w) => w.id === id2);

      expect(w1?.bounds.x).toBe(groupBounds.x);
      expect(w2?.bounds.x).toBe(groupBounds.x + 30);
    });
  });

  describe("addToGroup", () => {
    it("adds window to existing group", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");
      const id3 = store.getState().openWindow("settings");
      const groupId = store.getState().createGroup([id1, id2]);

      store.getState().addToGroup(groupId, id3);

      expect(store.getState().groups[0].windowIds).toContain(id3);
      expect(store.getState().windows.find((w) => w.id === id3)?.groupId).toBe(
        groupId
      );
    });

    it("does not add already grouped window", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");
      const id3 = store.getState().openWindow("settings");
      const groupId = store.getState().createGroup([id1, id2]);
      store.getState().addToGroup(groupId, id3);

      store.getState().addToGroup(groupId, id3);

      expect(
        store.getState().groups[0].windowIds.filter((id) => id === id3)
      ).toHaveLength(1);
    });
  });

  describe("removeFromGroup", () => {
    it("removes window from group", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");
      const id3 = store.getState().openWindow("settings");
      const groupId = store.getState().createGroup([id1, id2, id3]);

      store.getState().removeFromGroup(groupId, id3);

      expect(store.getState().groups[0].windowIds).not.toContain(id3);
      expect(
        store.getState().windows.find((w) => w.id === id3)?.groupId
      ).toBeUndefined();
    });

    it("dissolves group when only one window remains", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");
      const groupId = store.getState().createGroup([id1, id2]);

      store.getState().removeFromGroup(groupId, id2);

      expect(store.getState().groups).toHaveLength(0);
    });

    it("updates activeWindowId when removing active tab", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");
      const id3 = store.getState().openWindow("settings");
      const groupId = store.getState().createGroup([id1, id2, id3]);

      store.getState().removeFromGroup(groupId, id1);

      expect(store.getState().groups[0].activeWindowId).toBe(id2);
    });
  });

  describe("tab navigation", () => {
    it("setActiveTab changes active window", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");
      const groupId = store.getState().createGroup([id1, id2]);

      store.getState().setActiveTab(groupId, id2);

      expect(store.getState().groups[0].activeWindowId).toBe(id2);
    });

    it("nextTab cycles forward", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");
      const id3 = store.getState().openWindow("settings");
      const groupId = store.getState().createGroup([id1, id2, id3]);

      store.getState().nextTab(groupId);

      expect(store.getState().groups[0].activeWindowId).toBe(id2);

      store.getState().nextTab(groupId);

      expect(store.getState().groups[0].activeWindowId).toBe(id3);

      store.getState().nextTab(groupId);

      expect(store.getState().groups[0].activeWindowId).toBe(id1);
    });

    it("prevTab cycles backward", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");
      const id3 = store.getState().openWindow("settings");
      const groupId = store.getState().createGroup([id1, id2, id3]);

      store.getState().prevTab(groupId);

      expect(store.getState().groups[0].activeWindowId).toBe(id3);
    });
  });

  describe("focusGroup", () => {
    it("updates group zIndex and focus state", () => {
      const id1 = store.getState().openWindow("chat");
      const id2 = store.getState().openWindow("terminal");
      const id3 = store.getState().openWindow("settings");
      const id4 = store.getState().openWindow("notes");

      const groupId1 = store.getState().createGroup([id1, id2]);
      const groupId2 = store.getState().createGroup([id3, id4]);

      const initialZ = store
        .getState()
        .groups.find((g) => g.id === groupId1)?.zIndex;

      store.getState().focusGroup(groupId1);

      const g1 = store.getState().groups.find((g) => g.id === groupId1);
      const g2 = store.getState().groups.find((g) => g.id === groupId2);

      expect(g1?.isFocused).toBe(true);
      expect(g2?.isFocused).toBe(false);
      expect(g1?.zIndex).toBeGreaterThan(initialZ ?? 0);
    });
  });
});
