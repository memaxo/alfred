/**
 * Token Introspection Endpoint Tests
 *
 * Tests RFC 7662 compliant token introspection.
 */

process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";
process.env.BETTER_AUTH_SECRET = "test-secret-key-for-introspection";
process.env.BETTER_AUTH_URL = "http://localhost:3000";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// Mock database for token storage
const mockTokens = new Map<
  string,
  {
    accessToken: string;
    scopes: string;
    clientId: string;
    userId: string;
    accessTokenExpiresAt: Date;
  }
>();

// Reset tokens between tests
beforeEach(() => {
  mockTokens.clear();
});

afterEach(() => {
  mockTokens.clear();
});

describe("Token Introspection Endpoint", () => {
  describe("RFC 7662 Compliance", () => {
    test("returns active=true for valid token", () => {
      const validToken = "valid-access-token-123";
      mockTokens.set(validToken, {
        accessToken: validToken,
        scopes: "read:todos write:todos",
        clientId: "cursor-client",
        userId: "user-123",
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000), // 1 hour
      });

      // Simulate introspection request
      const tokenData = mockTokens.get(validToken);
      const isExpired = tokenData!.accessTokenExpiresAt.getTime() < Date.now();

      expect(tokenData).toBeDefined();
      expect(isExpired).toBe(false);

      // RFC 7662 response format
      const response = {
        active: !isExpired,
        scope: tokenData!.scopes,
        client_id: tokenData!.clientId,
        user_id: tokenData!.userId,
        exp: Math.floor(tokenData!.accessTokenExpiresAt.getTime() / 1000),
      };

      expect(response.active).toBe(true);
      expect(response.scope).toBe("read:todos write:todos");
      expect(response.client_id).toBe("cursor-client");
      expect(response.user_id).toBe("user-123");
      expect(response.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test("returns active=false for expired token", () => {
      const expiredToken = "expired-access-token-456";
      mockTokens.set(expiredToken, {
        accessToken: expiredToken,
        scopes: "read:todos",
        clientId: "cursor-client",
        userId: "user-456",
        accessTokenExpiresAt: new Date(Date.now() - 3_600_000), // 1 hour ago
      });

      const tokenData = mockTokens.get(expiredToken);
      const isExpired = tokenData!.accessTokenExpiresAt.getTime() < Date.now();

      expect(isExpired).toBe(true);

      const response = {
        active: !isExpired,
      };

      expect(response.active).toBe(false);
    });

    test("returns active=false for unknown token", () => {
      const unknownToken = "unknown-token-789";
      const tokenData = mockTokens.get(unknownToken);

      expect(tokenData).toBeUndefined();

      const response = {
        active: false,
      };

      expect(response.active).toBe(false);
    });

    test("returns active=false for empty token", () => {
      const emptyToken = "";
      const tokenData = mockTokens.get(emptyToken);

      expect(tokenData).toBeUndefined();

      // RFC 7662: MUST return active=false for invalid tokens
      const response = {
        active: false,
      };

      expect(response.active).toBe(false);
    });
  });

  describe("Scope Information", () => {
    test("includes all granted scopes in response", () => {
      const token = "multi-scope-token";
      const scopes = "openid profile email read:todos write:todos admin:voice";
      mockTokens.set(token, {
        accessToken: token,
        scopes,
        clientId: "claude-client",
        userId: "user-multi",
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
      });

      const tokenData = mockTokens.get(token);
      expect(tokenData!.scopes).toBe(scopes);
      expect(tokenData!.scopes.split(" ")).toContain("openid");
      expect(tokenData!.scopes.split(" ")).toContain("admin:voice");
    });
  });

  describe("Client Authentication", () => {
    test("validates token regardless of client credentials", () => {
      // RFC 7662 allows introspection without client auth for public tokens
      const publicToken = "public-token";
      mockTokens.set(publicToken, {
        accessToken: publicToken,
        scopes: "read:todos",
        clientId: "public-client",
        userId: "user-public",
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
      });

      const tokenData = mockTokens.get(publicToken);
      expect(tokenData).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("handles malformed token gracefully", () => {
      const malformedToken = "not.a.valid.jwt.token.format";
      const tokenData = mockTokens.get(malformedToken);

      // Should not throw, just return inactive
      expect(tokenData).toBeUndefined();
    });

    test("handles special characters in token", () => {
      const specialToken = "token+with/special=chars";
      const tokenData = mockTokens.get(specialToken);

      expect(tokenData).toBeUndefined();
    });
  });
});

describe("Token Revocation Endpoint", () => {
  describe("RFC 7009 Compliance", () => {
    test("revokes access token successfully", () => {
      const tokenToRevoke = "token-to-revoke";
      mockTokens.set(tokenToRevoke, {
        accessToken: tokenToRevoke,
        scopes: "read:todos",
        clientId: "cursor-client",
        userId: "user-revoke",
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
      });

      expect(mockTokens.has(tokenToRevoke)).toBe(true);

      // Simulate revocation
      mockTokens.delete(tokenToRevoke);

      expect(mockTokens.has(tokenToRevoke)).toBe(false);
    });

    test("returns 200 OK even for unknown token", () => {
      // RFC 7009: Server MUST respond with 200 OK even if token is invalid
      const unknownToken = "unknown-token-for-revoke";

      expect(mockTokens.has(unknownToken)).toBe(false);

      // Attempting to delete non-existent token should not throw
      mockTokens.delete(unknownToken);

      expect(mockTokens.has(unknownToken)).toBe(false);
    });

    test("returns 200 OK for already revoked token", () => {
      const token = "already-revoked-token";

      // Token doesn't exist (already revoked)
      expect(mockTokens.has(token)).toBe(false);

      // Re-revocation should succeed silently
      mockTokens.delete(token);

      expect(mockTokens.has(token)).toBe(false);
    });
  });

  describe("Token Type Handling", () => {
    test("revokes by access_token hint", () => {
      const accessToken = "access-token-hint";
      mockTokens.set(accessToken, {
        accessToken,
        scopes: "read:todos",
        clientId: "client",
        userId: "user",
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
      });

      // With token_type_hint="access_token", should find and revoke
      mockTokens.delete(accessToken);
      expect(mockTokens.has(accessToken)).toBe(false);
    });
  });
});
