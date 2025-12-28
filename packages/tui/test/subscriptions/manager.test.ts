import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { PollingConfig } from "../../src/tui/subscriptions/manager";
import { SubscriptionManager } from "../../src/tui/subscriptions/manager";

describe("SubscriptionManager", () => {
  let manager: SubscriptionManager;

  beforeEach(() => {
    manager = new SubscriptionManager();
    // Add error listener to prevent unhandled errors
    manager.on("error", () => {
      // Silently catch errors in tests unless explicitly testing error handling
    });
  });

  afterEach(async () => {
    await manager.closeAll();
  });

  describe("Polling Lifecycle", () => {
    test("adds polling subscription without immediate", () => {
      const onData = mock(() => {});
      const config: PollingConfig<string> = {
        id: "test-1",
        fetch: async () => "test data",
        onData,
        interval: 1000,
        immediate: false,
      };

      manager.addPolling(config);

      const state = manager.getState("test-1");
      expect(state).toBeDefined();
      expect(state?.type).toBe("polling");
    });

    test("removes polling subscription successfully", () => {
      const config: PollingConfig<string> = {
        id: "test-1",
        fetch: async () => "test",
        onData: () => {},
        interval: 1000,
        immediate: false,
      };

      manager.addPolling(config);

      manager.removePolling("test-1");
      const state = manager.getState("test-1");
      expect(state).toBeUndefined();
    });

    test("closeAll removes all subscriptions", async () => {
      manager.addPolling({
        id: "test-1",
        fetch: async () => "test",
        onData: () => {},
        interval: 1000,
        immediate: false,
      });

      manager.addPolling({
        id: "test-2",
        fetch: async () => "test",
        onData: () => {},
        interval: 1000,
        immediate: false,
      });

      expect(manager.getAllStates().length).toBe(2);

      await manager.closeAll();
      expect(manager.getAllStates().length).toBe(0);
    });

    test("handles removing non-existent subscription", () => {
      expect(() => manager.removePolling("does-not-exist")).not.toThrow();
    });
  });

  describe("Polling Behavior", () => {
    test("polls on interval", async () => {
      const fetchMock = mock(async () => "test data");
      const onData = mock(() => {});

      const config: PollingConfig<string> = {
        id: "test-poll",
        fetch: fetchMock,
        onData,
        interval: 100,
        immediate: false,
      };

      manager.addPolling(config);

      // Wait for first poll
      await Bun.sleep(150);

      expect(fetchMock).toHaveBeenCalled();
      expect(onData).toHaveBeenCalledWith("test data");

      manager.removePolling("test-poll");
    });

    test("pauses and resumes polling", async () => {
      const onData = mock(() => {});
      const config: PollingConfig<string> = {
        id: "test-pause",
        fetch: async () => "test",
        onData,
        interval: 100,
        immediate: false,
      };

      manager.addPolling(config);

      // Pause immediately
      manager.pausePolling();

      // Wait longer than interval
      await Bun.sleep(200);

      // Should not have been called while paused
      expect(onData).not.toHaveBeenCalled();

      // Resume and wait
      manager.resumePolling();
      await Bun.sleep(150);

      // Should be called after resume
      expect(onData).toHaveBeenCalled();

      manager.removePolling("test-pause");
    });
  });

  describe("Error Handling", () => {
    test("handles fetch errors without crashing", async () => {
      const onError = mock(() => {});
      const config: PollingConfig<string> = {
        id: "test-error",
        fetch: () => {
          throw new Error("test error");
        },
        onData: () => {},
        onError,
        interval: 100,
        immediate: false,
      };

      manager.addPolling(config);

      // Wait for poll to execute and fail
      await Bun.sleep(150);

      expect(onError).toHaveBeenCalled();
      const errorArg = onError.mock.calls[0]?.[0];
      expect(errorArg).toBeInstanceOf(Error);
      expect((errorArg as Error).message).toBe("test error");

      manager.removePolling("test-error");
    });

    test("continues polling after error", async () => {
      let callCount = 0;
      const fetchMock = mock(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("first call fails");
        }
        return Promise.resolve("success");
      });

      const onData = mock(() => {});
      const onError = mock(() => {});

      const config: PollingConfig<string> = {
        id: "test-recover",
        fetch: fetchMock,
        onData,
        onError,
        interval: 100,
        immediate: false,
      };

      manager.addPolling(config);

      // Wait for two poll cycles
      await Bun.sleep(250);

      expect(onError).toHaveBeenCalled(); // First call failed
      expect(onData).toHaveBeenCalledWith("success"); // Second call succeeded

      manager.removePolling("test-recover");
    });
  });

  describe("State Management", () => {
    test("getState returns subscription state", () => {
      const config: PollingConfig<string> = {
        id: "test-state",
        fetch: async () => "test",
        onData: () => {},
        interval: 1000,
        immediate: false,
      };

      manager.addPolling(config);

      const state = manager.getState("test-state");
      expect(state).toBeDefined();
      expect(state?.id).toBe("test-state");
      expect(state?.type).toBe("polling");

      manager.removePolling("test-state");
    });

    test("getAllStates returns all subscription states", () => {
      manager.addPolling({
        id: "test-1",
        fetch: async () => "test",
        onData: () => {},
        interval: 1000,
        immediate: false,
      });

      manager.addPolling({
        id: "test-2",
        fetch: async () => "test",
        onData: () => {},
        interval: 1000,
        immediate: false,
      });

      const states = manager.getAllStates();
      expect(states.length).toBe(2);
      expect(states.map((s) => s.id)).toContain("test-1");
      expect(states.map((s) => s.id)).toContain("test-2");
    });
  });

  describe("Memory Management", () => {
    test("closeAll stops all polling", async () => {
      const onData1 = mock(() => {});
      const onData2 = mock(() => {});

      manager.addPolling({
        id: "poll-1",
        fetch: async () => "test1",
        onData: onData1,
        interval: 100,
        immediate: false,
      });

      manager.addPolling({
        id: "poll-2",
        fetch: async () => "test2",
        onData: onData2,
        interval: 100,
        immediate: false,
      });

      // Let them poll
      await Bun.sleep(150);

      const callCount1 = onData1.mock.calls.length;
      const callCount2 = onData2.mock.calls.length;

      // Close all
      await manager.closeAll();

      // Wait and verify no more calls
      await Bun.sleep(150);

      expect(onData1.mock.calls.length).toBe(callCount1);
      expect(onData2.mock.calls.length).toBe(callCount2);
    });

    test("multiple closeAll calls are safe", async () => {
      manager.addPolling({
        id: "test",
        fetch: async () => "test",
        onData: () => {},
        interval: 1000,
        immediate: false,
      });

      await manager.closeAll();
      await manager.closeAll();
      await manager.closeAll();

      expect(manager.getAllStates().length).toBe(0);
    });
  });
});
