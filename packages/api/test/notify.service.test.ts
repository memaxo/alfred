import { afterEach, describe, expect, test } from "bun:test";

import {
  notifyStatus,
  publishPing,
  subscribeToNotify,
} from "../src/services/notify";

describe("notify service", () => {
  const userId = `test-user-${crypto.randomUUID()}`;

  afterEach(() => {
    // Ensure we don't leak subscribers across tests.
    // The service deletes the user entry when the last subscriber unsubscribes.
    // We can't directly clear internal state; rely on careful unsubscribe.
    const status = notifyStatus(userId);
    expect(status.inAppSubscribers).toBe(0);
  });

  test("subscribe/unsubscribe updates notifyStatus counts", () => {
    expect(notifyStatus(userId).inAppSubscribers).toBe(0);

    const unsub1 = subscribeToNotify(userId, () => {});
    expect(notifyStatus(userId).inAppSubscribers).toBe(1);

    const unsub2 = subscribeToNotify(userId, () => {});
    expect(notifyStatus(userId).inAppSubscribers).toBe(2);

    unsub1();
    expect(notifyStatus(userId).inAppSubscribers).toBe(1);

    unsub2();
    expect(notifyStatus(userId).inAppSubscribers).toBe(0);
  });

  test("publishPing delivers ping event to subscribers", () => {
    let seen: { message: string; timestamp: number } | null = null;

    const unsub = subscribeToNotify(userId, (event) => {
      if (event.type !== "ping") {
        return;
      }
      seen = event.data;
    });

    try {
      publishPing(userId, "hello");
      expect(seen?.message).toBe("hello");
      expect(typeof seen?.timestamp).toBe("number");
    } finally {
      unsub();
    }
  });
});
