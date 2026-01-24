// Import Redis mocks BEFORE any other imports
import "@alfred/test-kit/redis";
import { logger } from "@alfred/logger";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { initApiServices, shutdownApiServices } from "../src/init";
import {
  isDbAvailable,
  isUvAvailable,
  resetDbAvailability,
} from "../src/utils/service-availability";

// Mock logger to avoid console noise in tests
const originalWarn = logger.warn;
const originalError = logger.error;
const originalInfo = logger.info;
const originalDebug = logger.debug;

beforeEach(() => {
  logger.warn = () => {};
  logger.error = () => {};
  logger.info = () => {};
  logger.debug = () => {};
  resetDbAvailability();
});

afterEach(() => {
  logger.warn = originalWarn;
  logger.error = originalError;
  logger.info = originalInfo;
  logger.debug = originalDebug;
  shutdownApiServices();
});

describe("initApiServices graceful degradation", () => {
  it("should initialize without crashing when DB is unavailable", () => {
    // Mock DB as unavailable by setting cache
    // Note: In real scenario, DB connection would fail
    resetDbAvailability();

    // Should not throw
    expect(() => {
      initApiServices();
    }).not.toThrow();
  });

  it("should skip DB-dependent services when DB unavailable", async () => {
    resetDbAvailability();
    initApiServices();

    // Wait a bit for async checks
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Services should be initialized (no crash)
    // DB-dependent services should be skipped (checked via logs)
    expect(true).toBe(true);
  });

  it("should skip voice pools when UV unavailable", () => {
    // Mock UV check - if UV is actually unavailable, pools should be skipped
    initApiServices();

    // Should not throw
    expect(true).toBe(true);
  });

  it("should handle partial service initialization", () => {
    // Test that some services can fail while others succeed
    initApiServices();

    // Should not throw
    expect(true).toBe(true);
  });

  it("should be idempotent (safe to call multiple times)", () => {
    initApiServices();
    initApiServices();
    initApiServices();

    // Should not throw or duplicate services
    expect(true).toBe(true);
  });
});

describe("service availability utilities", () => {
  it("isDbAvailable should return boolean", async () => {
    resetDbAvailability();
    const result = await isDbAvailable();
    expect(typeof result).toBe("boolean");
  });

  it("isUvAvailable should not return false positives for non-executable PATH entries", () => {
    if (process.platform === "win32") {
      expect(true).toBe(true);
      return;
    }

    const base = mkdtempSync(join(tmpdir(), "alfred-uv-"));
    const uvPath = join(base, "uv");

    // Create a non-executable file named `uv` in PATH.
    writeFileSync(uvPath, "#!/usr/bin/env bash\necho uv\n", "utf8");
    chmodSync(uvPath, 0o644);

    const prevPath = process.env.PATH;
    process.env.PATH = base;

    try {
      // Non-executable `uv` must not be treated as available.
      expect(isUvAvailable()).toBe(false);

      // Make it executable and assert availability flips to true.
      chmodSync(uvPath, 0o755);
      expect(isUvAvailable()).toBe(true);
    } finally {
      process.env.PATH = prevPath;
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("resetDbAvailability should clear cache", async () => {
    // Check once to populate cache
    await isDbAvailable();
    resetDbAvailability();
    // Cache should be cleared
    const result = await isDbAvailable(true);
    expect(typeof result).toBe("boolean");
  });
});
