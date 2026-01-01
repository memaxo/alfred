import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createAgentFSSubscription } from "../../src/tui/subscriptions/agentfs";

describe("AgentFSSubscription", () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;

  beforeEach(() => {
    // no-op
  });

  afterEach(() => {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  });

  test("connect sets connected state", async () => {
    // Set mock mode to avoid requiring actual API/auth
    const prevMock = process.env.ALFRED_TUI_USE_AGENTFS_MOCK;
    process.env.ALFRED_TUI_USE_AGENTFS_MOCK = "true";

    try {
      const sub = createAgentFSSubscription();
      let last: ReturnType<Parameters<typeof sub.subscribe>[0]> | null = null;
      const unsub = sub.subscribe((state) => {
        last = state;
      });

      const disconnect = sub.connect("run-1", "/tmp/agentfs.db");

      // Wait for async connect to complete
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(last?.isConnected).toBe(false); // Mock mode sets connected to false
          expect(last?.runId).toBe("run-1");
          expect(last?.dbPath).toBe("/tmp/agentfs.db");
          expect(last?.isLoading).toBe(false);
          expect((last?.entries?.length ?? 0) > 0).toBe(true);

          disconnect();
          unsub();
          resolve();
        }, 50);
      });
    } finally {
      if (prevMock === undefined) {
        process.env.ALFRED_TUI_USE_AGENTFS_MOCK = undefined;
      } else {
        process.env.ALFRED_TUI_USE_AGENTFS_MOCK = prevMock;
      }
    }
  });
});
