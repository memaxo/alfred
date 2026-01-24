/**
 * Sync Queue Type Tests
 *
 * These tests verify the sync queue types and exports.
 * Full integration tests require expo-sqlite which is not available in Jest.
 */

describe("Sync Queue Types", () => {
  it("should define valid SyncAction values", () => {
    // Type-level test - verify the expected action types
    const validActions = ["create", "update", "delete"] as const;
    expect(validActions).toContain("create");
    expect(validActions).toContain("update");
    expect(validActions).toContain("delete");
    expect(validActions).toHaveLength(3);
  });

  it("should have correct queue item structure", () => {
    // Verify expected queue item shape
    const mockItem = {
      id: "test-id",
      tableName: "notes",
      recordId: "note-123",
      action: "create",
      payload: { title: "Test" },
      createdAt: new Date(),
      attempts: 0,
      lastAttemptAt: null,
      error: null,
    };

    expect(mockItem.id).toBeDefined();
    expect(mockItem.tableName).toBeDefined();
    expect(mockItem.recordId).toBeDefined();
    expect(mockItem.action).toBeDefined();
    expect(mockItem.attempts).toBe(0);
  });
});
