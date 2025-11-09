/**
 * Router test utilities
 * Common patterns and mocks for router testing
 */

import { mock, vi } from "bun:test";
import type { TRPCError } from "@trpc/server";

/**
 * Common mock setup for policy audit logging
 */
export function mockPolicyAudit() {
  mock.module("@alfred/db/repo/policy", () => ({
    createAuditLog: vi.fn().mockResolvedValue(undefined),
  }));
}

/**
 * Common mock setup for workflow repository
 */
export function mockWorkflowRepo() {
  const createRunMock = vi.fn();
  const updateRunMock = vi.fn();
  const appendEventMock = vi.fn();
  const getRunMock = vi.fn();
  const listEventsMock = vi.fn();
  const listEventsByTypeMock = vi.fn();
  const listEventsByTypePagedMock = vi.fn();
  const countEventsByTypeMock = vi.fn();

  mock.module("@alfred/db/repo/workflow", () => ({
    createRun: createRunMock,
    updateRun: updateRunMock,
    appendEvent: appendEventMock,
    getRun: getRunMock,
    listEvents: listEventsMock,
    listEventsByType: listEventsByTypeMock,
    listEventsByTypePaged: listEventsByTypePagedMock,
    countEventsByType: countEventsByTypeMock,
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
  const registerMock = vi.fn().mockResolvedValue(undefined);
  const unregisterMock = vi.fn().mockResolvedValue(undefined);
  const dispatchResumeMock = vi.fn().mockResolvedValue(true);

  mock.module("@alfred/api/run-registry", () => ({
    runRegistry: {
      register: registerMock,
      unregister: unregisterMock,
      dispatchResume: dispatchResumeMock,
    },
  }));

  return {
    register: registerMock,
    unregister: unregisterMock,
    dispatchResume: dispatchResumeMock,
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

  return {
    runPlanV6: runPlanV6Mock,
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
  vi.restoreAllMocks();
  mock.restore();
}

/**
 * Default test environment setup
 */
export function setupTestEnv() {
  process.env.DATABASE_URL ??= "postgres://localhost:5432/test";
  process.env.RUN_DB_TESTS ??= "0";
}
