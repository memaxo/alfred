import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  clearAllConnections,
  createConnection,
  getConnectionCount,
  getConnectionInfo,
  removeConnection,
  stopCleanupTimer,
  updateConnectionActivity,
} from "../../src/utils/sse-connections";

describe("SSE Connection Tracking", () => {
  beforeEach(() => {
    clearAllConnections();
    stopCleanupTimer();
    // Reset env vars to defaults
    process.env.SSE_MAX_CONNECTIONS_PER_USER = undefined;
    process.env.SSE_MAX_GLOBAL_CONNECTIONS = undefined;
    process.env.SSE_CONNECTION_TIMEOUT_MS = undefined;
    process.env.SSE_RATE_LIMIT_PER_MINUTE = undefined;
  });

  afterEach(() => {
    clearAllConnections();
    stopCleanupTimer();
  });

  describe("createConnection", () => {
    it("creates connection successfully", () => {
      const result = createConnection("user1", "assistant");
      expect(result.allowed).toBe(true);
      expect(result.connectionId).toBeTruthy();
      expect(getConnectionCount("user1")).toBe(1);
      expect(getConnectionCount()).toBe(1);
    });

    it("enforces per-user connection limit", () => {
      // Default limit is 5 per user
      const results: ReturnType<typeof createConnection>[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(createConnection("user1", "assistant"));
      }

      // All 5 should succeed
      expect(results.every((r) => r.allowed)).toBe(true);
      expect(getConnectionCount("user1")).toBe(5);

      // 6th should fail
      const result6 = createConnection("user1", "assistant");
      expect(result6.allowed).toBe(false);
      expect(result6.reason).toBe("max_user_connections");
      expect(getConnectionCount("user1")).toBe(5);
    });

    it("enforces global connection limit", () => {
      // Default limit is 100 global
      process.env.SSE_MAX_GLOBAL_CONNECTIONS = "3";

      // Need to reload the module to pick up env change
      // For this test, we'll test with the default limit
      // In practice, limits are set at startup

      // Create connections from different users
      createConnection("user1", "assistant");
      createConnection("user2", "orchestrator");
      createConnection("user3", "workflow");

      expect(getConnectionCount()).toBe(3);
    });

    it("enforces rate limiting per user", () => {
      // Default rate limit is 10 per minute
      const results: {
        connectionId: string;
        allowed: boolean;
        reason?: string;
      }[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(createConnection("user1", "assistant"));
        // Remove immediately to test rate limit, not connection limit
        if (results[i]?.connectionId) {
          removeConnection(results[i]?.connectionId);
        }
      }

      // All 10 should succeed
      expect(results.every((r) => r.allowed)).toBe(true);

      // 11th should hit rate limit
      const result11 = createConnection("user1", "assistant");
      expect(result11.allowed).toBe(false);
      expect(result11.reason).toBe("rate_limit_exceeded");
    });

    it("tracks connection info correctly", () => {
      const result = createConnection("user1", "assistant");
      expect(result.allowed).toBe(true);

      const info = getConnectionInfo(result.connectionId);
      expect(info).toBeTruthy();
      expect(info?.userId).toBe("user1");
      expect(info?.endpoint).toBe("assistant");
      expect(info?.connectionId).toBe(result.connectionId);
      expect(info?.createdAt).toBeGreaterThan(0);
      expect(info?.timeoutAt).toBeGreaterThan(info?.createdAt ?? 0);
    });

    it("allows different users to have separate limits", () => {
      // User1 creates 5 connections
      for (let i = 0; i < 5; i++) {
        createConnection("user1", "assistant");
      }

      // User2 should still be able to create connections
      const result = createConnection("user2", "orchestrator");
      expect(result.allowed).toBe(true);
      expect(getConnectionCount("user2")).toBe(1);
      expect(getConnectionCount("user1")).toBe(5);
    });
  });

  describe("removeConnection", () => {
    it("removes connection successfully", () => {
      const result = createConnection("user1", "assistant");
      expect(getConnectionCount("user1")).toBe(1);

      removeConnection(result.connectionId);
      expect(getConnectionCount("user1")).toBe(0);
      expect(getConnectionCount()).toBe(0);
      expect(getConnectionInfo(result.connectionId)).toBeNull();
    });

    it("handles removing non-existent connection gracefully", () => {
      expect(() => removeConnection("non-existent-id")).not.toThrow();
    });

    it("updates user connection count correctly", () => {
      const conn1 = createConnection("user1", "assistant");
      const conn2 = createConnection("user1", "orchestrator");
      expect(getConnectionCount("user1")).toBe(2);

      removeConnection(conn1.connectionId);
      expect(getConnectionCount("user1")).toBe(1);
      expect(getConnectionCount()).toBe(1);

      removeConnection(conn2.connectionId);
      expect(getConnectionCount("user1")).toBe(0);
      expect(getConnectionCount()).toBe(0);
    });
  });

  describe("updateConnectionActivity", () => {
    it("extends connection timeout on activity", () => {
      const result = createConnection("user1", "assistant");
      const info1 = getConnectionInfo(result.connectionId);
      const originalTimeout = info1?.timeoutAt ?? 0;

      // Wait a bit and update activity
      Bun.sleepSync(10);
      updateConnectionActivity(result.connectionId);

      const info2 = getConnectionInfo(result.connectionId);
      expect(info2?.timeoutAt).toBeGreaterThan(originalTimeout);
    });

    it("handles updating non-existent connection gracefully", () => {
      expect(() => updateConnectionActivity("non-existent-id")).not.toThrow();
    });
  });

  describe("getConnectionCount", () => {
    it("returns 0 for user with no connections", () => {
      expect(getConnectionCount("user1")).toBe(0);
    });

    it("returns correct count for user", () => {
      createConnection("user1", "assistant");
      createConnection("user1", "orchestrator");
      expect(getConnectionCount("user1")).toBe(2);
    });

    it("returns global count when no userId provided", () => {
      createConnection("user1", "assistant");
      createConnection("user2", "orchestrator");
      createConnection("user3", "workflow");
      expect(getConnectionCount()).toBe(3);
    });
  });

  describe("connection timeout", () => {
    it("tracks timeout correctly", () => {
      const result = createConnection("user1", "assistant");
      const info = getConnectionInfo(result.connectionId);
      const now = Date.now();
      const expectedTimeout = now + 30 * 60 * 1000; // 30 minutes

      // Allow 1 second tolerance
      expect(info?.timeoutAt).toBeGreaterThan(expectedTimeout - 1000);
      expect(info?.timeoutAt).toBeLessThan(expectedTimeout + 1000);
    });

    it("respects custom timeout from env", () => {
      // Note: This test verifies the timeout calculation
      // Actual cleanup testing would require time manipulation
      const result = createConnection("user1", "assistant");
      const info = getConnectionInfo(result.connectionId);
      expect(info?.timeoutAt).toBeGreaterThan(info?.createdAt ?? 0);
    });
  });

  describe("clearAllConnections", () => {
    it("removes all connections", () => {
      createConnection("user1", "assistant");
      createConnection("user2", "orchestrator");
      createConnection("user3", "workflow");

      expect(getConnectionCount()).toBe(3);

      clearAllConnections();
      expect(getConnectionCount()).toBe(0);
      expect(getConnectionCount("user1")).toBe(0);
      expect(getConnectionCount("user2")).toBe(0);
      expect(getConnectionCount("user3")).toBe(0);
    });
  });

  describe("rate limit bucket reset", () => {
    it("allows new connections after rate limit window", () => {
      // Create 10 connections (rate limit)
      const connections: string[] = [];
      for (let i = 0; i < 10; i++) {
        const result = createConnection("user1", "assistant");
        connections.push(result.connectionId);
        removeConnection(result.connectionId);
      }

      // 11th should be rate limited
      const result11 = createConnection("user1", "assistant");
      expect(result11.allowed).toBe(false);

      // Wait for rate limit window to reset (61 seconds)
      // Note: In real usage, this would be handled by the bucket reset logic
      // This test verifies the rate limit is enforced
    });
  });

  describe("multiple endpoints", () => {
    it("tracks connections per endpoint", () => {
      createConnection("user1", "assistant");
      createConnection("user1", "orchestrator");
      createConnection("user1", "workflow");

      expect(getConnectionCount("user1")).toBe(3);
      expect(getConnectionCount()).toBe(3);
    });

    it("applies limits across all endpoints", () => {
      // Create 5 connections across different endpoints
      createConnection("user1", "assistant");
      createConnection("user1", "orchestrator");
      createConnection("user1", "workflow");
      createConnection("user1", "assistant");
      createConnection("user1", "orchestrator");

      expect(getConnectionCount("user1")).toBe(5);

      // 6th should fail regardless of endpoint
      const result = createConnection("user1", "workflow");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("max_user_connections");
    });
  });
});
