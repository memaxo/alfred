import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { layoutSyncService } from "@/lib/mindscape/layout-sync";

// No wait helper needed - forceSync is synchronous

describe("LayoutSyncService", () => {
  let mockSyncClient: {
    setPreference: ReturnType<typeof mock>;
    getPreferences: ReturnType<typeof mock>;
  };

  beforeEach(() => {
    // Reset service state
    layoutSyncService.destroy();

    // Mock requestIdleCallback to execute immediately (no delays in tests)
    // @ts-expect-error - Override for testing
    global.requestIdleCallback = ((callback: () => void) => {
      // Execute immediately in tests
      Promise.resolve().then(() => callback());
      return 1;
    }) as typeof requestIdleCallback;

    // Create fresh mocks that resolve immediately
    mockSyncClient = {
      setPreference: mock(async () => ({})),
      getPreferences: mock(async () => []),
    };
  });

  afterEach(() => {
    layoutSyncService.destroy();
    mockSyncClient.setPreference.mockClear();
    mockSyncClient.getPreferences.mockClear();
  });

  describe("initialization", () => {
    it("initializes with userId and sync client", () => {
      layoutSyncService.init("user-123", mockSyncClient);
      // Service should be ready (no errors thrown)
      expect(mockSyncClient.getPreferences).toHaveBeenCalled();
    });

    it("loads saved layout on initialization", async () => {
      const savedLayout = [
        { id: "node-1", position: { x: 100, y: 200 } },
        { id: "node-2", position: { x: 300, y: 400 } },
      ];

      mockSyncClient.getPreferences.mockResolvedValue([
        {
          key: "mindscape:layout",
          value: {
            nodes: savedLayout,
            version: "v2",
            updatedAt: Date.now(),
          },
        },
      ]);

      layoutSyncService.init("user-123", mockSyncClient);
      // getSavedLayout is async, wait for it
      const loaded = await layoutSyncService.getSavedLayout();
      expect(loaded).toEqual(savedLayout);
    });

    it("handles missing layout gracefully", async () => {
      mockSyncClient.getPreferences.mockResolvedValue([]);

      layoutSyncService.init("user-123", mockSyncClient);
      const loaded = await layoutSyncService.getSavedLayout();
      expect(loaded).toBeNull();
    });
  });

  describe("debouncing", () => {
    it("queues updates without immediate sync", () => {
      layoutSyncService.init("user-123", mockSyncClient);

      // Queue rapid updates
      for (let i = 0; i < 10; i++) {
        layoutSyncService.queueUpdate(`node-${i}`, { x: i * 10, y: i * 20 });
      }

      // Should not sync immediately (debounced)
      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();
    });

    it("schedules sync after queueing updates", () => {
      layoutSyncService.init("user-123", mockSyncClient);

      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      // Service should have scheduled sync (can't verify timer directly in Bun)
      // But we can verify it doesn't sync immediately
      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();
    });
  });

  describe("batching", () => {
    it("queues multiple nodes for batching", () => {
      layoutSyncService.init("user-123", mockSyncClient);

      // Queue 30 nodes
      for (let i = 0; i < 30; i++) {
        layoutSyncService.queueUpdate(`node-${i}`, { x: i * 10, y: i * 20 });
      }

      // All nodes should be queued (verified via forceSync)
      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();
    });

    it("batches nodes when force syncing", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      // Queue 30 nodes
      for (let i = 0; i < 30; i++) {
        layoutSyncService.queueUpdate(`node-${i}`, { x: i * 10, y: i * 20 });
      }

      // Force sync to verify batching
      await layoutSyncService.forceSync();

      // Should sync once with all 30 nodes
      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);
      const call = mockSyncClient.setPreference.mock.calls[0]?.[0];
      expect(call?.value?.nodes).toHaveLength(30);
    });

    it("respects MAX_BATCH_SIZE limit (50 nodes)", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      // Queue 100 nodes (exceeds batch size)
      for (let i = 0; i < 100; i++) {
        layoutSyncService.queueUpdate(`node-${i}`, { x: i * 10, y: i * 20 });
      }

      await layoutSyncService.forceSync();

      // First batch should have 50 nodes
      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);
      const firstCall = mockSyncClient.setPreference.mock.calls[0]?.[0];
      expect(firstCall?.value?.nodes).toHaveLength(50);
    });
  });

  describe("error handling", () => {
    it("handles sync failures gracefully", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      const dbError = new Error("Database connection failed");
      mockSyncClient.setPreference.mockRejectedValueOnce(dbError);

      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      await layoutSyncService.forceSync();

      // Service should still be functional
      expect(mockSyncClient.setPreference).toHaveBeenCalled();

      // Pending nodes should be retained (not cleared on error)
      layoutSyncService.queueUpdate("node-2", { x: 30, y: 40 });
      mockSyncClient.setPreference.mockResolvedValueOnce({});

      await layoutSyncService.forceSync();

      // Should retry sync (both nodes should be synced)
      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(2);
    });

    it("handles missing sync client gracefully", async () => {
      // Don't initialize - no sync client
      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      await layoutSyncService.forceSync();

      // Should not crash, just not sync
      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();
    });

    it("handles missing userId gracefully", async () => {
      // Don't initialize - no userId
      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      await layoutSyncService.forceSync();

      // Should not crash
      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();
    });
  });

  describe("polling", () => {
    it("starts polling on initialization", () => {
      layoutSyncService.init("user-123", mockSyncClient);

      // Polling should be active (can't verify timer directly, but service should be ready)
      expect(mockSyncClient.getPreferences).toHaveBeenCalled();
    });

    it("does not sync when no pending updates", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      // No updates queued, force sync should be no-op
      await layoutSyncService.forceSync();

      // Should not sync (no pending updates)
      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();
    });
  });

  describe("forceSync", () => {
    it("forces immediate sync bypassing debounce", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      // Force sync immediately (before debounce delay)
      await layoutSyncService.forceSync();

      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);
    });

    it("clears pending queue after successful sync", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      await layoutSyncService.forceSync();

      // Queue should be cleared
      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);

      // Force sync again - should be no-op
      await layoutSyncService.forceSync();

      // Should still be 1 call (no pending nodes)
      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);
    });

    it("handles force sync with no pending updates", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      await layoutSyncService.forceSync();

      // Should not crash, just no-op
      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("clears timers on destroy", async () => {
      layoutSyncService.init("user-123", mockSyncClient);
      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      layoutSyncService.destroy();

      // Force sync should be no-op (timers cleared, queue cleared)
      await layoutSyncService.forceSync();

      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();
    });

    it("clears pending nodes on destroy", async () => {
      layoutSyncService.init("user-123", mockSyncClient);
      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });
      layoutSyncService.queueUpdate("node-2", { x: 30, y: 40 });

      layoutSyncService.destroy();

      // Force sync should have nothing to sync
      await layoutSyncService.forceSync();

      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();
    });

    it("resets userId on destroy", async () => {
      layoutSyncService.init("user-123", mockSyncClient);
      layoutSyncService.destroy();

      // Should not sync without userId
      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });
      await layoutSyncService.forceSync();

      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();
    });
  });

  describe("queueBatch", () => {
    it("queues multiple updates at once", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      const updates = [
        { id: "node-1", position: { x: 10, y: 20 } },
        { id: "node-2", position: { x: 30, y: 40 } },
        { id: "node-3", position: { x: 50, y: 60 } },
      ];

      layoutSyncService.queueBatch(updates);

      await layoutSyncService.forceSync();

      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);
      const call = mockSyncClient.setPreference.mock.calls[0]?.[0];
      expect(call?.value?.nodes).toHaveLength(3);
    });

    it("merges with existing pending updates", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });
      layoutSyncService.queueBatch([
        { id: "node-2", position: { x: 30, y: 40 } },
        { id: "node-3", position: { x: 50, y: 60 } },
      ]);

      await layoutSyncService.forceSync();

      const call = mockSyncClient.setPreference.mock.calls[0]?.[0];
      expect(call?.value?.nodes).toHaveLength(3);
    });
  });

  describe("snapshot format", () => {
    it("saves layout with correct snapshot format", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      await layoutSyncService.forceSync();

      const call = mockSyncClient.setPreference.mock.calls[0]?.[0];
      expect(call).toMatchObject({
        key: "mindscape:layout",
        value: {
          nodes: [{ id: "node-1", position: { x: 10, y: 20 } }],
          version: "v2",
          updatedAt: expect.any(Number),
        },
      });
    });
  });
});
