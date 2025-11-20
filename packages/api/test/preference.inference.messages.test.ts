import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { MAX_HISTORY_MESSAGES } from "@alfred/type/history";
import type { UIMessage } from "@alfred/type/stream";

mock.module("@alfred/agent", () => ({
  buildTools: () => ({}),
}));

const validateUIMessagesMock = vi.fn(
  async ({ messages }: { messages: UIMessage[] }) => messages
);

mock.module("ai", () => ({
  validateUIMessages: validateUIMessagesMock,
}));

const conversationRepoMock = {
  getConversations: vi.fn(),
  getConversationHistory: vi.fn(),
  getActiveUserIds: vi.fn(),
};

const workflowRepoMock = {
  getToolCalls: vi.fn().mockResolvedValue([]),
};

const userRepoMock = {
  getFeedback: vi.fn().mockResolvedValue([]),
  setPreference: vi.fn().mockResolvedValue(null),
};

mock.module("@alfred/db/repo/conversation", () => conversationRepoMock);
mock.module("@alfred/db/src/repo/conversation", () => conversationRepoMock);
mock.module("@alfred/db/repo/workflow", () => workflowRepoMock);
mock.module("@alfred/db/src/repo/workflow", () => workflowRepoMock);
mock.module("@alfred/db/repo/user", () => userRepoMock);
mock.module("@alfred/db/src/repo/user", () => userRepoMock);

const inferResponsePreferencesMock = vi.fn();
const inferDomainPreferencesMock = vi.fn().mockReturnValue(new Map());
const inferPreferencesFromFeedbackMock = vi.fn().mockReturnValue(new Map());

mock.module("@alfred/agent/preference/inference", () => ({
  inferResponsePreferences: inferResponsePreferencesMock,
  inferDomainPreferences: inferDomainPreferencesMock,
  inferPreferencesFromFeedback: inferPreferencesFromFeedbackMock,
}));

const mergePreferencesMock = vi.fn();
mock.module("@alfred/agent/preference/merger", () => ({
  mergePreferences: mergePreferencesMock,
}));

const invalidatePreferenceCacheMock = vi.fn();
mock.module("@alfred/agent/preference/loader", () => ({
  invalidatePreferenceCache: invalidatePreferenceCacheMock,
}));

const {
  validateConversationMessages,
  runPreferenceInference,
} = await import("../src/scheduler/preference-inference");

describe("validateConversationMessages", () => {
  it("returns validated messages for well-formed history", async () => {
    const messages: UIMessage[] = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
      {
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Hi" }],
      },
    ];

    const logger = { warn: vi.fn() };
    const validated = await validateConversationMessages({
      messages,
      conversationId: "conv-valid",
      userId: "user-1",
      logger,
      tools: {},
    });

    expect(validated).not.toBeNull();
    expect(validated).toHaveLength(2);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("logs and returns null when validation fails", async () => {
    const messages = [
      {
        id: "msg-1",
        role: "malicious" as unknown as UIMessage["role"],
        parts: [],
      },
    ];
    const logger = { warn: vi.fn() };

    validateUIMessagesMock.mockRejectedValueOnce(new Error("invalid"));

    const validated = await validateConversationMessages({
      messages: messages as UIMessage[],
      conversationId: "conv-invalid",
      userId: "user-1",
      logger,
      tools: {},
    });

    expect(validated).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      "preference_inference_invalid_history",
      expect.objectContaining({
        conversationId: "conv-invalid",
        userId: "user-1",
      })
    );
  });
});

describe("runPreferenceInference", () => {
  beforeEach(() => {
    inferResponsePreferencesMock.mockReset();
    inferDomainPreferencesMock.mockReset();
    inferPreferencesFromFeedbackMock.mockReset();
    mergePreferencesMock.mockReset();
    invalidatePreferenceCacheMock.mockReset();
    userRepoMock.setPreference.mockReset();
    conversationRepoMock.getConversations.mockReset();
    conversationRepoMock.getConversationHistory.mockReset();
    workflowRepoMock.getToolCalls.mockResolvedValue([]);
    userRepoMock.getFeedback.mockResolvedValue([]);
  });

  it("clamps conversation history before inference", async () => {
    const historyMessages: UIMessage[] = Array.from(
      { length: MAX_HISTORY_MESSAGES + 10 },
      (_, index) => ({
        id: `msg-${index}`,
        role: index % 2 === 0 ? "user" : "assistant",
        parts: [{ type: "text", text: `message-${index}` }],
      })
    );

    const conversationRow = {
      id: "conv-1",
      userId: "user-123",
      title: null,
      created: new Date(),
      updated: new Date(),
    };

    conversationRepoMock.getConversations.mockResolvedValueOnce([conversationRow]);
    conversationRepoMock.getConversationHistory.mockResolvedValueOnce({
      conversation: conversationRow,
      messages: historyMessages,
    });

    inferResponsePreferencesMock.mockReturnValue(
      new Map([
        [
          "response.tone",
          { value: "curt", source: "learned", confidence: 0.9 },
        ],
      ])
    );
    mergePreferencesMock.mockReturnValue(
      new Map([
        [
          "response.tone",
          { value: "curt", source: "learned", confidence: 0.9 },
        ],
      ])
    );

    await runPreferenceInference("user-123");

    expect(inferResponsePreferencesMock).toHaveBeenCalledTimes(1);
    const conversationsArg = inferResponsePreferencesMock.mock.calls[0][0];
    expect(conversationsArg).toHaveLength(1);
    expect(conversationsArg[0]?.messages).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(conversationsArg[0]?.messages[0]?.id).toBe(
      `msg-${historyMessages.length - MAX_HISTORY_MESSAGES}`
    );
    expect(userRepoMock.setPreference).toHaveBeenCalledTimes(1);
    expect(invalidatePreferenceCacheMock).toHaveBeenCalledWith("user-123");
  });
});
