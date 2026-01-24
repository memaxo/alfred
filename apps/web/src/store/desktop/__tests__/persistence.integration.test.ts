import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createCacheSlice } from "../cache";

const toastWarning = mock(() => {});
mock.module("sonner", () => ({
  toast: {
    warning: toastWarning,
  },
}));

// Inline performance helper (avoids cross-package dependency)
async function withBudget<T>(
  _name: string,
  budgetMs: number,
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number; withinBudget: boolean }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs, withinBudget: durationMs <= budgetMs };
}

import type { DesktopState, WindowInstance } from "../types.new";

import { createContextSlice } from "../context";
import { createKnowledgeSlice } from "../knowledge";
import { DESKTOP_STORAGE_ID, persistOptions } from "../persist";
import { createTaskbarSlice } from "../taskbar";
import { createTilingSlice } from "../tiling";
import { createViewportSliceNew } from "../viewport.new";
import { createWindowSliceNew } from "../windows.new";

// Mock localStorage
const mockStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
  get length() {
    return mockStorage.size;
  },
  key: (index: number) => Array.from(mockStorage.keys())[index] ?? null,
};

// @ts-expect-error - mocking global
globalThis.localStorage = mockLocalStorage;

function createTestStore() {
  return create<DesktopState>()(
    persist(
      (...a) => ({
        ...createWindowSliceNew(...a),
        ...createViewportSliceNew(...a),
        ...createTilingSlice(...a),
        ...createTaskbarSlice(...a),
        ...createCacheSlice(...a),
        ...createContextSlice(...a),
        ...createKnowledgeSlice(...a),
      }),
      persistOptions
    )
  );
}

function createTestWindow(id: string, type = "note"): WindowInstance {
  return {
    id,
    type: type as WindowInstance["type"],
    data: {
      type: type as WindowInstance["type"],
      label: `Test ${type}`,
      viewMode: "full",
    },
    bounds: {
      x: Math.random() * 500,
      y: Math.random() * 500,
      width: 400,
      height: 300,
    },
    state: "normal",
    isTiled: false,
    zIndex: 0,
    isFocused: false,
    minSize: { width: 200, height: 150 },
    resizable: true,
    createdAt: Date.now(),
    lastFocusedAt: Date.now(),
  };
}

describe("Desktop Persistence Integration", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  describe("serialize/deserialize cycle", () => {
    it("persists and restores window state", async () => {
      const store1 = createTestStore();

      // Add windows
      store1.getState().addWindow(createTestWindow("note-1", "note"));
      store1.getState().addWindow(createTestWindow("chat-1", "chat"));
      store1.getState().focusWindow("note-1");

      // Wait for persistence
      await new Promise((r) => setTimeout(r, 50));

      // Verify storage has data
      const stored = mockStorage.get(DESKTOP_STORAGE_ID);
      expect(stored).toBeDefined();

      // Create new store (simulates page reload)
      const store2 = createTestStore();

      // Wait for rehydration
      await new Promise((r) => setTimeout(r, 50));

      // Verify state restored
      const state2 = store2.getState();
      expect(state2.windows.length).toBe(2);
      expect(state2.windows.find((w) => w.id === "note-1")).toBeDefined();
      expect(state2.windows.find((w) => w.id === "chat-1")).toBeDefined();
      expect(state2.focusedWindowId).toBe("note-1");
    });

    it("persists dock pins", async () => {
      const store1 = createTestStore();

      // Use pinApp (new API) which updates both pinnedApps and dockPins
      store1.getState().pinApp("knowledge");
      store1.getState().unpinApp("chat");

      await new Promise((r) => setTimeout(r, 50));

      const store2 = createTestStore();
      await new Promise((r) => setTimeout(r, 50));

      const pins = store2.getState().pinnedApps;
      expect(pins).toContain("knowledge");
      expect(pins).not.toContain("chat");
    });

    it("persists context cache", async () => {
      const store1 = createTestStore();

      store1.getState().recordContextReceipt("window-1", {
        focusedGraphNodeId: "graph-123",
        ragDocIds: ["doc-1", "doc-2"],
        timestamp: Date.now(),
      });

      await new Promise((r) => setTimeout(r, 50));

      const store2 = createTestStore();
      await new Promise((r) => setTimeout(r, 50));

      const cache = store2.getState().contextCache;
      expect(cache["window-1"]).toBeDefined();
      expect(cache["window-1"]?.ragDocIds).toContain("doc-1");
    });

    it("persists feedback by window", async () => {
      const store1 = createTestStore();

      store1.getState().recordFeedback("window-1", "positive", "Good result");

      await new Promise((r) => setTimeout(r, 50));

      const store2 = createTestStore();
      await new Promise((r) => setTimeout(r, 50));

      const feedback = store2.getState().feedbackByWindow;
      expect(feedback["window-1"]).toBeDefined();
      expect(feedback["window-1"]?.intent).toBe("positive");
    });
  });

  describe("ephemeral state exclusion", () => {
    it("does NOT persist ragDocCache", async () => {
      const store1 = createTestStore();

      store1.getState().cacheRagDoc("doc-1", {
        id: "doc-1",
        content: "Test content",
        score: 0.9,
        source: "vector",
      });

      await new Promise((r) => setTimeout(r, 50));

      const stored = mockStorage.get(DESKTOP_STORAGE_ID);
      expect(stored).toBeDefined();

      // Parse and check ragDocCache is not in persisted state
      const parsed = JSON.parse(stored!);
      expect(parsed.state.ragDocCache).toBeUndefined();

      // New store should have empty cache
      const store2 = createTestStore();
      await new Promise((r) => setTimeout(r, 50));

      expect(store2.getState().ragDocCache).toEqual({});
    });
  });

  describe("migration", () => {
    it("migrates v1 state to v2 (adds context/feedback)", async () => {
      // Simulate v1 persisted state
      const v1State = {
        state: {
          windows: [createTestWindow("note-1")],
          edges: [],
          focusedWindowId: "note-1",
          isSpaceMode: false,
          dockPins: ["chat", "note"],
        },
        version: 1,
      };

      mockStorage.set(DESKTOP_STORAGE_ID, JSON.stringify(v1State));

      const store = createTestStore();
      await new Promise((r) => setTimeout(r, 50));

      // Should have migrated state with empty context/feedback
      const state = store.getState();
      expect(state.contextCache).toEqual({});
      expect(state.feedbackByWindow).toEqual({});
      expect(state.windows.length).toBe(1);
    });
  });

  describe("corrupted storage handling", () => {
    it("handles corrupted JSON gracefully", async () => {
      mockStorage.set(DESKTOP_STORAGE_ID, "not valid json {{{");

      // Should not throw
      const store = createTestStore();
      await new Promise((r) => setTimeout(r, 50));

      // Should have default state
      const state = store.getState();
      expect(state.windows).toBeDefined();
      expect(Array.isArray(state.windows)).toBe(true);
    });

    it("handles missing required fields gracefully", async () => {
      const partialState = {
        state: {
          windows: [], // Valid empty array
          // Missing other fields
        },
        version: 2,
      };

      mockStorage.set(DESKTOP_STORAGE_ID, JSON.stringify(partialState));

      const store = createTestStore();
      await new Promise((r) => setTimeout(r, 50));

      // Should have merged state with defaults
      const state = store.getState();
      expect(Array.isArray(state.windows)).toBe(true);
      // Default slices should still work
      expect(typeof state.focusWindow).toBe("function");
    });
  });

  describe("performance", () => {
    it("serializes 50 windows within budget", async () => {
      const store = createTestStore();

      // Add 50 windows
      for (let i = 0; i < 50; i++) {
        store.getState().addWindow(createTestWindow(`note-${i}`, "note"));
      }

      const { withinBudget, durationMs } = await withBudget(
        "persist-50-windows",
        100, // 100ms budget
        async () => {
          // Force a persist cycle
          store.getState().focusWindow("note-0");
          await new Promise((r) => setTimeout(r, 50));
          return mockStorage.get(DESKTOP_STORAGE_ID);
        }
      );

      expect(withinBudget).toBe(true);
      expect(durationMs).toBeLessThan(100);
    });

    it("deserializes 50 windows within budget", async () => {
      // Pre-populate storage with 50 windows
      const windows = Array.from({ length: 50 }, (_, i) =>
        createTestWindow(`note-${i}`, "note")
      );

      const state = {
        state: {
          windows,
          edges: [],
          focusedWindowId: "note-0",
          isSpaceMode: false,
          dockPins: ["chat", "note"],
          contextCache: {},
          feedbackByWindow: {},
        },
        version: 2,
      };

      mockStorage.set(DESKTOP_STORAGE_ID, JSON.stringify(state));

      const { withinBudget, durationMs } = await withBudget(
        "hydrate-50-windows",
        100, // 100ms budget
        async () => {
          const store = createTestStore();
          await new Promise((r) => setTimeout(r, 50));
          return store.getState().windows.length;
        }
      );

      expect(withinBudget).toBe(true);
      expect(durationMs).toBeLessThan(100);
    });
  });

  describe("storage size", () => {
    it("keeps persisted state under 50KB for typical usage", async () => {
      const store = createTestStore();

      // Typical usage: 10 windows, context cache
      for (let i = 0; i < 10; i++) {
        store.getState().addWindow(createTestWindow(`window-${i}`, "note"));
      }

      for (let i = 0; i < 5; i++) {
        store.getState().recordContextReceipt(`window-${i}`, {
          focusedGraphNodeId: `graph-${i}`,
          ragDocIds: [`doc-${i}-1`, `doc-${i}-2`],
          timestamp: Date.now(),
        });
      }

      await new Promise((r) => setTimeout(r, 50));

      const stored = mockStorage.get(DESKTOP_STORAGE_ID);
      expect(stored).toBeDefined();

      const sizeKB = new Blob([stored!]).size / 1024;
      expect(sizeKB).toBeLessThan(50);
    });

    it("prunes context cache when over 50KB budget", async () => {
      const store = createTestStore();

      // Add one massive window to exceed budget
      const massiveWindow = createTestWindow("big-1");
      massiveWindow.data.label = "x".repeat(60 * 1024); // ~60KB
      store.getState().addWindow(massiveWindow);

      // Add something to the context cache
      store.getState().recordContextReceipt("win-1", {
        focusedGraphNodeId: "g1",
        ragDocIds: ["d1"],
        timestamp: Date.now(),
      });

      // Trigger persist
      await new Promise((r) => setTimeout(r, 50));

      const stored = mockStorage.get(DESKTOP_STORAGE_ID);
      expect(stored).toBeDefined();

      const parsed = JSON.parse(stored!);
      // contextCache should have been pruned (empty object)
      expect(parsed.state.contextCache).toEqual({});
      expect(toastWarning).toHaveBeenCalled();
    });
  });
});
