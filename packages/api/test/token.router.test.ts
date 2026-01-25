import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";

process.env.OPENAI_API_KEY = "test";

import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

// Mock node-pty to avoid ABI issues
mock.module("node-pty", () => ({
  spawn: () => ({
    on: () => {},
    kill: () => {},
    resize: () => {},
    write: () => {},
  }),
}));

const issueAccessTokenMock = vi.fn();
const requireRecentBiometricMock = vi.fn();

mock.module("@alfred/auth/token", () => ({
  issueAccessToken: issueAccessTokenMock,
  verifyAccessToken: vi.fn(),
  requireToolScopesAndPolicy: vi.fn(),
  cacheJTI: vi.fn(),
}));

mock.module("@alfred/auth/biometric", () => ({
  requireRecentBiometric: requireRecentBiometricMock,
  // Ensure index-level import of setBiometricTicket does not break when auth package is loaded indirectly
  setBiometricTicket: vi.fn(),
  autoGrantBiometricIfBypassed: vi.fn(),
}));

// Allow policy by default for token routes
mock.module("@alfred/policy", () => ({
  evaluate: vi.fn().mockResolvedValue({ allow: true, obligations: [] }),
  registerCacheObs: () => {},
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["token.issue", "token.elevate"],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe("token router", () => {
  describe("issue", () => {
    it("issues an access token", async () => {
      issueAccessTokenMock.mockResolvedValue("token-123");

      const result = await caller.token.issue({
        scopes: ["read", "write"],
        ttlSec: 300,
      });

      expect(issueAccessTokenMock).toHaveBeenCalledWith(
        "test-user",
        ["read", "write"],
        expect.any(String),
        {
          ttlSec: 300,
          elevated: false,
          mfa: "none",
        }
      );
      expect(result).toEqual({
        token: "token-123",
        tokenId: expect.any(String),
      });
    });

    it("uses default audience", async () => {
      issueAccessTokenMock.mockResolvedValue("token-123");

      await caller.token.issue({
        scopes: ["read"],
      });

      expect(issueAccessTokenMock).toHaveBeenCalledWith(
        "test-user",
        ["read"],
        expect.any(String),
        expect.any(Object)
      );
    });

    it("validates scopes", async () => {
      await expect(
        caller.token.issue({
          scopes: [],
        } as any)
      ).rejects.toThrow();
    });
  });

  describe("elevate", () => {
    it("issues an elevated token with biometric", async () => {
      requireRecentBiometricMock.mockResolvedValue();
      issueAccessTokenMock.mockResolvedValue("elevated-token-123");

      const result = await caller.token.elevate({
        scopes: ["admin"],
        ttlSec: 300,
      });

      expect(requireRecentBiometricMock).toHaveBeenCalled();
      expect(issueAccessTokenMock).toHaveBeenCalledWith(
        "test-user",
        ["admin"],
        expect.any(String),
        {
          ttlSec: 300,
          elevated: true,
          mfa: "passkey",
        }
      );
      expect(result).toEqual({
        token: "elevated-token-123",
        tokenId: expect.any(String),
      });
    });

    it("throws FORBIDDEN when biometric not recent", async () => {
      requireRecentBiometricMock.mockRejectedValue(
        new Error("biometric_expired")
      );

      await expect(
        caller.token.elevate({
          scopes: ["admin"],
        })
      ).rejects.toThrow();
    });
  });
});
