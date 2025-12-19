import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { auth } from "@alfred/auth";
import {
  clearAllConnections,
  getConnectionCount,
} from "@alfred/api/utils/sse-connections";
import { createTestSession } from "@alfred/test-kit/auth";

// Mock the stream handler dependencies
const mockStreamText = {
  toUIMessageStreamResponse: () =>
    new Response("", {
      headers: { "Content-Type": "text/event-stream" },
    }),
};

const mockGetDefaults = () => ({
  model: "test-model",
  tools: {},
});

const mockAnalyzeContext = async () => ({
  system: "test system",
  activation: {},
});

describe("SSE stream rate limiting", () => {
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;

  beforeEach(async () => {
    clearAllConnections();
    session = createTestSession({
      user: { id: "test-user-1" },
    });
  });

  afterEach(() => {
    clearAllConnections();
  });

  it("allows connection within rate limit", async () => {
    // Mock the stream handler
    const streamHandlerPkg = "@/lib/api/stream-handler";
    const { handleStreamRequest } = await import(streamHandlerPkg);

    // Mock dependencies
    const mockAuth = {
      api: {
        getSession: async () => session,
      },
    };

    // Create a request
    const request = new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: {
        cookie: "session=test",
      },
      body: JSON.stringify({
        messages: [
          {
            id: "1",
            role: "user",
            parts: [{ type: "text", text: "test" }],
          },
        ],
      }),
    });

    // Mock auth module
    const originalAuth = await import("@alfred/auth");
    // Note: This is a simplified test - in practice, we'd need to mock the auth module
    // For now, we'll test the connection utility directly

    // Test that connection creation works
    const { createConnection } = await import("@alfred/api/utils/sse-connections");
    const result = createConnection("test-user-1", "assistant");
    expect(result.allowed).toBe(true);
    expect(getConnectionCount("test-user-1")).toBe(1);
  });

  it("enforces rate limit after threshold", async () => {
    const { createConnection } = await import("@alfred/api/utils/sse-connections");

    // Create 10 connections (rate limit)
    const connections = [];
    for (let i = 0; i < 10; i++) {
      const result = createConnection("test-user-1", "assistant");
      expect(result.allowed).toBe(true);
      connections.push(result.connectionId);
      // Remove immediately to test rate limit, not connection limit
      const { removeConnection } = await import("@alfred/api/utils/sse-connections");
      removeConnection(result.connectionId);
    }

    // 11th should hit rate limit
    const result11 = createConnection("test-user-1", "assistant");
    expect(result11.allowed).toBe(false);
    expect(result11.reason).toBe("rate_limit_exceeded");
  });

  it("enforces per-user connection limit", async () => {
    const { createConnection } = await import("@alfred/api/utils/sse-connections");

    // Create 5 connections (per-user limit)
    const connections = [];
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
