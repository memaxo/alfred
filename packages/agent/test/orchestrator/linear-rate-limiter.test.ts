import { describe, expect, it } from "bun:test";
import { LinearRateLimiter } from "../../src/orchestrator/linear-rate-limiter";

describe("LinearRateLimiter", () => {
  it("enforces global minute rate", async () => {
    let currentTime = 0;
    const waits: number[] = [];
    const limiter = new LinearRateLimiter({
      now: () => currentTime,
      sleep: async (ms) => {
        waits.push(ms);
        currentTime += ms;
      },
      maxRequestsPerMinute: 2,
      startupBufferMs: 0,
    });

    await limiter.throttle("thought");
    currentTime = 1000;
    await limiter.throttle("thought");
    currentTime = 2000;
    await limiter.throttle("thought");

    expect(waits.at(-1)).toBeGreaterThanOrEqual(58_000);
  });

  it("throttles action events to 30 seconds", async () => {
    let currentTime = 0;
    const waits: number[] = [];
    const limiter = new LinearRateLimiter({
      now: () => currentTime,
      sleep: async (ms) => {
        waits.push(ms);
        currentTime += ms;
      },
      startupBufferMs: 0,
      maxRequestsPerMinute: 100,
      actionCooldownMs: 30_000,
    });

    await limiter.throttle("action");
    currentTime = 10_000;
    await limiter.throttle("action");

    expect(waits.at(-1)).toBe(20_000);

    currentTime = 50_000;
    await limiter.throttle("action");
    expect(waits).toHaveLength(2);
  });

  it("backs off when handle429 is invoked", async () => {
    let currentTime = 0;
    const waits: number[] = [];
    const limiter = new LinearRateLimiter({
      now: () => currentTime,
      sleep: async (ms) => {
        waits.push(ms);
        currentTime += ms;
      },
      startupBufferMs: 0,
      maxRequestsPerMinute: 1,
    });

    await limiter.handle429(5000);
    expect(waits.at(-1)).toBe(5000);

    currentTime = 6000;
    await expect(limiter.throttle("thought")).resolves.toBeUndefined();
  });

  it("skips startup buffer when disabled for session operations", async () => {
    const currentTime = 0;
    let waitCalled = false;
    const limiter = new LinearRateLimiter({
      now: () => currentTime,
      sleep: async () => {
        waitCalled = true;
      },
      startupBufferMs: 9000,
    });

    await limiter.throttle("session", { requireStartupBuffer: false });
    expect(waitCalled).toBe(false);
  });
});
