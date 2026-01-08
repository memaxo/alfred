/**
 * Auth token test infrastructure
 *
 * Provides reusable mocking for @alfred/auth/token in tests.
 * Import this module BEFORE any other imports that might use auth tokens.
 *
 * Usage:
 *   import { installAuthTokenMock, authTokenMocks } from "@alfred/test-kit/auth/token";
 *   installAuthTokenMock();
 *
 * Or configure specific behavior:
 *   authTokenMocks.requireToolScopesAndPolicy.mockResolvedValueOnce({
 *     decision: { allow: false },
 *     claims: null,
 *   });
 */

import { mock, vi } from "bun:test";
import { registerMockReset } from "../bun/preload";

/**
 * Default claims returned by requireToolScopesAndPolicy mock.
 */
export const DEFAULT_TOKEN_CLAIMS = {
  sub: "test-user",
  scopes: ["*"],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  jti: "test-jti",
  elevated: true,
  mfa: "passkey" as const,
};

/**
 * Mock implementations for auth token methods.
 * Use these to assert on token operations or customize behavior.
 */
export const authTokenMocks = {
  requireToolScopesAndPolicy: vi.fn().mockResolvedValue({
    decision: { allow: true },
    claims: DEFAULT_TOKEN_CLAIMS,
  }),
  issueAccessToken: vi.fn().mockResolvedValue("mock-access-token"),
  verifyAccessToken: vi.fn().mockResolvedValue(DEFAULT_TOKEN_CLAIMS),
  cacheJTI: vi.fn().mockResolvedValue(undefined),
};

/**
 * Install auth token mock.
 * Call this BEFORE importing any modules that use @alfred/auth/token.
 */
export function installAuthTokenMock() {
  mock.module("@alfred/auth/token", () => ({
    requireToolScopesAndPolicy: authTokenMocks.requireToolScopesAndPolicy,
    issueAccessToken: authTokenMocks.issueAccessToken,
    verifyAccessToken: authTokenMocks.verifyAccessToken,
    cacheJTI: authTokenMocks.cacheJTI,
  }));
}

/**
 * Reset all auth token mocks to default behavior.
 * Call this in beforeEach/afterEach to ensure clean state between tests.
 */
export function resetAuthTokenMocks() {
  authTokenMocks.requireToolScopesAndPolicy.mockClear();
  authTokenMocks.requireToolScopesAndPolicy.mockResolvedValue({
    decision: { allow: true },
    claims: DEFAULT_TOKEN_CLAIMS,
  });
  authTokenMocks.issueAccessToken.mockClear();
  authTokenMocks.issueAccessToken.mockResolvedValue("mock-access-token");
  authTokenMocks.verifyAccessToken.mockClear();
  authTokenMocks.verifyAccessToken.mockResolvedValue(DEFAULT_TOKEN_CLAIMS);
  authTokenMocks.cacheJTI.mockClear();
}

/**
 * Configure the mock to deny the next policy check.
 */
export function denyNextPolicyCheck(reason = "denied_by_test") {
  authTokenMocks.requireToolScopesAndPolicy.mockResolvedValueOnce({
    decision: { allow: false, reason },
    claims: null,
  });
}

/**
 * Configure the mock to require specific scopes.
 */
export function requireScopes(scopes: string[]) {
  authTokenMocks.requireToolScopesAndPolicy.mockResolvedValue({
    decision: { allow: true },
    claims: { ...DEFAULT_TOKEN_CLAIMS, scopes },
  });
}

// Auto-register reset function with preload
// This is safe even if installAuthTokenMock hasn't been called yet,
// because resetAuthTokenMocks just clears vi.fn() state
registerMockReset(resetAuthTokenMocks);
