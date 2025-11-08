import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const issueAccessTokenMock = vi.fn();
const requireRecentBiometricMock = vi.fn();

mock.module("@alfred/auth/token", () => ({
  issueAccessToken: issueAccessTokenMock,
}));

mock.module("@alfred/auth/biometric", () => ({
  requireRecentBiometric: requireRecentBiometricMock,
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
      expect(result).toEqual({ token: "token-123" });
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
      requireRecentBiometricMock.mockResolvedValue(undefined);
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
      expect(result).toEqual({ token: "elevated-token-123" });
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
