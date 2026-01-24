import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import {
  recordMemoryForgetMock,
  recordMemoryUpdateMock,
  resetAgentMocks,
} from "./utils/agent-mock";
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

dbModuleStub.userRepo.getPreferences = getPreferencesMock;
dbModuleStub.userRepo.setPreference = setPreferenceMock;
dbModuleStub.userRepo.deletePreference = deletePreferenceMock;
dbModuleStub.userRepo.addFeedback = addFeedbackMock;
vi.spyOn(dbModuleStub.userRepo, "getFeedback")
  .mockImplementation()
  .mockResolvedValue([]);

dbModuleStub.conversationRepo.getMessage = getMessageMock;
dbModuleStub.conversationRepo.messageRowToUIMessage = messageRowToUIMessageMock;
vi.spyOn(dbModuleStub.conversationRepo, "getActiveUserIds")
  .mockImplementation()
  .mockResolvedValue([]);
vi.spyOn(dbModuleStub.conversationRepo, "getConversations")
  .mockImplementation()
  .mockResolvedValue([]);
vi.spyOn(dbModuleStub.conversationRepo, "getConversationHistory")
  .mockImplementation()
  .mockResolvedValue(null);
vi.spyOn(
  dbModuleStub.conversationRepo,
  "createConversation"
).mockImplementation();
vi.spyOn(dbModuleStub.conversationRepo, "createMessage").mockImplementation();

dbModuleStub.userSchema = dbModuleStub.userSchema ?? {};
dbModuleStub.userSchema.preferences = { $inferSelect: {} };

mock.module("@alfred/agent/preference/loader", () => ({
  invalidatePreferenceCache: invalidatePreferenceCacheMock,
  loadPreferences: vi.fn().mockResolvedValue(new Map()),
  loadPreferencesWithDefaults: vi.fn().mockResolvedValue(new Map()),
  resetPreferenceCache: vi.fn(),
}));

mock.module("@alfred/agent/preference/inference", () => ({
  inferDomainPreferences: vi.fn().mockReturnValue(new Map()),
  inferPreferenceFromCorrection: inferPreferenceFromCorrectionMock,
  inferPreferencesFromFeedback: vi.fn().mockReturnValue(new Map()),
  inferResponsePreferences: vi.fn().mockResolvedValue(new Map()),
}));

let caller: Awaited<
  ReturnType<(typeof import("./utils/trpc"))["createTestCaller"]>
>;

beforeAll(async () => {
  const { createTestCaller } = await import("./utils/trpc");
  caller = await createTestCaller({
    scopes: ["preference.write"],
  });
});

beforeEach(() => {
  getMessageMock.mockReset();
  messageRowToUIMessageMock.mockReset();
  messageRowToUIMessageMock.mockImplementation((row) => ({
    id: row.id,
    parts: [{ type: "text", text: row.id }],
    role: "assistant",
  }));
  inferPreferenceFromCorrectionMock.mockReset();
  inferPreferenceFromCorrectionMock.mockResolvedValue(null);
  invalidatePreferenceCacheMock.mockReset();
  addFeedbackMock.mockReset();
  getPreferencesMock.mockReset();
  setPreferenceMock.mockReset();
  deletePreferenceMock.mockReset();
  resetAgentMocks();
  recordMemoryUpdateMock.mockClear();
  recordMemoryForgetMock.mockClear();
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
        confidence: 1.0,
        key: "theme",
        value: "dark",
      };

      setPreferenceMock.mockResolvedValue(mockPreference);

      const result = await caller.preference.set({
        confidence: 1.0,
        key: "theme",
        value: "dark",
      });

      expect(setPreferenceMock).toHaveBeenCalledWith(
        "test-user",
        "theme",
        "dark",
        1,
        "user"
      );
      expect(invalidatePreferenceCacheMock).toHaveBeenCalledWith("test-user");
      expect(recordMemoryUpdateMock).toHaveBeenCalledWith("preference", "user");
      expect(result).toEqual(mockPreference);
    });

    it("normalizes model preference values to provider:modelId", async () => {
      setPreferenceMock.mockResolvedValue({
        confidence: 1.0,
        key: "domain.ai.model.chat",
        value: "openai:gpt-4o-mini",
      });

      await caller.preference.set({
        confidence: 1.0,
        key: "domain.ai.model.chat",
        value: "openai/gpt-4o-mini",
      });

      expect(setPreferenceMock).toHaveBeenCalledWith(
        "test-user",
        "domain.ai.model.chat",
        "openai:gpt-4o-mini",
        1,
        "user"
      );
      expect(invalidatePreferenceCacheMock).toHaveBeenCalledWith("test-user");
    });

    it("passes projectId through preference writes and invalidation", async () => {
      const projectId = "00000000-0000-4000-8000-000000000000";

      setPreferenceMock.mockResolvedValue({
        confidence: 1.0,
        key: "theme",
        value: "dark",
      });

      await caller.preference.set({
        confidence: 1.0,
        key: "theme",
        projectId,
        value: "dark",
      });

      expect(setPreferenceMock).toHaveBeenCalledWith(
        "test-user",
        "theme",
        "dark",
        1,
        "user",
        projectId
      );
      expect(invalidatePreferenceCacheMock).toHaveBeenCalledWith(
        "test-user",
        projectId
      );
    });

    it("rejects invalid model preference values", async () => {
      await expect(
        caller.preference.set({
          key: "domain.ai.model.chat",
          value: "unknown/model",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      await expect(
        caller.preference.set({
          key: "domain.ai.model.chat",
          value: 123,
        } as any)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
      expect(invalidatePreferenceCacheMock).toHaveBeenCalledWith("test-user");
      expect(result).toEqual({ removed: 1 });
    });

    it("returns zero when preference not found", async () => {
      deletePreferenceMock.mockResolvedValue(0);

      const result = await caller.preference.delete({
        key: "nonexistent",
      });

      expect(result).toEqual({ removed: 0 });
      // No forget metrics should be emitted when nothing removed
      expect(recordMemoryForgetMock).toHaveBeenCalledTimes(0);
      expect(invalidatePreferenceCacheMock).toHaveBeenCalledWith("test-user");
    });
  });

  describe("updateFromFeedback", () => {
    it("updates preferences and records feedback", async () => {
      getMessageMock.mockResolvedValue({
        conversationId: "conv-1",
        id: "msg-1",
      });

      const result = await caller.preference.updateFromFeedback({
        messageId: "msg-1",
        preferenceUpdates: {
          "response.verbosity": "concise",
        },
        rating: 5,
        tags: ["too_verbose"],
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
      expect(recordMemoryUpdateMock).toHaveBeenCalledWith(
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
        correctedMessageId: "corr",
        correctionType: "verbosity",
        originalMessageId: "orig",
      });

      expect(setPreferenceMock).toHaveBeenCalledWith(
        "test-user",
        "response.verbosity",
        "concise",
        0.7,
        "inferred"
      );
      expect(invalidatePreferenceCacheMock).toHaveBeenCalledWith("test-user");
      expect(recordMemoryUpdateMock).toHaveBeenCalledWith(
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
        correctedMessageId: "corr",
        correctionType: "tone",
        originalMessageId: "orig",
      });

      expect(setPreferenceMock).not.toHaveBeenCalled();
      expect(result).toEqual({ inferred: 0 });
    });
  });
});
