import { afterEach, beforeAll, describe, expect, it, vi } from "bun:test";
import { dbModuleStub } from "./utils/mock-db-client";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
} from "@alfred/test-kit/auth/token";

// Install shared mocks
installAuthTokenMock();

const upsertLinearMock = dbModuleStub.linearRepo.upsertLinear;
const _getLinearByOAuthMock = dbModuleStub.linearRepo.getLinearByOAuth;
const _cacheJTIMock = authTokenMocks.cacheJTI;
const _requireToolScopesAndPolicyMock =
  authTokenMocks.requireToolScopesAndPolicy;

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

      global.fetch = vi.fn().mockImplementation((input: any) => {
        const url = typeof input === "string" ? input : input?.url;
        if (url === "https://api.linear.app/oauth/token") {
          return Promise.resolve({
            ok: true,
            json: async () => mockTokenResponse,
          } as any);
        }
        if (url === "https://api.linear.app/graphql") {
          return Promise.resolve({
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
          } as any);
        }
        return Promise.reject(
          new Error(`unexpected fetch url: ${String(url)}`)
        );
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
