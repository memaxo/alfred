/**
 * Redis test infrastructure
 *
 * Provides reusable mocking for Redis and run registry in tests.
 * Import this module BEFORE any other imports that might use Redis.
 *
 * Usage:
 *   import "@alfred/test-kit/redis"; // At top of test file
 *
 * Or for more control:
 *   import { installRedisMocks, resetRedisMocks } from "@alfred/test-kit/redis";
 *   installRedisMocks();
 */

import { mock, vi } from "bun:test";

// Configure environment to disable Redis connections
process.env.REDIS_URL = "false";
process.env.REDIS_RETRY_ENABLED = "false";
process.env.RUN_REGISTRY_BACKEND = "memory";

/**
 * Mock implementations for Redis client
 */
export const redisMocks = {
  getRedis: vi.fn().mockReturnValue(null),
  getRedisAsync: vi.fn().mockResolvedValue(null),
  isRedisHealthy: vi.fn().mockResolvedValue(false),
  resetRedisState: vi.fn(),
};

/**
 * Mock implementations for run registry
 */
export const runRegistryMocks = {
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
  dispatchResume: vi.fn().mockResolvedValue(true),
};

/**
 * Install Redis and run registry mocks.
 * Call this BEFORE importing any modules that use Redis.
 */
export function installRedisMocks() {
  // Mock the Redis module
  mock.module("@alfred/auth/redis", () => ({
    getRedis: redisMocks.getRedis,
    getRedisAsync: redisMocks.getRedisAsync,
    isRedisHealthy: redisMocks.isRedisHealthy,
    resetRedisState: redisMocks.resetRedisState,
  }));

  // Mock the run registry module
  mock.module("@alfred/agent/workflow/registry", () => ({
    runRegistry: runRegistryMocks,
    MemoryRunRegistry: class MemoryRunRegistry {
      runs = new Map();
      register = runRegistryMocks.register;
      unregister = runRegistryMocks.unregister;
      dispatchResume = runRegistryMocks.dispatchResume;
    },
    RedisRunRegistry: class RedisRunRegistry {
      constructor() {
        throw new Error("RedisRunRegistry should not be instantiated in tests");
      }
    },
    createRunRegistry: () => runRegistryMocks,
  }));
}

/**
 * Reset all Redis and run registry mocks.
 * Call this in beforeEach/afterEach to ensure clean state between tests.
 */
export function resetRedisMocks() {
  redisMocks.getRedis.mockClear();
  redisMocks.getRedisAsync.mockClear();
  redisMocks.isRedisHealthy.mockClear();
  redisMocks.resetRedisState.mockClear();
  runRegistryMocks.register.mockClear();
  runRegistryMocks.unregister.mockClear();
  runRegistryMocks.dispatchResume.mockClear();
}

// Auto-install mocks when this module is imported
installRedisMocks();
