import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  clearAllConnections,
  getConnectionCount,
} from "@alfred/api/utils/sse-connections";

describe("SSE stream rate limiting", () => {
  beforeEach(() => {
    clearAllConnections();
  });

  afterEach(() => {
    clearAllConnections();
  });

  it("allows connection within rate limit", async () => {
    // Test that connection creation works
    const { createConnection } = await import(
      "@alfred/api/utils/sse-connections"
    );
    const result = createConnection("test-user-1", "assistant");
    expect(result.allowed).toBe(true);
    expect(getConnectionCount("test-user-1")).toBe(1);
  });

  it("enforces rate limit after threshold", async () => {
    const { createConnection } = await import(
      "@alfred/api/utils/sse-connections"
    );

    // Create 10 connections (rate limit)
    const connections: string[] = [];
    for (let i = 0; i < 10; i++) {
      const result = createConnection("test-user-1", "assistant");
      expect(result.allowed).toBe(true);
      connections.push(result.connectionId);
      // Remove immediately to test rate limit, not connection limit
      const { removeConnection } = await import(
        "@alfred/api/utils/sse-connections"
      );
      removeConnection(result.connectionId);
    }

    // 11th should hit rate limit
    const result11 = createConnection("test-user-1", "assistant");
    expect(result11.allowed).toBe(false);
    expect(result11.reason).toBe("rate_limit_exceeded");
  });

  it("enforces per-user connection limit", async () => {
    const { createConnection } = await import(
      "@alfred/api/utils/sse-connections"
    );

    // Create 5 connections (per-user limit)
    const connections: string[] = [];
    for (let i = 0; i < 5; i++) {
      const result = createConnection("test-user-1", "assistant");
      expect(result.allowed).toBe(true);
      connections.push(result.connectionId);
    }

    expect(getConnectionCount("test-user-1")).toBe(5);

    // 6th should hit connection limit
    const result6 = createConnection("test-user-1", "assistant");
    expect(result6.allowed).toBe(false);
    expect(result6.reason).toBe("max_user_connections");
  });
});
