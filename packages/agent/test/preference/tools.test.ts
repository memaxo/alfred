import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
  resetAuthTokenMocks,
} from "@alfred/test-kit/auth/token";

// Install shared mocks
installAuthTokenMock();

// Use shared mock for assertions
const mockRequireToolScopesAndPolicy = authTokenMocks.requireToolScopesAndPolicy;

const originalRedisUrl = process.env.REDIS_URL;

const mockGetPreferences = mock();
const mockSetPreference = mock();
mock.module("@alfred/db", () => ({
  userRepo: {
    getPreferences: mockGetPreferences,
    setPreference: mockSetPreference,
  },
}));

const mockInvalidatePreferenceCache = mock();
mock.module("../../../src/preference/loader", () => ({
  invalidatePreferenceCache: mockInvalidatePreferenceCache,
}));
mock.module("../../../src/preference/loader.ts", () => ({
  invalidatePreferenceCache: mockInvalidatePreferenceCache,
}));

mock.module("../../../src/metrics", () => ({
  recordAssistantToolCall: () => {},
}));
mock.module("../../../src/metrics.ts", () => ({
  recordAssistantToolCall: () => {},
}));

const { toolPreferenceGet, toolPreferenceSet } = await import(
  "../../assistant/src/tool/preference"
);

describe("Preference Tools", () => {
  beforeEach(() => {
    process.env.REDIS_URL = "false";

    resetAuthTokenMocks();
    mockGetPreferences.mockReset();
    mockSetPreference.mockReset();
    mockInvalidatePreferenceCache.mockReset();

    mockRequireToolScopesAndPolicy.mockResolvedValue({
      decision: { allow: true },
      claims: {
        sub: "test-user",
        scopes: ["preference.read", "preference.write"],
        elevated: true,
        mfa: "passkey",
      },
    });
  });
  afterEach(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  describe("preference_get", () => {
    it("returns mapped preferences with sources", async () => {
      mockGetPreferences.mockResolvedValue([
        {
          key: "response.verbosity",
          value: "concise",
          confidence: 0.95,
          source: "user",
        },
        {
          key: "domain.git.tool_preference",
          value: "git",
          confidence: 0.7,
          source: "inferred",
        },
      ]);

      const result = await toolPreferenceGet.execute({
        input: { userId: "u1", authz: "Bearer token" },
      });

      expect(result.preferences).toHaveLength(2);
      expect(result.preferences[0]?.key).toBe("domain.git.tool_preference");
      expect(result.preferences[0]?.source).toBe("inferred");
      expect(result.preferences[1]?.key).toBe("response.verbosity");
      expect(result.preferences[1]?.source).toBe("explicit");

      expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
        "Bearer token",
        ["preference.read"],
        expect.objectContaining({
          action: "preference.read",
          resource: { kind: "preference", id: "u1" },
        })
      );
    });

    it("filters by key", async () => {
      mockGetPreferences.mockResolvedValue([
        {
          key: "response.verbosity",
          value: "detailed",
          confidence: 1,
          source: "user",
        },
        {
          key: "response.tone",
          value: "technical",
          confidence: 1,
          source: "user",
        },
      ]);

      const result = await toolPreferenceGet.execute({
        input: { userId: "u1", key: "response.tone" },
      });

      expect(result.preferences).toHaveLength(1);
      expect(result.preferences[0]?.key).toBe("response.tone");
    });

    it("filters by domain", async () => {
      mockGetPreferences.mockResolvedValue([
        {
          key: "domain.git.tool_preference",
          value: "git",
          confidence: 1,
          source: "user",
        },
        {
          key: "domain.docker.tool_preference",
          value: "docker",
          confidence: 1,
          source: "user",
        },
      ]);

      const result = await toolPreferenceGet.execute({
        input: { userId: "u1", domain: "git" },
      });

      expect(result.preferences).toHaveLength(1);
      expect(result.preferences[0]?.key).toBe("domain.git.tool_preference");
    });

    it("rejects invalid key via schema", () => {
      const parsed = toolPreferenceGet.inputSchema.safeParse({
        userId: "u1",
        key: "not-a-real-key",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("preference_set", () => {
    it("updates preference and returns previous value when present", async () => {
      mockGetPreferences.mockResolvedValue([
        {
          key: "response.verbosity",
          value: "minimal",
          confidence: 1,
          source: "user",
        },
      ]);
      mockSetPreference.mockResolvedValue({
        id: "p1",
        userId: "u1",
        key: "response.verbosity",
        value: "concise",
        confidence: 1,
        source: "user",
      });
      mockInvalidatePreferenceCache.mockResolvedValue(undefined);

      const result = await toolPreferenceSet.execute({
        input: {
          userId: "u1",
          key: "response.verbosity",
          value: "concise",
          authz: "Bearer token",
        },
      });

      expect(result.updated).toBe(true);
      expect(result.key).toBe("response.verbosity");
      expect(result.previousValue).toBe("minimal");
      expect(result.newValue).toBe("concise");

      expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
        "Bearer token",
        ["preference.write"],
        expect.objectContaining({
          action: "preference.set",
          resource: { kind: "preference", id: "u1" },
          context: expect.objectContaining({ key: "response.verbosity" }),
        })
      );

      expect(mockSetPreference).toHaveBeenCalledWith(
        "u1",
        "response.verbosity",
        "concise",
        1,
        "user"
      );
    });

    it("uses inferred source mapping and default confidence", async () => {
      mockGetPreferences.mockResolvedValue([]);
      mockSetPreference.mockResolvedValue({
        id: "p1",
        userId: "u1",
        key: "domain.git.tool_preference",
        value: "git",
        confidence: 0.8,
        source: "inferred",
      });
      mockInvalidatePreferenceCache.mockResolvedValue(undefined);

      await toolPreferenceSet.execute({
        input: {
          userId: "u1",
          key: "domain.git.tool_preference",
          value: "git",
          source: "inferred",
        },
      });

      expect(mockSetPreference).toHaveBeenCalledWith(
        "u1",
        "domain.git.tool_preference",
        "git",
        0.8,
        "inferred"
      );
    });

    it("rejects invalid values via schema", () => {
      const parsed = toolPreferenceSet.inputSchema.safeParse({
        userId: "u1",
        key: "response.verbosity",
        value: null,
      });
      expect(parsed.success).toBe(false);
    });
  });
});
