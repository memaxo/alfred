/**
 * Router test utilities
 * Common patterns and mocks for router testing
 */

import type { Obligation } from "@alfred/type";
import type { TRPCError } from "@trpc/server";

import { mock, vi } from "bun:test";

// Re-export Redis mocks from test-kit for convenience
export {
  installRedisMocks,
  redisMocks,
  resetRedisMocks,
  runRegistryMocks,
} from "@alfred/test-kit/redis";

// Shared mock references that can be controlled by any test
export const createAuditLogMock = vi.fn().mockResolvedValue();
export const queryAuditLogsMock = vi
  .fn()
  .mockResolvedValue({ rows: [], totalCount: 0 });
export const policyEvaluateMock = vi
  .fn()
  .mockResolvedValue({ allow: true, obligations: [] as Obligation[] });
export const consumeRouteRateLimitMock = vi.fn().mockResolvedValue();

/**
 * Common mock setup for policy audit logging
 */
export function mockPolicyAudit() {
  mock.module("@alfred/db/repo/policy", () => ({
    createAuditLog: createAuditLogMock,
    queryAuditLogs: queryAuditLogsMock,
  }));
  mock.module("@alfred/policy", () => ({
    evaluate: policyEvaluateMock,
    registerCacheObs: vi.fn(),
  }));
}

export function mockRateLimit() {
  mock.module("@alfred/api/trpc", () => ({
    consumeRouteRateLimit: consumeRouteRateLimitMock,
  }));
}

/**
 * Common mock setup for workflow repository
 */
export function mockWorkflowRepo() {
  const createRunMock = vi.fn();
  const updateRunMock = vi.fn();
  const appendEventMock = vi.fn().mockResolvedValue();
  const getRunMock = vi.fn();
  const listEventsMock = vi.fn().mockResolvedValue([]);
  const listEventsByTypeMock = vi.fn().mockResolvedValue([]);
  const listEventsByTypePagedMock = vi.fn().mockResolvedValue([]);
  const countEventsByTypeMock = vi.fn();
  class PostgresCheckpointStorage {
    save() {}
    load() {
      return null;
    }
    delete() {}
  }

  mock.module("@alfred/db/repo/workflow", () => ({
    createRun: createRunMock,
    updateRun: updateRunMock,
    appendEvent: appendEventMock,
    getRun: getRunMock,
    listEvents: listEventsMock,
    listEventsByType: listEventsByTypeMock,
    listEventsByTypePaged: listEventsByTypePagedMock,
    countEventsByType: countEventsByTypeMock,
    PostgresCheckpointStorage,
  }));

  return {
    createRun: createRunMock,
    updateRun: updateRunMock,
    appendEvent: appendEventMock,
    getRun: getRunMock,
    listEvents: listEventsMock,
    listEventsByType: listEventsByTypeMock,
    listEventsByTypePaged: listEventsByTypePagedMock,
    countEventsByType: countEventsByTypeMock,
  };
}

/**
 * Common mock setup for run registry
 */
export function mockRunRegistry() {
  const registerMock = vi.fn().mockResolvedValue();
  const unregisterMock = vi.fn().mockResolvedValue();
  const dispatchResumeMock = vi.fn().mockResolvedValue(true);
  const dispatchSuspendMock = vi.fn().mockResolvedValue(true);
  const dispatchCancelMock = vi.fn().mockResolvedValue(true);

  mock.module("@alfred/api/run-registry", () => ({
    runRegistry: {
      register: registerMock,
      unregister: unregisterMock,
      dispatchResume: dispatchResumeMock,
      dispatchSuspend: dispatchSuspendMock,
      dispatchCancel: dispatchCancelMock,
    },
  }));

  mock.module("@alfred/agent/workflow/registry", () => ({
    runRegistry: {
      register: registerMock,
      unregister: unregisterMock,
      dispatchResume: dispatchResumeMock,
      dispatchSuspend: dispatchSuspendMock,
      dispatchCancel: dispatchCancelMock,
    },
  }));

  return {
    register: registerMock,
    unregister: unregisterMock,
    dispatchResume: dispatchResumeMock,
    dispatchSuspend: dispatchSuspendMock,
    dispatchCancel: dispatchCancelMock,
  };
}

/**
 * Common mock setup for AI SDK generate
 */
export function mockGenerateText() {
  const generateTextMock = vi.fn();
  const persistResultMock = vi.fn().mockResolvedValue(null);

  mock.module("@alfred/api/ai/generate", () => ({
    generateText: generateTextMock,
    persistResult: persistResultMock,
  }));

  return {
    generateText: generateTextMock,
    persistResult: persistResultMock,
  };
}

/**
 * Common mock setup for workflow runner
 */
export function mockWorkflowRunner() {
  const runPlanV6Mock = vi.fn();

  mock.module("@alfred/api/workflow/runner", () => ({
    runPlanV6: runPlanV6Mock,
  }));

  mock.module("@alfred/agent/workflow/runner", () => ({
    runPlanV6: runPlanV6Mock,
  }));

  return {
    runPlanV6: runPlanV6Mock,
  };
}

/**
 * Common mock setup for @alfred/runtime
 */
export function mockWorkflowRuntime() {
  const createRuntimeMock = vi.fn();
  const runCognitiveLoopMock = vi.fn();
  const runAssistantGenerationMock = vi.fn();

  mock.module("@alfred/runtime", () => ({
    createRuntime: createRuntimeMock,
    runCognitiveLoop: runCognitiveLoopMock,
    runAssistantGeneration: runAssistantGenerationMock,
  }));

  return {
    createRuntime: createRuntimeMock,
    runCognitiveLoop: runCognitiveLoopMock,
    runAssistantGeneration: runAssistantGenerationMock,
  };
}

/**
 * Helper to create a mock TRPC error
 */
export function createTRPCError(
  code: TRPCError["code"],
  message: string
): TRPCError {
  return {
    code,
    message,
    name: "TRPCError",
  } as TRPCError;
}

/**
 * Helper to reset all mocks
 */
export function resetAllMocks() {
  vi.clearAllMocks();
}

/**
 * Default test environment setup.
 * Sets up environment variables for tests.
 *
 * Note: Redis configuration is handled by importing "@alfred/test-kit/redis"
 * at the top of test files BEFORE other imports.
 */
export function setupTestEnv() {
  // Default to sqlite in tests to avoid requiring a running Postgres.
  process.env.DATABASE_URL ??= "sqlite::memory:";
  process.env.RUN_DB_TESTS ??= "0";
  process.env.DISABLE_METRICS_HOOKS = "1";
}
