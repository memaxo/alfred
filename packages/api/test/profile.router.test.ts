import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const getProfileMock = vi.fn();
const upsertProfileMock = vi.fn();
const recordMemoryUpdateMock = vi.fn();

mock.module("@alfred/db", () => ({
  userRepo: {
    getProfile: getProfileMock,
    upsertProfile: upsertProfileMock,
  },
}));

mock.module("@alfred/agent", () => ({
  recordMemoryUpdate: recordMemoryUpdateMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["profile.write"],
  });
});

afterEach(() => {
  resetAllMocks();
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

      await expect(
        callerWithObligations.profile.update({
          name: "test",
        })
      ).rejects.toThrow();
    });
  });
});
