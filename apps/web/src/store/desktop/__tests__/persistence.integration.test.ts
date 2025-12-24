import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createCacheSlice } from "../cache";

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
import { createContextSlice } from "../context";
import { createDockSlice } from "../dock";
import { createKnowledgeSlice } from "../knowledge";
import { DESKTOP_STORAGE_ID, persistOptions } from "../persist";
import type { DesktopState, WindowInstance } from "../types";
import { createViewportSlice } from "../viewport";
import { createWindowSlice } from "../windows";

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
        ...createWindowSlice(...a),
        ...createViewportSlice(...a),
        ...createDockSlice(...a),
        ...createCacheSlice(...a),
        ...createContextSlice(...a),
        ...createKnowledgeSlice(...a),
      }),
      persistOptions
    )
  );
}

function createTestWindow(id: string, type: string = "note"): WindowInstance {
  return {
    id,
    type,
    position: { x: Math.random() * 500, y: Math.random() * 500 },
    data: {
      type: type as any,
      label: `Test ${type}`,
      viewMode: "full",
    },
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

    it("persists and restores edge state", async () => {
      const store1 = createTestStore();

      store1.getState().addWindow(createTestWindow("note-1", "note"));
      store1.getState().addWindow(createTestWindow("note-2", "note"));
      store1.getState().setEdges([
        {
          id: "edge-1",
          source: "note-1",
          target: "note-2",
          type: "default",
        },
      ]);

      await new Promise((r) => setTimeout(r, 50));

      const store2 = createTestStore();
      await new Promise((r) => setTimeout(r, 50));

      expect(store2.getState().edges.length).toBe(1);
      expect(store2.getState().edges[0]?.source).toBe("note-1");
    });

    it("persists dock pins", async () => {
      const store1 = createTestStore();

      store1.getState().pinType("knowledge");
      store1.getState().unpinType("chat");

      await new Promise((r) => setTimeout(r, 50));

      const store2 = createTestStore();
      await new Promise((r) => setTimeout(r, 50));

      const pins = store2.getState().dockPins;
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

    it("does NOT persist activeEdges", async () => {
      const store1 = createTestStore();

      store1.getState().addWindow(createTestWindow("note-1"));
      store1.getState().addWindow(createTestWindow("note-2"));
      store1.getState().setEdges([
        { id: "edge-1", source: "note-1", target: "note-2", type: "default" },
      ]);
      store1.getState().triggerEdgeActivity("edge-1", 5000);

      await new Promise((r) => setTimeout(r, 50));

      const store2 = createTestStore();
      await new Promise((r) => setTimeout(r, 50));

      // Active edges should be empty on new store
      expect(store2.getState().activeEdges.size).toBe(0);
    });

    it("does NOT persist highlightedEdgeIds", async () => {
      const store1 = createTestStore();

      store1.getState().setHighlightedEdges(["edge-1", "edge-2"]);

      await new Promise((r) => setTimeout(r, 50));

      const store2 = createTestStore();
      await new Promise((r) => setTimeout(r, 50));

      expect(store2.getState().highlightedEdgeIds.size).toBe(0);
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
          edges: [], // Valid empty array
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
      expect(Array.isArray(state.edges)).toBe(true);
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

      // Typical usage: 10 windows, some edges, context cache
      for (let i = 0; i < 10; i++) {
        store.getState().addWindow(createTestWindow(`window-${i}`, "note"));
      }

      store.getState().setEdges([
        { id: "e1", source: "window-0", target: "window-1", type: "default" },
        { id: "e2", source: "window-1", target: "window-2", type: "default" },
      ]);

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
  });
});
