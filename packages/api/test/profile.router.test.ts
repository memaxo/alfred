import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";
import {
  recordMemoryUpdateMock,
  resetAgentMocks,
} from "./utils/agent-mock";

setupTestEnv();
mockPolicyAudit();

const getProfileMock = vi.fn();
const upsertProfileMock = vi.fn();
mock.module("@alfred/db", () => ({
  createDrizzleClient: vi.fn(),
  createPgClient: vi.fn(),
  createPgPool: vi.fn(),
  db: {},
  assistantRepo: {},
  deployRepo: {},
  evalRepo: {},
  graphRepo: {},
  linearRepo: {},
  policyRepo: {},
  ragRepo: {},
  conversationRepo: {},
  userRepo: {
    getProfile: getProfileMock,
    upsertProfile: upsertProfileMock,
  },
  workflowRepo: {},
  assistantSchema: {},
  deploySchema: {},
  evalSchema: {},
  graphSchema: {},
  linearSchema: {},
  policySchema: {},
  ragSchema: {},
  conversationSchema: {},
  userSchema: {},
  workflowSchema: {},
}));

mock.module("node-pty", () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    kill: vi.fn(),
    resize: vi.fn(),
    write: vi.fn(),
  })),
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["profile.write"],
  });
});

afterEach(() => {
  resetAllMocks();
  resetAgentMocks();
});

describe("profile router", () => {
  describe("get", () => {
    it("retrieves user profile", async () => {
      const mockProfile = {
        userId: "test-user",
        name: "Test User",
        email: "test@example.com",
      };

      getProfileMock.mockResolvedValue(mockProfile);

      const result = await caller.profile.get();

      expect(getProfileMock).toHaveBeenCalledWith("test-user");
      expect(result).toEqual(mockProfile);
    });

    it("throws UNAUTHORIZED when session is missing", async () => {
      const unauthedCaller = await createTestCaller({
        userId: "",
        scopes: [],
      });

      await expect(unauthedCaller.profile.get()).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates user profile", async () => {
      const mockUpdated = {
        userId: "test-user",
        name: "Updated Name",
        email: "updated@example.com",
      };

      upsertProfileMock.mockResolvedValue(mockUpdated);

      const result = await caller.profile.update({
        name: "Updated Name",
        email: "updated@example.com",
      });

      expect(upsertProfileMock).toHaveBeenCalledWith("test-user", {
        name: "Updated Name",
        email: "updated@example.com",
      });
      expect(recordMemoryUpdateMock).toHaveBeenCalledWith("profile", "user");
      expect(result).toEqual(mockUpdated);
    });

    it("throws PRECONDITION_FAILED when obligations unmet", async () => {
      const callerWithObligations = await createTestCaller({
        scopes: ["profile.write"],
      });

      const policyModule = await import("@alfred/policy");
      const evaluateMock = policyModule.evaluate as ReturnType<typeof vi.fn>;
      evaluateMock.mockResolvedValueOnce({
        allow: true,
        obligations: ["biometric_required"],
      });

      await expect(
        callerWithObligations.profile.update({
          name: "test",
        })
      ).rejects.toThrow();
    });
  });
});
