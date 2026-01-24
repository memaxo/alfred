import { describe, expect, it } from "bun:test";

import {
  defaults,
  LiteBatcher,
  LiteQueuer,
  LiteRateLimiter,
  liteDebounce,
  liteThrottle,
  pacerKey,
} from "../src/index";

function withNowCtl<T>(fn: (ctl: { setNow: (n: number) => void }) => T): T {
  const origNow = Date.now;
  let now = 0;
  Date.now = () => now;
  try {
    return fn({
      setNow: (n: number) => {
        now = n;
      },
    });
  } finally {
    Date.now = origNow;
  }
}

describe("@alfred/pacer (lite)", () => {
  it("pacerKey prefixes and joins parts", () => {
    expect(pacerKey(["ui", "desktop", "debounce"])).toBe(
      "alfred.ui.desktop.debounce"
    );
  });

  it("pacerKey rejects empty/whitespace parts", () => {
    expect(() => pacerKey([""])).toThrow();
    expect(() => pacerKey(["has space"])).toThrow();
  });

  it("exports defaults (named timings)", () => {
    expect(defaults.uiInputDebounceMs).toBeGreaterThan(0);
    expect(defaults.uiEventThrottleMs).toBeGreaterThan(0);
  });

  it("liteDebounce delays execution (trailing)", async () => {
    let n = 0;
    const fn = liteDebounce(
      () => {
        n += 1;
      },
      { wait: 25 }
    );

    fn();
    fn();
    fn();

    expect(n).toBe(0);
    await new Promise((r) => setTimeout(r, 60));
    expect(n).toBe(1);
  });

  it("liteThrottle executes leading and trailing", async () => {
    let n = 0;
    const fn = liteThrottle(
      () => {
        n += 1;
      },
      { wait: 25 }
    );

    fn(); // leading
    fn(); // throttled
    fn(); // throttled

    expect(n).toBe(1);
    await new Promise((r) => setTimeout(r, 60));
    expect(n).toBe(2);
  });

  it("LiteBatcher executes immediately when maxSize is reached", () => {
    const batches: number[][] = [];
    const b = new LiteBatcher<number>(
      (items) => {
        batches.push(items);
      },
      { maxSize: 2, wait: Number.POSITIVE_INFINITY }
    );

    b.addItem(1);
    expect(batches).toHaveLength(0);

    b.addItem(2);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([1, 2]);
    expect(b.isEmpty).toBe(true);
  });

  it("LiteBatcher.flush drains pending items", () => {
    const batches: string[][] = [];
    const b = new LiteBatcher<string>(
      (items) => {
        batches.push(items);
      },
      { wait: Number.POSITIVE_INFINITY }
    );

    b.addItem("a");
    b.addItem("b");
    expect(b.isEmpty).toBe(false);

    b.flush();
    expect(batches).toEqual([["a", "b"]]);
    expect(b.isEmpty).toBe(true);
  });

  it("LiteBatcher.cancel clears pending state (no timer leaks)", () => {
    const batches: number[][] = [];
    const b = new LiteBatcher<number>(
      (items) => {
        batches.push(items);
      },
      { wait: 10_000 }
    );

    b.addItem(1);
    expect(b.isPending).toBe(true);

    b.cancel();
    expect(b.isPending).toBe(false);
    expect(batches).toHaveLength(0);
    b.clear();
  });

  it("LiteQueuer preserves FIFO ordering by default", () => {
    const out: number[] = [];
    const q = new LiteQueuer<number>(
      (n) => {
        out.push(n);
      },
      { started: false, wait: 0 }
    );

    q.addItem(1);
    q.addItem(2);
    q.addItem(3);
    expect(out).toEqual([]);

    q.start();
    expect(out).toEqual([1, 2, 3]);
    expect(q.isEmpty).toBe(true);
  });

  it("LiteQueuer processes higher priority first when getPriority is set", () => {
    type Item = { id: string; pri: number };
    const out: string[] = [];
    const q = new LiteQueuer<Item>(
      (item) => {
        out.push(item.id);
      },
      {
        started: false,
        wait: 0,
        getPriority: (i) => i.pri,
      }
    );

    q.addItem({ id: "low", pri: 1 });
    q.addItem({ id: "high", pri: 10 });
    q.addItem({ id: "mid", pri: 5 });
    q.start();

    expect(out).toEqual(["high", "mid", "low"]);
  });

  it("LiteQueuer.flushAsBatch drains and returns all queued items", () => {
    const out: number[][] = [];
    const q = new LiteQueuer<number>(() => {}, { started: false, wait: 0 });

    q.addItem(1);
    q.addItem(2);
    q.addItem(3);

    q.flushAsBatch((items) => {
      out.push(items);
    });

    expect(out).toEqual([[1, 2, 3]]);
    expect(q.isEmpty).toBe(true);
  });

  it("LiteRateLimiter fixed window blocks after limit and allows after window expires", () => {
    let exec = 0;
    const limiter = new LiteRateLimiter(
      () => {
        exec += 1;
      },
      { limit: 2, window: 100, windowType: "fixed" }
    );

    withNowCtl(({ setNow }) => {
      setNow(1000);
      expect(limiter.maybeExecute()).toBe(true);
      setNow(1001);
      expect(limiter.maybeExecute()).toBe(true);
      setNow(1002);
      expect(limiter.maybeExecute()).toBe(false);
      expect(limiter.getRemainingInWindow()).toBe(0);
      expect(limiter.getMsUntilNextWindow()).toBeGreaterThan(0);
      setNow(1200);
      expect(limiter.maybeExecute()).toBe(true);
    });

    limiter.reset();
    expect(exec).toBe(3);
  });

  it("LiteRateLimiter sliding window allows as calls expire", () => {
    let exec = 0;
    const limiter = new LiteRateLimiter(
      () => {
        exec += 1;
      },
      { limit: 2, window: 100, windowType: "sliding" }
    );

    withNowCtl(({ setNow }) => {
      setNow(1000);
      expect(limiter.maybeExecute()).toBe(true);
      setNow(1050);
      expect(limiter.maybeExecute()).toBe(true);
      setNow(1060);
      expect(limiter.maybeExecute()).toBe(false);
      setNow(1110);
      expect(limiter.maybeExecute()).toBe(true);
    });

    limiter.reset();
    expect(exec).toBe(3);
  });
});
