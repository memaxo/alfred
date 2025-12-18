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

/**
 * Mock implementations for logger methods.
 * Use these to assert on log calls in tests.
 */
export const loggerMocks = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

/**
 * Install logger mock.
 * Call this BEFORE importing any modules that use @alfred/logger.
 */
export function installLoggerMock() {
  mock.module("@alfred/logger", () => ({
    logger: {
      info: loggerMocks.info,
      warn: loggerMocks.warn,
      error: loggerMocks.error,
      debug: loggerMocks.debug,
    },
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
}

// Auto-install when this module is imported
installLoggerMock();
