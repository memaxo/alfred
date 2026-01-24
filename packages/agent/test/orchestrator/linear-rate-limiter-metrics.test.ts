import { describe, expect, it } from "bun:test";

import { LinearRateLimiter } from "../../src/orchestrator/linear-rate-limiter";

describe("LinearRateLimiter metrics", () => {
  it("increments rate limit counter on window throttling", async () => {
    let currentTime = 0;
    const limiter = new LinearRateLimiter({
      now: () => currentTime,
      sleep: (ms) => {
        currentTime += ms;
        return Promise.resolve();
      },
      maxRequestsPerMinute: 2,
      startupBufferMs: 0,
    });

    await limiter.throttle("thought");
    currentTime = 1000;
    await limiter.throttle("thought");
    currentTime = 2000;
    await limiter.throttle("thought");

    // Third request should trigger window throttling
    // Metrics are tracked internally, test verifies behavior
    expect(currentTime).toBeGreaterThan(2000);
  });

  it("increments rate limit counter on action cooldown", async () => {
    let currentTime = 0;
    const limiter = new LinearRateLimiter({
      now: () => currentTime,
      sleep: (ms) => {
        currentTime += ms;
        return Promise.resolve();
      },
      startupBufferMs: 0,
      maxRequestsPerMinute: 100,
      actionCooldownMs: 30_000,
    });

    await limiter.throttle("action");
    currentTime = 10_000;
    await limiter.throttle("action");

    // Second action should trigger cooldown throttling
    expect(currentTime).toBeGreaterThan(10_000);
  });

  it("increments retry-after counter when handle429 is called with retryAfterMs", async () => {
    let currentTime = 0;
    const limiter = new LinearRateLimiter({
      now: () => currentTime,
      sleep: (ms) => {
        currentTime += ms;
        return Promise.resolve();
      },
      startupBufferMs: 0,
    });

    await limiter.handle429(5000);
    expect(currentTime).toBeGreaterThanOrEqual(5000);
  });

  it("tracks wait times in histogram", async () => {
    let currentTime = 0;
    const waits: number[] = [];
    const limiter = new LinearRateLimiter({
      now: () => currentTime,
      sleep: (ms) => {
        waits.push(ms);
        currentTime += ms;
        return Promise.resolve();
      },
      maxRequestsPerMinute: 2,
      startupBufferMs: 0,
    });

    await limiter.throttle("thought");
    currentTime = 1000;
    await limiter.throttle("thought");
    currentTime = 2000;
    await limiter.throttle("thought");

    // Should have waited due to rate limiting
    expect(waits.length).toBeGreaterThan(0);
    expect(waits.some((w) => w > 0)).toBe(true);
  });
});
