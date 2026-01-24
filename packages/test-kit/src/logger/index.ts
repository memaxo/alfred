/**
 * Logger test infrastructure
 *
 * Provides reusable mocking for @alfred/logger in tests.
 * Import this module BEFORE any other imports that might use the logger.
 *
 * Usage:
 *   import "@alfred/test-kit/logger"; // At top of test file
 *
 * Or for more control:
 *   import { installLoggerMock, resetLoggerMocks, loggerMocks } from "@alfred/test-kit/logger";
 */

import { mock, vi } from "bun:test";

import { registerMockReset } from "../bun/preload";

/**
 * Mock implementations for logger methods.
 * Use these to assert on log calls in tests.
 */
export const loggerMocks = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
  configure: vi.fn(),
};

const mockLogger = {
  info: (...args: Parameters<typeof loggerMocks.info>) =>
    loggerMocks.info(...args),
  warn: (...args: Parameters<typeof loggerMocks.warn>) =>
    loggerMocks.warn(...args),
  error: (...args: Parameters<typeof loggerMocks.error>) =>
    loggerMocks.error(...args),
  debug: (...args: Parameters<typeof loggerMocks.debug>) =>
    loggerMocks.debug(...args),
  child: (context: unknown) => {
    loggerMocks.child(context);
    return mockLogger;
  },
  configure: (cfg: unknown) => {
    loggerMocks.configure(cfg);
  },
};

/**
 * Install logger mock.
 * Call this BEFORE importing any modules that use @alfred/logger.
 */
export function installLoggerMock() {
  mock.module("@alfred/logger", () => ({
    logger: mockLogger,
  }));
}

/**
 * Reset all logger mocks.
 * Call this in beforeEach/afterEach to ensure clean state between tests.
 */
export function resetLoggerMocks() {
  loggerMocks.info.mockClear();
  loggerMocks.warn.mockClear();
  loggerMocks.error.mockClear();
  loggerMocks.debug.mockClear();
  loggerMocks.child.mockClear();
  loggerMocks.configure.mockClear();
}

// Auto-install when this module is imported
installLoggerMock();

// Auto-register reset function with preload
registerMockReset(resetLoggerMocks);
