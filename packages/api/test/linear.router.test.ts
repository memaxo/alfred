import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { dbModuleStub } from "./utils/mock-db-client";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const upsertLinearMock = dbModuleStub.linearRepo.upsertLinear;
const getLinearByOAuthMock = dbModuleStub.linearRepo.getLinearByOAuth;
const cacheJTIMock = vi.fn();
const requireToolScopesAndPolicyMock = vi.fn();

mock.module("@alfred/auth/token", () => ({
  issueAccessToken: vi.fn(),
  verifyAccessToken: vi.fn(),
  requireToolScopesAndPolicy: requireToolScopesAndPolicyMock,
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

      global.fetch = vi.fn().mockImplementation(async (input: any) => {
        const url = typeof input === "string" ? input : input?.url;
        if (url === "https://api.linear.app/oauth/token") {
          return {
            ok: true,
            json: async () => mockTokenResponse,
          } as any;
        }
        if (url === "https://api.linear.app/graphql") {
          return {
            ok: true,
            json: async () => ({
              data: {
                viewer: {
                  id: "linear-viewer",
                  email: "viewer@example.com",
                  displayName: "Viewer",
                  organization: {
                    id: "linear-org",
                    name: "Org",
                  },
                },
              },
            }),
          } as any;
        }
        throw new Error(`unexpected fetch url: ${String(url)}`);
      });

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
