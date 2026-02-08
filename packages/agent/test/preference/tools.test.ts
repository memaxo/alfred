import * as userRepo from "@alfred/db/repo/user";
// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
  resetAuthTokenMocks,
} from "@alfred/test-kit/auth/token";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "bun:test";

import * as metrics from "../../src/metrics";
import * as preferenceLoader from "../../src/preference/loader";

// Install shared mocks
installAuthTokenMock();

// Use shared mock for assertions
const mockRequireToolScopesAndPolicy =
  authTokenMocks.requireToolScopesAndPolicy;

const originalRedisUrl = process.env.REDIS_URL;

const mockGetPreferences = vi.fn();
const mockSetPreference = vi.fn();
const getPreferencesSpy = vi
  .spyOn(userRepo, "getPreferences")
  .mockImplementation((...args) => mockGetPreferences(...args));
const setPreferenceSpy = vi
  .spyOn(userRepo, "setPreference")
  .mockImplementation((...args) => mockSetPreference(...args));

const mockInvalidatePreferenceCache = vi.fn();
const invalidatePreferenceCacheSpy = vi
  .spyOn(preferenceLoader, "invalidatePreferenceCache")
  .mockImplementation((...args) => mockInvalidatePreferenceCache(...args));

const recordAssistantToolCallSpy = vi
  .spyOn(metrics, "recordAssistantToolCall")
  .mockImplementation(() => {});

const { toolPreferenceGet, toolPreferenceSet } =
  await import("../../assistant/src/tool/preference");

describe("Preference Tools", () => {
  beforeEach(() => {
    process.env.REDIS_URL = "false";

    resetAuthTokenMocks();
    mockGetPreferences.mockReset();
    mockSetPreference.mockReset();
    mockInvalidatePreferenceCache.mockReset();

    mockRequireToolScopesAndPolicy.mockResolvedValue({
      claims: {
        sub: "test-user",
        scopes: ["preference.read", "preference.write"],
        elevated: true,
        mfa: "passkey",
      },
      decision: { allow: true },
    });
  });
  afterEach(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  afterAll(() => {
    getPreferencesSpy.mockRestore();
    setPreferenceSpy.mockRestore();
    invalidatePreferenceCacheSpy.mockRestore();
    recordAssistantToolCallSpy.mockRestore();
  });

  describe("preference_get", () => {
    it("returns mapped preferences with sources", async () => {
      mockGetPreferences.mockResolvedValue([
        {
          confidence: 0.95,
          key: "response.verbosity",
          source: "user",
          value: "concise",
        },
        {
          confidence: 0.7,
          key: "domain.git.tool_preference",
          source: "inferred",
          value: "git",
        },
      ]);

      const result = await toolPreferenceGet.execute({
        input: { authz: "Bearer token", userId: "u1" },
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
          resource: { id: "u1", kind: "preference" },
        })
      );
    });

    it("filters by key", async () => {
      mockGetPreferences.mockResolvedValue([
        {
          confidence: 1,
          key: "response.verbosity",
          source: "user",
          value: "detailed",
        },
        {
          confidence: 1,
          key: "response.tone",
          source: "user",
          value: "technical",
        },
      ]);

      const result = await toolPreferenceGet.execute({
        input: { key: "response.tone", userId: "u1" },
      });

      expect(result.preferences).toHaveLength(1);
      expect(result.preferences[0]?.key).toBe("response.tone");
    });

    it("filters by domain", async () => {
      mockGetPreferences.mockResolvedValue([
        {
          confidence: 1,
          key: "domain.git.tool_preference",
          source: "user",
          value: "git",
        },
        {
          confidence: 1,
          key: "domain.docker.tool_preference",
          source: "user",
          value: "docker",
        },
      ]);

      const result = await toolPreferenceGet.execute({
        input: { domain: "git", userId: "u1" },
      });

      expect(result.preferences).toHaveLength(1);
      expect(result.preferences[0]?.key).toBe("domain.git.tool_preference");
    });

    it("rejects missing userId via schema", () => {
      const parsed = toolPreferenceGet.inputSchema.safeParse({
        key: "response.verbosity",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("preference_set", () => {
    it("updates preference and returns previous value when present", async () => {
      mockGetPreferences.mockResolvedValue([
        {
          confidence: 1,
          key: "response.verbosity",
          source: "user",
          value: "minimal",
        },
      ]);
      mockSetPreference.mockResolvedValue({
        confidence: 1,
        id: "p1",
        key: "response.verbosity",
        source: "user",
        userId: "u1",
        value: "concise",
      });
      mockInvalidatePreferenceCache.mockResolvedValue();

      const result = await toolPreferenceSet.execute({
        input: {
          authz: "Bearer token",
          key: "response.verbosity",
          userId: "u1",
          value: "concise",
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
          context: expect.objectContaining({ key: "response.verbosity" }),
          resource: { kind: "preference", id: "u1" },
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
        confidence: 0.8,
        id: "p1",
        key: "domain.git.tool_preference",
        source: "inferred",
        userId: "u1",
        value: "git",
      });
      mockInvalidatePreferenceCache.mockResolvedValue();

      await toolPreferenceSet.execute({
        input: {
          key: "domain.git.tool_preference",
          source: "inferred",
          userId: "u1",
          value: "git",
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

    it("rejects missing userId via schema", () => {
      const parsed = toolPreferenceSet.inputSchema.safeParse({
        key: "response.verbosity",
        value: "concise",
      });
      expect(parsed.success).toBe(false);
    });
  });
});
