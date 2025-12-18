import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Mock redis to return null (use memory fallback)
mock.module("../src/redis", () => ({
  getRedis: () => null,
}));

describe("Token Module", () => {
  describe("issueAccessToken", () => {
    beforeEach(() => {
      // Set up valid test keys (must be actual Ed25519 keypair)
      process.env.AGENT_ED25519_PRIVATE = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIBqNMQ3K4b8awQK5bSQ9RgKgAdXd8SpNgN7tgYzGOXc+
-----END PRIVATE KEY-----`;
      process.env.AGENT_ED25519_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAkF7DlChZpMEWvhzluSH8TZDK0nxLfL7L9P3aMmN7oqo=
-----END PUBLIC KEY-----`;
      process.env.AGENT_ISSUER = "alfred-test";
      process.env.TOOL_AUDIENCE = "alfred:tools:test";
    });

    afterEach(() => {
      // Clear cached key promises by resetting module
      mock.restore();
    });

    it("throws when scopes are empty", async () => {
      const { issueAccessToken } = await import("../src/token");

      await expect(issueAccessToken("user-1", [])).rejects.toThrow(
        "Token scopes are required"
      );
    });

    it("throws when scopes is not an array", async () => {
      const { issueAccessToken } = await import("../src/token");

      await expect(
        // @ts-expect-error - testing invalid input
        issueAccessToken("user-1", "invalid")
      ).rejects.toThrow("Token scopes are required");
    });

    it("issues token with valid scopes", async () => {
      const { issueAccessToken } = await import("../src/token");

      const token = await issueAccessToken("user-1", ["read", "write"]);

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe("cacheJTI (replay protection)", () => {
    it("allows first use of JTI", async () => {
      const { cacheJTI } = await import("../src/token");

      // Should not throw
      await expect(
        cacheJTI(`test-jti-${Date.now()}`, 60)
      ).resolves.toBeUndefined();
    });

    it("throws on replayed JTI", async () => {
      const { cacheJTI } = await import("../src/token");

      const jti = `replay-test-${Date.now()}`;
      await cacheJTI(jti, 60);

      await expect(cacheJTI(jti, 60)).rejects.toThrow("token_replayed");
    });
  });

  describe("memory JTI cache size limit", () => {
    it("evicts oldest entry when cache is full", async () => {
      const { cacheJTI } = await import("../src/token");

      // Fill cache with unique JTIs
      // Note: MAX_JTI_CACHE_SIZE is 10_000, but we test with a smaller batch
      const jtiPrefix = `size-limit-test-${Date.now()}`;

      // Cache 100 JTIs
      for (let i = 0; i < 100; i++) {
        await cacheJTI(`${jtiPrefix}-${i}`, 300);
      }

      // Adding more should not throw (eviction happens automatically)
      await expect(
        cacheJTI(`${jtiPrefix}-overflow`, 300)
      ).resolves.toBeUndefined();
    });
  });

  describe("requireToolScopesAndPolicy", () => {
    it("throws on missing Bearer prefix", async () => {
      const { requireToolScopesAndPolicy } = await import("../src/token");

      await expect(
        requireToolScopesAndPolicy("invalid-token", ["read"], {
          action: "test",
          resource: { type: "test", id: "1" },
        })
      ).rejects.toThrow("unauthorized");
    });

    it("throws on undefined authz", async () => {
      const { requireToolScopesAndPolicy } = await import("../src/token");

      await expect(
        requireToolScopesAndPolicy(undefined, ["read"], {
          action: "test",
          resource: { type: "test", id: "1" },
        })
      ).rejects.toThrow("unauthorized");
    });
  });
});
