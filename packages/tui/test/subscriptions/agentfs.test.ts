import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
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

  test("connect sets connected state and unrefs the polling timer", () => {
    const unrefMock = mock(() => {});
    const clearIntervalMock = mock(() => {});

    const handle = { unref: unrefMock } as unknown as ReturnType<
      typeof setInterval
    >;

    globalThis.setInterval = ((
      _fn: Parameters<typeof setInterval>[0],
      _ms?: number,
      ..._args: Parameters<typeof setInterval> extends [any, any, ...infer R]
        ? R
        : never
    ) => handle) as typeof setInterval;
    globalThis.clearInterval = ((id: unknown) => {
      clearIntervalMock(id);
    }) as unknown as typeof clearInterval;

    const sub = createAgentFSSubscription();
    let last: ReturnType<Parameters<typeof sub.subscribe>[0]> | null = null;
    const unsub = sub.subscribe((state) => {
      last = state;
    });

    const disconnect = sub.connect("run-1", "/tmp/agentfs.db");

    expect(unrefMock).toHaveBeenCalledTimes(1);
    expect(last?.isConnected).toBe(true);
    expect(last?.runId).toBe("run-1");
    expect(last?.dbPath).toBe("/tmp/agentfs.db");
    expect(last?.isLoading).toBe(false); // refresh runs immediately
    expect((last?.entries?.length ?? 0) > 0).toBe(true);

    disconnect();
    expect(clearIntervalMock).toHaveBeenCalledTimes(1);

    unsub();
  });
});
