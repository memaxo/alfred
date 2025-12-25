import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { recordMemoryUpdateMock, resetAgentMocks } from "./utils/agent-mock";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { dbModuleStub } from "./utils/mock-db-client";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const getProfileMock = vi.fn();
const upsertProfileMock = vi.fn();

dbModuleStub.userRepo.getProfile = getProfileMock;
dbModuleStub.userRepo.upsertProfile = upsertProfileMock;

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
        obligations: [
          {
            type: "biometric",
            reason: "biometric_required",
            metadata: { code: "requireBio" },
          },
        ],
      });

      await expect(
        callerWithObligations.profile.update({
          name: "test",
        })
      ).rejects.toThrow();
    });

    it("validates input schema", async () => {
      // Invalid email
      await expect(
        caller.profile.update({
          email: "not-an-email",
        })
      ).rejects.toThrow();

      // Empty name
      await expect(
        caller.profile.update({
          name: "",
        })
      ).rejects.toThrow();

      // Too long name (max 256)
      await expect(
        caller.profile.update({
          name: "a".repeat(257),
        })
      ).rejects.toThrow();
    });
  });
});
