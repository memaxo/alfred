import "@/test/dom";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "bun:test";

import { useOfflineQueue } from "@/hooks/use-offline-queue";

const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
};

describe("useOfflineQueue", () => {
  beforeEach(() => {
    localStorage.clear();
    setOnline(true);
  });

  it("queues messages when offline", () => {
    setOnline(false);
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      const queued = result.current.queueMessage("Hello", "conv-1");
      expect(queued).toBe(true);
    });

    expect(result.current.pendingMessages).toHaveLength(1);
    expect(result.current.pendingMessages[0]?.content).toBe("Hello");
    expect(result.current.pendingMessages[0]?.conversationId).toBe("conv-1");
    expect(result.current.pendingMessages[0]?.retryCount).toBe(0);
  });

  it("does not queue when online", () => {
    setOnline(true);
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      const queued = result.current.queueMessage("Hello");
      expect(queued).toBe(false);
    });

    expect(result.current.pendingMessages).toHaveLength(0);
  });

  it("retries queued messages and clears queue", () => {
    setOnline(false);
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      result.current.queueMessage("Hello");
    });

    act(() => {
      const retryable = result.current.retryAll();
      expect(retryable).toHaveLength(1);
      expect(retryable[0]?.retryCount).toBe(1);
    });

    expect(result.current.pendingMessages).toHaveLength(0);
  });
});
