import type { UIMessage } from "@alfred/type/stream";

import {
  APICallError,
  DownloadError,
  EmptyResponseBodyError,
  InvalidArgumentError,
  InvalidDataContentError,
  InvalidMessageRoleError,
  InvalidPromptError,
  InvalidResponseDataError,
  InvalidToolInputError,
  JSONParseError,
  LoadAPIKeyError,
  LoadSettingError,
  MessageConversionError,
  NoContentGeneratedError,
  NoImageGeneratedError,
  NoObjectGeneratedError,
  NoSuchModelError,
  NoSuchProviderError,
  NoSuchToolError,
  RetryError,
  ToolCallRepairError,
  TooManyEmbeddingValuesForCallError,
  TypeValidationError,
  UnsupportedFunctionalityError,
} from "ai";
import { afterAll, describe, expect, it, mock, vi } from "bun:test";
import { createRequire } from "node:module";

mock.module("@alfred/api/utils/sse-connections", () => ({
  createConnection: () => ({ allowed: true, connectionId: "conn-1" }),
  getConnectionCount: () => 0,
  removeConnection: vi.fn(),
  updateConnectionActivity: vi.fn(),
}));

mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({ user: { id: "user-1" } }),
    },
  },
}));

mock.module("@alfred/agent/preference/prompt", () => ({
  buildPreferenceSystemPrompt: vi.fn().mockResolvedValue(""),
}));

mock.module("@alfred/agent/selector", () => ({
  getModelForRole: vi.fn().mockResolvedValue({
    model: { provider: "test", name: "mock-model" },
    modelKey: "openai/mock-model",
  }),
}));

mock.module("@alfred/agent/mcp", () => ({
  loadMcpTools: vi.fn().mockResolvedValue({
    tools: {},
    close: async () => {},
  }),
}));

mock.module("@alfred/db/repo/conversation", () => ({
  createConversation: vi.fn().mockResolvedValue({ id: "conv-1" }),
  createMessage: vi.fn().mockResolvedValue(null),
  deleteMessagesAfter: vi.fn().mockResolvedValue(),
}));

mock.module("@alfred/history", () => ({
  buildHistoryContext: vi.fn(({ messages }) =>
    Promise.resolve({
      uiMessages: messages,
      modelMessages: messages,
      droppedMessages: 0,
      keptTokens: 1,
      droppedTokens: 0,
      selection: {
        dropped: [],
        tierByMessage: new WeakMap(),
      },
    })
  ),
  getHistoryBudgetDefaults: () => ({}),
  historyContextSelectionDurationSeconds: {
    startTimer: vi.fn(() => vi.fn()),
  },
  historyContextTierDropsTotal: { inc: vi.fn() },
  historyContextTokensTotal: { inc: vi.fn() },
}));

const loggerErrorMock = vi.fn();
mock.module("@alfred/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerErrorMock,
    debug: vi.fn(),
  },
}));

const require = createRequire(import.meta.url);
const realAi = require("ai") as typeof import("ai");
let nextError: unknown = null;

const streamTextMock = vi.fn(() => {
  throw nextError;
});

mock.module("ai", () => ({
  ...realAi,
  streamText: streamTextMock,
}));

const { handleStreamRequest } = await import("../stream-handler");

function namedError(name: string): Error {
  const err = new Error(name);
  err.name = name;
  return err;
}

interface Case {
  label: string;
  error: unknown;
  expect: { status: number; error: string };
}

const cases: Case[] = [
  {
    label: "AI_APICallError",
    error: new APICallError({
      message: "upstream failed",
      url: "https://example.com/v1/chat",
      requestBodyValues: {},
      statusCode: 503,
      isRetryable: true,
    }),
    expect: { status: 503, error: "ai_api_call_failed" },
  },
  {
    label: "AI_DownloadError",
    error: new DownloadError({
      url: "https://example.com/file",
      statusCode: 502,
      statusText: "bad gateway",
    }),
    expect: { status: 503, error: "ai_download_failed" },
  },
  {
    label: "AI_EmptyResponseBodyError",
    error: new EmptyResponseBodyError(),
    expect: { status: 502, error: "ai_empty_response" },
  },
  {
    label: "AI_InvalidArgumentError",
    error: new InvalidArgumentError({
      parameter: "messages",
      value: null,
      message: "invalid",
    }),
    expect: { status: 400, error: "ai_invalid_argument" },
  },
  {
    label: "AI_InvalidDataContent",
    error: namedError("AI_InvalidDataContent"),
    expect: { status: 400, error: "ai_invalid_data_content" },
  },
  {
    label: "AI_InvalidDataContentError",
    error: new InvalidDataContentError({ content: { bad: true } }),
    expect: { status: 400, error: "ai_invalid_data_content" },
  },
  {
    label: "AI_InvalidMessageRoleError",
    error: new InvalidMessageRoleError({ role: "unknown" }),
    expect: { status: 400, error: "ai_invalid_message_role" },
  },
  {
    label: "AI_InvalidPromptError",
    error: new InvalidPromptError({ prompt: null, message: "bad prompt" }),
    expect: { status: 400, error: "ai_invalid_prompt" },
  },
  {
    label: "AI_InvalidResponseDataError",
    error: new InvalidResponseDataError({ data: { bad: true } }),
    expect: { status: 502, error: "ai_invalid_response_data" },
  },
  {
    label: "AI_InvalidToolApprovalError",
    error: namedError("AI_InvalidToolApprovalError"),
    expect: { status: 409, error: "ai_invalid_tool_approval" },
  },
  {
    label: "AI_InvalidToolInputError",
    error: new InvalidToolInputError({
      toolInput: "{",
      toolName: "test",
      cause: new Error("bad json"),
    }),
    expect: { status: 422, error: "ai_invalid_tool_input" },
  },
  {
    label: "AI_JSONParseError",
    error: new JSONParseError({ text: "{", cause: new Error("bad") }),
    expect: { status: 502, error: "ai_json_parse_failed" },
  },
  {
    label: "AI_LoadAPIKeyError",
    error: new LoadAPIKeyError({ message: "missing key" }),
    expect: { status: 500, error: "ai_api_key_missing" },
  },
  {
    label: "AI_LoadSettingError",
    error: new LoadSettingError({ message: "missing setting" }),
    expect: { status: 500, error: "ai_setting_missing" },
  },
  {
    label: "AI_MessageConversionError",
    error: new MessageConversionError({
      originalMessage: { role: "assistant", parts: [] },
      message: "bad message",
    }),
    expect: { status: 400, error: "ai_message_conversion_failed" },
  },
  {
    label: "AI_NoSpeechGeneratedError",
    error: namedError("AI_NoSpeechGeneratedError"),
    expect: { status: 502, error: "ai_no_speech_generated" },
  },
  {
    label: "AI_NoContentGeneratedError",
    error: new NoContentGeneratedError(),
    expect: { status: 502, error: "ai_no_content_generated" },
  },
  {
    label: "AI_NoImageGeneratedError",
    error: new NoImageGeneratedError({ responses: [] }),
    expect: { status: 502, error: "ai_no_image_generated" },
  },
  {
    label: "AI_NoTranscriptGeneratedError",
    error: namedError("AI_NoTranscriptGeneratedError"),
    expect: { status: 502, error: "ai_no_transcript_generated" },
  },
  {
    label: "AI_NoObjectGeneratedError",
    error: new NoObjectGeneratedError({
      response: { timestamp: new Date(), modelId: "test" },
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      finishReason: "stop",
    } as any),
    expect: { status: 502, error: "ai_no_object_generated" },
  },
  {
    label: "AI_NoOutputSpecifiedError",
    error: namedError("AI_NoOutputSpecifiedError"),
    expect: { status: 500, error: "ai_no_output_specified" },
  },
  {
    label: "AI_NoSuchModelError",
    error: new NoSuchModelError({
      modelId: "missing",
      modelType: "languageModel",
    }),
    expect: { status: 500, error: "ai_no_such_model" },
  },
  {
    label: "AI_NoSuchProviderError",
    error: new NoSuchProviderError({
      modelId: "missing",
      modelType: "languageModel",
      providerId: "missing",
      availableProviders: [],
    }),
    expect: { status: 500, error: "ai_no_such_provider" },
  },
  {
    label: "AI_NoSuchToolError",
    error: new NoSuchToolError({ toolName: "missing" }),
    expect: { status: 500, error: "ai_no_such_tool" },
  },
  {
    label: "AI_RetryError",
    error: new RetryError({
      message: "retries exhausted",
      reason: "maxRetriesExceeded",
      errors: [new Error("x")],
    }),
    expect: { status: 503, error: "ai_retry_exhausted" },
  },
  {
    label: "AI_ToolCallNotFoundForApprovalError",
    error: namedError("AI_ToolCallNotFoundForApprovalError"),
    expect: { status: 409, error: "ai_approval_not_found" },
  },
  {
    label: "AI_ToolCallRepairError",
    error: new ToolCallRepairError({
      cause: new Error("repair failed"),
      originalError: new NoSuchToolError({ toolName: "x" }),
    }),
    expect: { status: 502, error: "ai_tool_call_repair_failed" },
  },
  {
    label: "AI_TooManyEmbeddingValuesForCallError",
    error: new TooManyEmbeddingValuesForCallError({
      provider: "test",
      modelId: "m",
      maxEmbeddingsPerCall: 1,
      values: ["a", "b"],
    }),
    expect: { status: 413, error: "ai_too_many_embedding_values" },
  },
  {
    label: "AI_TypeValidationError",
    error: new TypeValidationError({ value: null, cause: new Error("bad") }),
    expect: { status: 400, error: "ai_type_validation_failed" },
  },
  {
    label: "AI_UnsupportedFunctionalityError",
    error: new UnsupportedFunctionalityError({
      functionality: "something",
      message: "unsupported",
    } as any),
    expect: { status: 501, error: "ai_unsupported" },
  },
];

describe("handleStreamRequest AI SDK error mapping", () => {
  it.each(cases)("$label", async ({ error, expect: expected }) => {
    nextError = error;
    streamTextMock.mockClear();
    loggerErrorMock.mockClear();

    const request = new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
          },
        ] satisfies UIMessage[],
      }),
    });

    const response = await handleStreamRequest(
      request,
      () => ({ model: { provider: "test", name: "mock-model" } }) as any,
      "assistant"
    );

    expect(response.status).toBe(expected.status);
    const body = (await response.json()) as { error?: unknown };
    expect(body.error).toBe(expected.error);
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});

afterAll(() => {
  mock.restore();
});
