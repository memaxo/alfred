/**
 * Mindscape Layout Sync
 * 
 * Background service for persisting node positions to database with:
 * - Debounced writes (5s idle delay)
 * - Batched updates (group multiple position changes)
 * - Low resource impact (requestIdleCallback + polling)
 * - Conflict resolution (last-write-wins with timestamp)
 */

const SYNC_DEBOUNCE_MS = 5000; // Wait 5s after last change before syncing
const SYNC_INTERVAL_MS = 30000; // Poll every 30s even if no changes
const MAX_BATCH_SIZE = 50; // Max nodes to sync per batch

type LayoutSnapshot = {
  nodes: Array<{ id: string; position: { x: number; y: number } }>;
  version: string;
  updatedAt: number;
};

type SyncClient = {
  setPreference: (input: { key: string; value: unknown }) => Promise<unknown>;
  getPreferences: () => Promise<Array<{ key: string; value: unknown }>>;
};

class LayoutSyncService {
  private pendingNodes = new Map<string, { x: number; y: number }>();
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private lastSyncTime = 0;
  private userId: string | null = null;
  private syncClient: SyncClient | null = null;

  /**
   * Initialize the sync service
   */
  init(userId: string, syncClient: SyncClient) {
    this.userId = userId;
    this.syncClient = syncClient;
    this.startPolling();
    this.loadFromDb();
  }

  /**
   * Queue a node position update for sync
   */
  queueUpdate(nodeId: string, position: { x: number; y: number }) {
    this.pendingNodes.set(nodeId, position);
    this.scheduleSync();
  }

  /**
   * Queue multiple node updates (e.g., from physics simulation)
   */
  queueBatch(updates: Array<{ id: string; position: { x: number; y: number } }>) {
    for (const update of updates) {
      this.pendingNodes.set(update.id, update.position);
    }
    this.scheduleSync();
  }

  /**
   * Schedule a debounced sync
   */
  private scheduleSync() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      this.flushSync();
    }, SYNC_DEBOUNCE_MS);
  }

  /**
   * Flush pending updates to database
   */
  private async flushSync() {
    if (this.isSyncing || this.pendingNodes.size === 0 || !this.userId || !this.syncClient) {
      return;
    }

    this.isSyncing = true;

    try {
      // Use requestIdleCallback for low-priority background work
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(
          async () => {
            await this.performSync();
          },
          { timeout: 10000 }
        );
      } else {
        // Fallback for browsers without requestIdleCallback
        await this.performSync();
      }
    } catch (error) {
      console.error("layout_sync_failed", {
        error: error instanceof Error ? error.message : String(error),
        pendingCount: this.pendingNodes.size,
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Perform the actual sync operation
   */
  private async performSync() {
    if (this.pendingNodes.size === 0 || !this.userId || !this.syncClient) {
      return;
    }

    // Batch nodes (limit size to avoid large payloads)
    const nodesArray = Array.from(this.pendingNodes.entries())
      .slice(0, MAX_BATCH_SIZE)
      .map(([id, position]) => ({ id, position }));

    const snapshot: LayoutSnapshot = {
      nodes: nodesArray,
      version: "v2",
      updatedAt: Date.now(),
    };

    try {
      await this.syncClient.setPreference({
        key: "mindscape:layout",
        value: snapshot,
      });

      // Clear synced nodes
      for (const node of nodesArray) {
        this.pendingNodes.delete(node.id);
      }

      this.lastSyncTime = Date.now();
    } catch (error) {
      // Log error but don't throw - sync failures shouldn't break UI
      console.warn("layout_sync_db_failed", {
        error: error instanceof Error ? error.message : String(error),
        nodeCount: nodesArray.length,
      });
    }
  }

  /**
   * Start periodic polling (fallback for missed updates)
   */
  private startPolling() {
    if (this.pollTimer) {
      return;
    }

    this.pollTimer = setInterval(() => {
      // Only sync if we have pending updates and haven't synced recently
      if (
        this.pendingNodes.size > 0 &&
        Date.now() - this.lastSyncTime > SYNC_DEBOUNCE_MS
      ) {
        this.flushSync();
      }
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Load layout from database on mount
   */
  private async loadFromDb() {
    if (!this.userId) {
      return null;
    }

    if (!this.syncClient) {
      return null;
    }

    try {
      const prefs = await this.syncClient.getPreferences();
      const layoutPref = prefs.find((p) => p.key === "mindscape:layout");

      if (layoutPref?.value && typeof layoutPref.value === "object") {
        const snapshot = layoutPref.value as LayoutSnapshot;
        return snapshot.nodes;
      }
    } catch (error) {
      console.warn("layout_load_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  /**
   * Get saved layout from database (for hydration)
   */
  async getSavedLayout(): Promise<
    Array<{ id: string; position: { x: number; y: number } }> | null
  > {
    return this.loadFromDb();
  }

  /**
   * Force immediate sync (e.g., on page unload)
   */
  async forceSync() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.pendingNodes.size > 0 && this.syncClient) {
      await this.performSync();
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.pendingNodes.clear();
    this.userId = null;
  }
}

// Singleton instance
export const layoutSyncService = new LayoutSyncService();
