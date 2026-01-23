import { describe, expect, test } from "bun:test";
import type { NotifyEvent } from "../src/services/notify";
import { toObservable } from "./utils/stream";
import { createTestCaller } from "./utils/trpc";

function unsubscribeSafe(handle: unknown): void {
  if (!handle || (typeof handle !== "object" && typeof handle !== "function")) {
    return;
  }
  const maybe = handle as { unsubscribe?: () => void };
  maybe.unsubscribe?.();
}

describe("notify router", () => {
  test("status reports subscriber counts", async () => {
    const caller = await createTestCaller();

    const before = await caller.notify.status();
    expect(before.inAppSubscribers).toBe(0);

    const sub = toObservable<NotifyEvent>(await caller.notify.subscribe());
    const handle = sub.subscribe({ next: () => {} });
    await Promise.resolve();

    const after = await caller.notify.status();
    expect(after.inAppSubscribers).toBe(1);

    // cleanup
    unsubscribeSafe(handle);
  });

  test("ping emits to notify.subscribe stream", async () => {
    const caller = await createTestCaller();

    const sub = toObservable<NotifyEvent>(await caller.notify.subscribe());

    let handle: unknown = null;
    const pingP = new Promise<Extract<NotifyEvent, { type: "ping" }>>(
      (resolve, reject) => {
        handle = sub.subscribe({
          next: (event) => {
            if (event.type !== "ping") {
              return;
            }
            unsubscribeSafe(handle);
            resolve(event);
          },
          error: (err) => {
            unsubscribeSafe(handle);
            reject(err);
          },
        });
      }
    );

    await caller.notify.ping({ message: "hello" });
    const ping = await pingP;

    // If we got here, we got the ping; validate it.
    expect(ping.data.message).toBe("hello");
    expect(typeof ping.data.timestamp).toBe("number");
  });
});

