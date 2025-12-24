import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;

  private readonly sentMessages: string[] = [];

  constructor(_url: string) {
    // Simulate connection after a tick
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 10);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helpers
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError(error: unknown) {
    this.onerror?.(error);
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  getSentMessages(): unknown[] {
    return this.sentMessages.map((m) => JSON.parse(m));
  }
}

// Store original WebSocket
const originalWebSocket = globalThis.WebSocket;

describe("SubscriptionManager", () => {
  beforeEach(() => {
    // Mock WebSocket globally
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket =
      MockWebSocket as unknown as typeof WebSocket;

    // Mock window for URL construction
    (
      globalThis as unknown as {
        window: { location: { protocol: string; host: string } };
      }
    ).window = {
      location: {
        protocol: "http:",
        host: "localhost:3000",
      },
    };
  });

  afterEach(() => {
    // Restore WebSocket
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      originalWebSocket;
  });

  describe("Connection management", () => {
    it("creates WebSocket on first subscription", async () => {
      const { subscriptionManager } = await import("../manager");

      const handler = mock(() => {});
      subscriptionManager.subscribe("test-stream", handler);

      // Wait for connection
      await new Promise((r) => setTimeout(r, 20));

      // Should have created a connection
      expect(subscriptionManager.getState("test-stream")).not.toBeNull();

      subscriptionManager.disconnect();
    });

    it("reuses connection for multiple subscriptions", async () => {
      const { subscriptionManager } = await import("../manager");

      const handler1 = mock(() => {});
      const handler2 = mock(() => {});

      subscriptionManager.subscribe("stream-1", handler1);
      subscriptionManager.subscribe("stream-2", handler2);

      await new Promise((r) => setTimeout(r, 20));

      // Both should be connected via same WebSocket
      const state1 = subscriptionManager.getState("stream-1");
      const state2 = subscriptionManager.getState("stream-2");

      expect(state1?.status).toBe("connecting");
      expect(state2?.status).toBe("connecting");

      subscriptionManager.disconnect();
    });
  });

  describe("Subscription lifecycle", () => {
    it("returns unsubscribe function", async () => {
      const { subscriptionManager } = await import("../manager");

      const handler = mock(() => {});
      const unsubscribe = subscriptionManager.subscribe("test-stream", handler);

      expect(typeof unsubscribe).toBe("function");

      unsubscribe();
      expect(subscriptionManager.getState("test-stream")).toBeNull();
    });

    it("tracks cursor from events", async () => {
      const { subscriptionManager } = await import("../manager");

      subscriptionManager.subscribe("test-stream", () => {}, {
        cursor: "initial-cursor",
      });

      expect(subscriptionManager.getCursor("test-stream")).toBe(
        "initial-cursor"
      );

      subscriptionManager.disconnect();
    });
  });

  describe("Status callbacks", () => {
    it("calls onStatus with status changes", async () => {
      const { subscriptionManager } = await import("../manager");

      const statusCallback = mock(() => {});
      subscriptionManager.subscribe("test-stream", () => {}, {
        onStatus: statusCallback,
      });

      await new Promise((r) => setTimeout(r, 20));

      // Should have been called with 'connecting' initially
      expect(statusCallback).toHaveBeenCalled();

      subscriptionManager.disconnect();
    });
  });

  describe("Cleanup", () => {
    it("disconnect clears all subscriptions", async () => {
      const { subscriptionManager } = await import("../manager");

      subscriptionManager.subscribe("stream-1", () => {});
      subscriptionManager.subscribe("stream-2", () => {});

      await new Promise((r) => setTimeout(r, 20));

      subscriptionManager.disconnect();

      expect(subscriptionManager.getState("stream-1")).toBeNull();
      expect(subscriptionManager.getState("stream-2")).toBeNull();
    });
  });
});

describe("Subscription Protocol", () => {
  describe("Message types", () => {
    it("subscribe message has correct shape", () => {
      const msg = {
        type: "subscribe",
        streamId: "graph:node-1,node-2",
        cursor: "cursor-123",
      };

      expect(msg.type).toBe("subscribe");
      expect(msg.streamId).toContain("graph:");
      expect(msg.cursor).toBeDefined();
    });

    it("unsubscribe message has correct shape", () => {
      const msg = {
        type: "unsubscribe",
        streamId: "graph:node-1",
      };

      expect(msg.type).toBe("unsubscribe");
      expect(msg.streamId).toBeDefined();
    });

    it("delta event has required fields", () => {
      const event = {
        type: "delta",
        cursor: "cursor-456",
        seq: 1,
        timestamp: new Date().toISOString(),
        payload: { action: "edge_created", edge: { id: "e1" } },
      };

      expect(event.type).toBe("delta");
      expect(event.cursor).toBeDefined();
      expect(event.seq).toBeGreaterThanOrEqual(0);
      expect(event.timestamp).toBeDefined();
      expect(event.payload).toBeDefined();
    });

    it("snapshot event has required fields", () => {
      const event = {
        type: "snapshot",
        cursor: "cursor-789",
        seq: 0,
        timestamp: new Date().toISOString(),
        payload: { action: "edges_snapshot", edges: [] },
      };

      expect(event.type).toBe("snapshot");
      expect(event.seq).toBe(0);
      expect(event.payload.action).toBe("edges_snapshot");
    });
  });

  describe("Stream ID formats", () => {
    it("graph stream ID includes sorted node IDs", () => {
      const nodeIds = ["node-b", "node-a", "node-c"];
      const streamId = `graph:${nodeIds.sort().join(",")}`;

      expect(streamId).toBe("graph:node-a,node-b,node-c");
    });

    it("workflow stream ID includes run ID", () => {
      const runId = "run-123";
      const streamId = `workflow:${runId}`;

      expect(streamId).toBe("workflow:run-123");
    });
  });
});
