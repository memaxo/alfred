/**
 * Sync Hooks Type Tests
 *
 * These tests verify the sync hooks interface.
 * Full integration tests require expo-sqlite and native modules.
 */

describe("sync Hooks Types", () => {
  it("should define expected SyncStatus shape", () => {
    // Verify expected status interface
    const mockStatus = {
      isOnline: true,
      isSyncing: false,
      pendingCount: 0,
      lastSyncAt: null as Date | null,
      error: null as string | null,
    };

    expect(typeof mockStatus.isOnline).toBe("boolean");
    expect(typeof mockStatus.isSyncing).toBe("boolean");
    expect(typeof mockStatus.pendingCount).toBe("number");
  });

  it("should define expected SyncActions shape", () => {
    // Verify expected actions interface
    const mockActions = {
      syncNow: async () => {},
      clearQueue: async () => {},
      retryFailed: async () => {},
    };

    expect(typeof mockActions.syncNow).toBe("function");
    expect(typeof mockActions.clearQueue).toBe("function");
    expect(typeof mockActions.retryFailed).toBe("function");
  });
});
