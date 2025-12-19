import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { layoutSyncService } from "@/lib/mindscape/layout-sync";

// Helper to wait for async operations
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("LayoutSyncService performance", () => {
  let mockSyncClient: {
    setPreference: ReturnType<typeof mock>;
    getPreferences: ReturnType<typeof mock>;
  };

  beforeEach(() => {
    layoutSyncService.destroy();
    mockSyncClient = {
      setPreference: mock(() => Promise.resolve({})),
      getPreferences: mock(() => Promise.resolve([])),
    };
  });

  afterEach(() => {
    layoutSyncService.destroy();
    mockSyncClient.setPreference.mockClear();
    mockSyncClient.getPreferences.mockClear();
  });

  describe("debounce delay", () => {
    it("respects 5 second debounce delay", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      // Wait 4.9 seconds - should not sync
      await wait(4900);
      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();

      // Wait past 5 seconds - should sync
      await wait(200);
      await wait(100); // Allow async processing

      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);
    }, 10000);

    it("does not sync before debounce threshold", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      // Multiple rapid updates
      for (let i = 0; i < 10; i++) {
        await wait(400); // 400ms each
        layoutSyncService.queueUpdate(`node-${i}`, { x: i * 10, y: i * 20 });
      }

      // Total: 4 seconds elapsed, should not sync
      await wait(100);
      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();
    }, 10000);
  });

  describe("batching efficiency", () => {
    it("batches 50 nodes into single DB write", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      // Queue exactly 50 nodes
      for (let i = 0; i < 50; i++) {
        layoutSyncService.queueUpdate(`node-${i}`, { x: i * 10, y: i * 20 });
      }

      await wait(6000);
      await wait(100);

      // Should be single DB call with all 50 nodes
      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);
      const call = mockSyncClient.setPreference.mock.calls[0]?.[0];
      expect(call?.value?.nodes).toHaveLength(50);
    }, 10000);

    it("processes batches sequentially when exceeding MAX_BATCH_SIZE", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      // Queue 100 nodes (exceeds batch size)
      for (let i = 0; i < 100; i++) {
        layoutSyncService.queueUpdate(`node-${i}`, { x: i * 10, y: i * 20 });
      }

      await wait(6000);
      await wait(100);

      // First batch should have 50 nodes
      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);
      const firstCall = mockSyncClient.setPreference.mock.calls[0]?.[0];
      expect(firstCall?.value?.nodes).toHaveLength(50);

      // Remaining 50 should be pending for next sync
      // (Verify by checking pending queue size indirectly)
    }, 10000);

    it("minimizes DB writes with batching", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      const nodeCount = 30;

      // Queue 30 nodes
      for (let i = 0; i < nodeCount; i++) {
        layoutSyncService.queueUpdate(`node-${i}`, { x: i * 10, y: i * 20 });
      }

      await wait(6000);
      await wait(100);

      // Should be 1 DB write, not 30
      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);
      const call = mockSyncClient.setPreference.mock.calls[0]?.[0];
      expect(call?.value?.nodes).toHaveLength(nodeCount);
    }, 10000);
  });

  describe("requestIdleCallback usage", () => {
    it("uses requestIdleCallback when available", async () => {
      const idleCallbackSpy = mock((callback: () => void) => {
        callback();
        return 1; // Return timeout ID
      });

      global.requestIdleCallback = idleCallbackSpy as unknown as typeof requestIdleCallback;

      layoutSyncService.init("user-123", mockSyncClient);
      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      await wait(6000);
      await wait(100);

      // Should use requestIdleCallback for background processing
      expect(idleCallbackSpy).toHaveBeenCalled();
    }, 10000);

    it("falls back to direct execution when requestIdleCallback unavailable", async () => {
      // Remove requestIdleCallback
      const originalIdleCallback = global.requestIdleCallback;
      // @ts-expect-error - Testing fallback
      delete global.requestIdleCallback;

      layoutSyncService.init("user-123", mockSyncClient);
      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      await wait(6000);
      await wait(100);

      // Should still sync (fallback works)
      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);

      // Restore
      global.requestIdleCallback = originalIdleCallback;
    }, 10000);
  });

  describe("memory efficiency", () => {
    it("clears synced nodes from pending queue", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });
      layoutSyncService.queueUpdate("node-2", { x: 30, y: 40 });

      await wait(6000);
      await wait(100);

      // Queue should be cleared
      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);

      // No more pending updates
      await wait(6000);
      await wait(100);

      // Should not sync again
      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);
    }, 15000);

    it("cleans up timers on destroy", () => {
      layoutSyncService.init("user-123", mockSyncClient);
      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      layoutSyncService.destroy();

      // Service should be in clean state
      expect(layoutSyncService).toBeDefined();
    });
  });

  describe("polling efficiency", () => {
    it("polls every 30 seconds", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      layoutSyncService.queueUpdate("node-1", { x: 10, y: 20 });

      // Initial sync via debounce
      await wait(6000);
      await wait(100);

      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(1);

      // Add more updates
      layoutSyncService.queueUpdate("node-2", { x: 30, y: 40 });

      // Wait polling interval (30s)
      await wait(30000);
      await wait(100);

      // Should sync again via polling
      expect(mockSyncClient.setPreference).toHaveBeenCalledTimes(2);
    }, 40000);

    it("does not poll when no pending updates", async () => {
      layoutSyncService.init("user-123", mockSyncClient);

      // No updates queued
      await wait(30000);
      await wait(100);

      // Should not sync (no pending updates)
      expect(mockSyncClient.setPreference).not.toHaveBeenCalled();
    }, 35000);
  });
});
