import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { VoiceStreamClient } from "./stream";

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  readyState = 1; // OPEN

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    // Delay open slightly
    setTimeout(() => {
      if (this.onopen) {
        this.onopen();
      }
    }, 1);
  }

  send(_data: string) {
    // echo back or simulate server logic
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.({ code: 1000, reason: "closed" });
  }

  // Helper to simulate incoming message
  simulateMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

// Override global WebSocket
global.WebSocket = MockWebSocket as any;

describe("VoiceStreamClient", () => {
  let client: VoiceStreamClient;

  beforeEach(() => {
    MockWebSocket.instances = [];
    client = new VoiceStreamClient({ url: "ws://test" });
  });

  afterEach(async () => {
    await client.close();
  });

  it("should connect and start session", async () => {
    const sessionPromise = client.startSession();

    // Simulate server response
    const ws = MockWebSocket.instances[0];
    expect(ws).toBeDefined();

    // Wait for connection
    await new Promise((r) => setTimeout(r, 10));

    ws?.simulateMessage({ _: "ready", sessionId: null });
    ws?.simulateMessage({
      _: "session_started",
      sessionId: "s1",
      codec: "pcm",
      negotiatedCodec: "pcm",
    });

    const sessionId = await sessionPromise;
    expect(sessionId).toBe("s1");
  });

  it("should handle errors", async () => {
    const sessionPromise = client.startSession();
    const ws = MockWebSocket.instances[0];
    await new Promise((r) => setTimeout(r, 10));

    ws?.simulateMessage({ _: "error", sessionId: null, message: "failed" });
    // Wait for reject
    expect(sessionPromise).rejects.toThrow("failed");
  });
});
