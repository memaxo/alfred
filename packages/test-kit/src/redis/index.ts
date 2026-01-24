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

import { registerMockReset } from "../bun/preload";

// Configure environment to disable Redis connections
process.env.REDIS_URL = "false";
process.env.REDIS_RETRY_ENABLED = "false";
process.env.RUN_REGISTRY_BACKEND = "memory";

type ResumePayload = {
  event: string;
  authz: string;
};

type RunHandle = {
  resume(args: { resumeData: ResumePayload }): Promise<unknown>;
  cancel(): Promise<unknown>;
  abortController: AbortController;
};

const handles = new Map<string, RunHandle>();

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
  register: vi.fn(async (runId: string, handle: RunHandle) => {
    handles.set(runId, handle);
  }),
  unregister: vi.fn(async (runId: string) => {
    handles.delete(runId);
  }),
  dispatchResume: vi.fn(async (runId: string, payload: ResumePayload) => {
    const handle = handles.get(runId);
    if (!handle) {
      return false;
    }
    await handle.resume({ resumeData: payload });
    return true;
  }),
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
}

/**
 * Reset all Redis and run registry mocks.
 * Call this in beforeEach/afterEach to ensure clean state between tests.
 */
export function resetRedisMocks() {
  handles.clear();
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

// Auto-register reset function with preload
registerMockReset(resetRedisMocks);
