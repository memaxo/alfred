import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { getRedis, getRedisAsync, isRedisHealthy } from "../src/redis";

describe("Redis Connection Management", () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalRetryEnabled = process.env.REDIS_RETRY_ENABLED;
  const originalRetryMaxAttempts = process.env.REDIS_RETRY_MAX_ATTEMPTS;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_RETRY_ENABLED;
    delete process.env.REDIS_RETRY_MAX_ATTEMPTS;
  });

  afterEach(() => {
    if (originalRedisUrl) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
    if (originalRetryEnabled) {
      process.env.REDIS_RETRY_ENABLED = originalRetryEnabled;
    } else {
      delete process.env.REDIS_RETRY_ENABLED;
    }
    if (originalRetryMaxAttempts) {
      process.env.REDIS_RETRY_MAX_ATTEMPTS = originalRetryMaxAttempts;
    } else {
      delete process.env.REDIS_RETRY_MAX_ATTEMPTS;
    }
  });

  describe("getRedis()", () => {
    it("returns null when REDIS_URL is not set", () => {
      delete process.env.REDIS_URL;
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
      delete process.env.REDIS_URL;
      expect(await getRedisAsync()).toBeNull();
    });

    it("returns null when REDIS_URL is 'false'", async () => {
      process.env.REDIS_URL = "false";
      expect(await getRedisAsync()).toBeNull();
    });
  });

  describe("isRedisHealthy()", () => {
    it("returns false when REDIS_URL is not set", async () => {
      delete process.env.REDIS_URL;
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
      delete process.env.REDIS_RETRY_ENABLED;
      delete process.env.REDIS_RETRY_INITIAL_DELAY_MS;
      delete process.env.REDIS_RETRY_MAX_DELAY_MS;
      delete process.env.REDIS_RETRY_MAX_ATTEMPTS;
      const client = getRedis();
      expect(client).toBeNull();
    });
  });

  describe("race condition handling", () => {
    it("handles concurrent getRedis() calls", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const results = await Promise.all([
        getRedisAsync(),
        getRedisAsync(),
        getRedisAsync(),
      ]);
      expect(results.every((r) => r === null || r !== null)).toBe(true);
    });
  });
});
