import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const upsertLinearMock = vi.fn();
const cacheJTIMock = vi.fn();

mock.module("@alfred/db/repo/linear", () => ({
  upsertLinear: upsertLinearMock,
}));

mock.module("@alfred/auth/token", () => ({
  cacheJTI: cacheJTIMock,
}));

process.env.LINEAR_CLIENT_ID = "test-client-id";
process.env.LINEAR_CLIENT_SECRET = "test-secret";
process.env.LINEAR_REDIRECT_URI = "http://localhost:3000/callback";

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["linear.connect", "linear.webhook"],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe("linear router", () => {
  describe("getAuthorizeUrl", () => {
    it("generates authorization URL", async () => {
      const result = await caller.linear.getAuthorizeUrl({});

      expect(result.url).toContain("linear.app/oauth/authorize");
      expect(result.url).toContain("client_id=test-client-id");
      expect(result.state).toBeDefined();
    });
  });

  describe("oauthCallback", () => {
    it("exchanges authorization code for token", async () => {
      const mockTokenResponse = {
        access_token: "token-123",
        token_type: "Bearer",
        expires_in: 3600,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse,
      } as any);

      upsertLinearMock.mockResolvedValue({
        userId: "test-user",
        accessToken: "token-123",
      });

      // First get a valid state from getAuthorizeUrl
      const authResult = await caller.linear.getAuthorizeUrl({});
      const state = authResult.state;

      const result = await caller.linear.oauthCallback({
        code: "auth-code",
        state,
      });

      expect(upsertLinearMock).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("validates state", async () => {
      await expect(
        caller.linear.oauthCallback({
          code: "auth-code",
          state: "invalid-state",
        })
      ).rejects.toThrow();
    });
  });
});
