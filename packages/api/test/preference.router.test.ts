import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const getPreferencesMock = vi.fn();
const setPreferenceMock = vi.fn();
const deletePreferenceMock = vi.fn();
const recordMemoryUpdateMock = vi.fn();
const recordMemoryForgetMock = vi.fn();

mock.module("@alfred/db", () => ({
  userRepo: {
    getPreferences: getPreferencesMock,
    setPreference: setPreferenceMock,
    deletePreference: deletePreferenceMock,
  },
}));

mock.module("@alfred/agent", () => ({
  recordMemoryUpdate: recordMemoryUpdateMock,
  recordMemoryForget: recordMemoryForgetMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["preference.write"],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe("preference router", () => {
  describe("list", () => {
    it("lists preferences with pagination", async () => {
      const mockPreferences = [
        { key: "theme", value: "dark" },
        { key: "language", value: "en" },
      ];

      getPreferencesMock.mockResolvedValue(mockPreferences);

      const result = await caller.preference.list({
        limit: 10,
        offset: 0,
      });

      expect(getPreferencesMock).toHaveBeenCalledWith("test-user");
      expect(result).toEqual(mockPreferences.slice(0, 10));
    });

    it("uses default pagination", async () => {
      getPreferencesMock.mockResolvedValue([]);

      await caller.preference.list();

      expect(getPreferencesMock).toHaveBeenCalledWith("test-user");
    });
  });

  describe("set", () => {
    it("sets a preference", async () => {
      const mockPreference = {
        key: "theme",
        value: "dark",
        confidence: 1.0,
      };

      setPreferenceMock.mockResolvedValue(mockPreference);

      const result = await caller.preference.set({
        key: "theme",
        value: "dark",
        confidence: 1.0,
      });

      expect(setPreferenceMock).toHaveBeenCalledWith(
        "test-user",
        "theme",
        "dark",
        1.0,
        "user"
      );
      expect(recordMemoryUpdateMock).toHaveBeenCalledWith("preference", "user");
      expect(result).toEqual(mockPreference);
    });
  });

  describe("delete", () => {
    it("deletes a preference", async () => {
      deletePreferenceMock.mockResolvedValue(1);

      const result = await caller.preference.delete({
        key: "theme",
      });

      expect(deletePreferenceMock).toHaveBeenCalledWith("test-user", "theme");
      expect(recordMemoryForgetMock).toHaveBeenCalledWith("preference");
      expect(result).toEqual({ removed: 1 });
    });

    it.skip("returns zero when preference not found", async () => {
      deletePreferenceMock.mockResolvedValue(0);

      const result = await caller.preference.delete({
        key: "nonexistent",
      });

      expect(result).toEqual({ removed: 0 });
      // No forget metrics should be emitted when nothing removed
      expect(recordMemoryForgetMock).toHaveBeenCalledTimes(0);
    });
  });
});
