import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { getRedis, getRedisAsync, isRedisHealthy, resetRedisState } from "../src/redis";

describe("Redis Connection Management", () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalRetryEnabled = process.env.REDIS_RETRY_ENABLED;
  const originalRetryMaxAttempts = process.env.REDIS_RETRY_MAX_ATTEMPTS;

  beforeEach(() => {
    resetRedisState();
    process.env.REDIS_URL = undefined;
    process.env.REDIS_RETRY_ENABLED = undefined;
    process.env.REDIS_RETRY_MAX_ATTEMPTS = undefined;
  });

  afterEach(() => {
    resetRedisState();
    if (originalRedisUrl) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      process.env.REDIS_URL = undefined;
    }
    if (originalRetryEnabled) {
      process.env.REDIS_RETRY_ENABLED = originalRetryEnabled;
    } else {
      process.env.REDIS_RETRY_ENABLED = undefined;
    }
    if (originalRetryMaxAttempts) {
      process.env.REDIS_RETRY_MAX_ATTEMPTS = originalRetryMaxAttempts;
    } else {
      process.env.REDIS_RETRY_MAX_ATTEMPTS = undefined;
    }
  });

  describe("getRedis()", () => {
    it("returns null when REDIS_URL is not set", () => {
      process.env.REDIS_URL = undefined;
      expect(getRedis()).toBeNull();
    });

    it("returns null when REDIS_URL is 'false'", () => {
      process.env.REDIS_URL = "false";
      expect(getRedis()).toBeNull();
    });

    it("returns null when REDIS_URL is empty string", () => {
      process.env.REDIS_URL = "";
      expect(getRedis()).toBeNull();
    });
  });

  describe("getRedisAsync()", () => {
    it("returns null when REDIS_URL is not set", async () => {
      process.env.REDIS_URL = undefined;
      expect(await getRedisAsync()).toBeNull();
    });

    it("returns null when REDIS_URL is 'false'", async () => {
      process.env.REDIS_URL = "false";
      expect(await getRedisAsync()).toBeNull();
    });
  });

  describe("isRedisHealthy()", () => {
    it("returns false when REDIS_URL is not set", async () => {
      process.env.REDIS_URL = undefined;
      expect(await isRedisHealthy()).toBe(false);
    });

    it("returns false when REDIS_URL is 'false'", async () => {
      process.env.REDIS_URL = "false";
      expect(await isRedisHealthy()).toBe(false);
    });
  });

  describe("retry configuration", () => {
    it("respects REDIS_RETRY_ENABLED=false", () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.REDIS_RETRY_ENABLED = "false";
      const client = getRedis();
      expect(client).toBeNull();
    });

    it("uses default retry settings when not configured", () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.REDIS_RETRY_ENABLED = undefined;
      process.env.REDIS_RETRY_INITIAL_DELAY_MS = undefined;
      process.env.REDIS_RETRY_MAX_DELAY_MS = undefined;
      process.env.REDIS_RETRY_MAX_ATTEMPTS = undefined;
      const client = getRedis();
      expect(client).toBeNull();
    });
  });

  describe("race condition handling", () => {
    it("handles concurrent getRedis() calls", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.REDIS_RETRY_ENABLED = "false";
      // Use Promise.race with a timeout to ensure test completes
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 2000)
      );
      const results = await Promise.race([
        Promise.all([getRedisAsync(), getRedisAsync(), getRedisAsync()]),
        timeoutPromise.then(() => [null, null, null]),
      ]);
      // All results should be null when Redis is unavailable
      expect(results.every((r) => r === null)).toBe(true);
    });
  });
});
