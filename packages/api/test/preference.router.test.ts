import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { dbModuleStub } from "./utils/mock-db-client";
import { mockPolicyAudit, setupTestEnv } from "./utils/router-helpers";

setupTestEnv();
mockPolicyAudit();

const getPreferencesMock = vi.fn();
const setPreferenceMock = vi.fn();
const deletePreferenceMock = vi.fn();
const addFeedbackMock = vi.fn();
const getMessageMock = vi.fn();
const messageRowToUIMessageMock = vi.fn();
const invalidatePreferenceCacheMock = vi.fn();
const inferPreferenceFromCorrectionMock = vi.fn();
let recordMemoryUpdateSpy: ReturnType<typeof vi.spyOn>;
let recordMemoryForgetSpy: ReturnType<typeof vi.spyOn>;

dbModuleStub.userRepo.getPreferences = getPreferencesMock;
dbModuleStub.userRepo.setPreference = setPreferenceMock;
dbModuleStub.userRepo.deletePreference = deletePreferenceMock;
dbModuleStub.userRepo.addFeedback = addFeedbackMock;
dbModuleStub.userRepo.getFeedback = vi.fn().mockResolvedValue([]);

dbModuleStub.conversationRepo.getMessage = getMessageMock;
dbModuleStub.conversationRepo.messageRowToUIMessage = messageRowToUIMessageMock;
dbModuleStub.conversationRepo.getActiveUserIds = vi.fn().mockResolvedValue([]);
dbModuleStub.conversationRepo.getConversations = vi.fn().mockResolvedValue([]);
dbModuleStub.conversationRepo.getConversationHistory = vi
  .fn()
  .mockResolvedValue(null);
dbModuleStub.conversationRepo.createConversation = vi.fn();
dbModuleStub.conversationRepo.createMessage = vi.fn();

dbModuleStub.userSchema = dbModuleStub.userSchema ?? {};
dbModuleStub.userSchema.preferences = { $inferSelect: {} };

mock.module("@alfred/agent/preference/loader", () => ({
  loadPreferences: vi.fn().mockResolvedValue(new Map()),
  loadPreferencesWithDefaults: vi.fn().mockResolvedValue(new Map()),
  invalidatePreferenceCache: invalidatePreferenceCacheMock,
  resetPreferenceCache: vi.fn(),
}));

mock.module("@alfred/agent/preference/inference", () => ({
  inferPreferenceFromCorrection: inferPreferenceFromCorrectionMock,
  inferResponsePreferences: vi.fn().mockResolvedValue(new Map()),
  inferDomainPreferences: vi.fn().mockReturnValue(new Map()),
  inferPreferencesFromFeedback: vi.fn().mockReturnValue(new Map()),
}));

let caller: Awaited<
  ReturnType<typeof import("./utils/trpc")["createTestCaller"]>
>;

beforeAll(async () => {
  const { createTestCaller } = await import("./utils/trpc");
  const agent = await import("@alfred/agent");
  recordMemoryUpdateSpy = vi
    .spyOn(agent, "recordMemoryUpdate")
    .mockImplementation(() => {});
  recordMemoryForgetSpy = vi
    .spyOn(agent, "recordMemoryForget")
    .mockImplementation(() => {});
  caller = await createTestCaller({
    scopes: ["preference.write"],
  });
});

beforeEach(() => {
  getMessageMock.mockReset();
  messageRowToUIMessageMock.mockReset();
  messageRowToUIMessageMock.mockImplementation((row) => ({
    id: row.id,
    role: "assistant",
    parts: [{ type: "text", text: row.id }],
  }));
  inferPreferenceFromCorrectionMock.mockReset();
  inferPreferenceFromCorrectionMock.mockResolvedValue(null);
  invalidatePreferenceCacheMock.mockReset();
  addFeedbackMock.mockReset();
  getPreferencesMock.mockReset();
  setPreferenceMock.mockReset();
  deletePreferenceMock.mockReset();
  recordMemoryUpdateSpy?.mockClear();
  recordMemoryForgetSpy?.mockClear();
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
      expect(recordMemoryUpdateSpy).toHaveBeenCalledWith("preference", "user");
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
      expect(recordMemoryForgetSpy).toHaveBeenCalledWith("preference");
      expect(result).toEqual({ removed: 1 });
    });

    it("returns zero when preference not found", async () => {
      deletePreferenceMock.mockResolvedValue(0);

      const result = await caller.preference.delete({
        key: "nonexistent",
      });

      expect(result).toEqual({ removed: 0 });
      // No forget metrics should be emitted when nothing removed
      expect(recordMemoryForgetSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe("updateFromFeedback", () => {
    it("updates preferences and records feedback", async () => {
      getMessageMock.mockResolvedValue({
        id: "msg-1",
        conversationId: "conv-1",
      });

      const result = await caller.preference.updateFromFeedback({
        messageId: "msg-1",
        rating: 5,
        tags: ["too_verbose"],
        preferenceUpdates: {
          "response.verbosity": "concise",
        },
      });

      expect(setPreferenceMock).toHaveBeenCalledWith(
        "test-user",
        "response.verbosity",
        "concise",
        0.9,
        "learned"
      );
      expect(addFeedbackMock).toHaveBeenCalledWith(
        "test-user",
        "conv-1",
        "msg-1",
        5,
        undefined,
        ["too_verbose"]
      );
      expect(invalidatePreferenceCacheMock).toHaveBeenCalledWith("test-user");
      expect(recordMemoryUpdateSpy).toHaveBeenCalledWith(
        "preference",
        "learned"
      );
      expect(result).toEqual({ updated: 1 });
    });

    it("validates input schema", async () => {
      // Missing messageId
      await expect(
        caller.preference.updateFromFeedback({
          messageId: "",
          preferenceUpdates: { "response.verbosity": "concise" },
        } as any)
      ).rejects.toThrow();

      // Empty preferenceUpdates
      await expect(
        caller.preference.updateFromFeedback({
          messageId: "msg-1",
          preferenceUpdates: {},
        })
      ).rejects.toThrow();

      // Invalid preference key
      await expect(
        caller.preference.updateFromFeedback({
          messageId: "msg-1",
          preferenceUpdates: { "": "value" },
        })
      ).rejects.toThrow();
    });

    it("throws when message not found", async () => {
      getMessageMock.mockResolvedValue(null);

      await expect(
        caller.preference.updateFromFeedback({
          messageId: "missing",
          preferenceUpdates: { "response.verbosity": "concise" },
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("inferFromCorrection", () => {
    it("persists inferred preference", async () => {
      getMessageMock
        .mockResolvedValueOnce({ id: "orig" })
        .mockResolvedValueOnce({ id: "corr" });
      inferPreferenceFromCorrectionMock.mockResolvedValue({
        key: "response.verbosity",
        value: "concise",
      });

      const result = await caller.preference.inferFromCorrection({
        originalMessageId: "orig",
        correctedMessageId: "corr",
        correctionType: "verbosity",
      });

      expect(setPreferenceMock).toHaveBeenCalledWith(
        "test-user",
        "response.verbosity",
        "concise",
        0.7,
        "inferred"
      );
      expect(invalidatePreferenceCacheMock).toHaveBeenCalledWith("test-user");
      expect(recordMemoryUpdateSpy).toHaveBeenCalledWith(
        "preference",
        "inferred"
      );
      expect(result).toEqual({ inferred: 1 });
    });

    it("returns zero when no inference", async () => {
      getMessageMock
        .mockResolvedValueOnce({ id: "orig" })
        .mockResolvedValueOnce({ id: "corr" });
      inferPreferenceFromCorrectionMock.mockResolvedValue(null);

      const result = await caller.preference.inferFromCorrection({
        originalMessageId: "orig",
        correctedMessageId: "corr",
        correctionType: "tone",
      });

      expect(setPreferenceMock).not.toHaveBeenCalled();
      expect(result).toEqual({ inferred: 0 });
    });
  });
});
