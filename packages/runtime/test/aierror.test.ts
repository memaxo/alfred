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

mock.module("@alfred/agent/utils/rate-limiter", () => ({
  llmConcurrency: {
    acquire: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  },
  llmRateLimit: {
    waitFor: vi.fn().mockResolvedValue(true),
  },
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
}));

mock.module("@alfred/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const require = createRequire(import.meta.url);
const realAi = require("ai") as typeof import("ai");
let nextError: unknown = null;

mock.module("ai", () => ({
  ...realAi,
  validateUIMessages: vi.fn(
    async ({ messages }: { messages: UIMessage[] }) => messages
  ),
  streamText: vi.fn(() => {
    throw nextError;
  }),
}));

const { AISDKAdapter } = await import("../src/adapters/ai");

function namedError(name: string): Error {
  const err = new Error(name);
  err.name = name;
  return err;
}

const messages: UIMessage[] = [
  {
    id: "msg-1",
    role: "user",
    parts: [{ type: "text", text: "hello" }],
  },
];

type Case = { label: string; error: unknown; expect: string };

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
    expect: "ai_api_call_failed",
  },
  {
    label: "AI_DownloadError",
    error: new DownloadError({
      url: "https://example.com/file",
      statusCode: 502,
      statusText: "bad gateway",
    }),
    expect: "ai_download_failed",
  },
  {
    label: "AI_EmptyResponseBodyError",
    error: new EmptyResponseBodyError(),
    expect: "ai_empty_response",
  },
  {
    label: "AI_InvalidArgumentError",
    error: new InvalidArgumentError({
      parameter: "messages",
      value: null,
      message: "invalid",
    }),
    expect: "ai_invalid_argument",
  },
  {
    label: "AI_InvalidDataContent",
    error: namedError("AI_InvalidDataContent"),
    expect: "ai_invalid_data_content",
  },
  {
    label: "AI_InvalidDataContentError",
    error: new InvalidDataContentError({ content: { bad: true } }),
    expect: "ai_invalid_data_content",
  },
  {
    label: "AI_InvalidMessageRoleError",
    error: new InvalidMessageRoleError({ role: "unknown" }),
    expect: "ai_invalid_message_role",
  },
  {
    label: "AI_InvalidPromptError",
    error: new InvalidPromptError({ prompt: null, message: "bad prompt" }),
    expect: "ai_invalid_prompt",
  },
  {
    label: "AI_InvalidResponseDataError",
    error: new InvalidResponseDataError({ data: { bad: true } }),
    expect: "ai_invalid_response_data",
  },
  {
    label: "AI_InvalidToolApprovalError",
    error: namedError("AI_InvalidToolApprovalError"),
    expect: "ai_invalid_tool_approval",
  },
  {
    label: "AI_InvalidToolInputError",
    error: new InvalidToolInputError({
      toolInput: "{",
      toolName: "test",
      cause: new Error("bad json"),
    }),
    expect: "ai_invalid_tool_input",
  },
  {
    label: "AI_JSONParseError",
    error: new JSONParseError({ text: "{", cause: new Error("bad") }),
    expect: "ai_json_parse_failed",
  },
  {
    label: "AI_LoadAPIKeyError",
    error: new LoadAPIKeyError({ message: "missing key" }),
    expect: "ai_api_key_missing",
  },
  {
    label: "AI_LoadSettingError",
    error: new LoadSettingError({ message: "missing setting" }),
    expect: "ai_setting_missing",
  },
  {
    label: "AI_MessageConversionError",
    error: new MessageConversionError({
      originalMessage: { role: "assistant", parts: [] },
      message: "bad message",
    }),
    expect: "ai_message_conversion_failed",
  },
  {
    label: "AI_NoSpeechGeneratedError",
    error: namedError("AI_NoSpeechGeneratedError"),
    expect: "ai_no_speech_generated",
  },
  {
    label: "AI_NoContentGeneratedError",
    error: new NoContentGeneratedError(),
    expect: "ai_no_content_generated",
  },
  {
    label: "AI_NoImageGeneratedError",
    error: new NoImageGeneratedError({ responses: [] }),
    expect: "ai_no_image_generated",
  },
  {
    label: "AI_NoTranscriptGeneratedError",
    error: namedError("AI_NoTranscriptGeneratedError"),
    expect: "ai_no_transcript_generated",
  },
  {
    label: "AI_NoObjectGeneratedError",
    error: new NoObjectGeneratedError({
      response: { timestamp: new Date(), modelId: "test" },
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      finishReason: "stop",
    } as any),
    expect: "ai_no_object_generated",
  },
  {
    label: "AI_NoOutputSpecifiedError",
    error: namedError("AI_NoOutputSpecifiedError"),
    expect: "ai_no_output_specified",
  },
  {
    label: "AI_NoSuchModelError",
    error: new NoSuchModelError({
      modelId: "missing",
      modelType: "languageModel",
    }),
    expect: "ai_no_such_model",
  },
  {
    label: "AI_NoSuchProviderError",
    error: new NoSuchProviderError({
      modelId: "missing",
      modelType: "languageModel",
      providerId: "missing",
      availableProviders: [],
    }),
    expect: "ai_no_such_provider",
  },
  {
    label: "AI_NoSuchToolError",
    error: new NoSuchToolError({ toolName: "missing" }),
    expect: "ai_no_such_tool",
  },
  {
    label: "AI_RetryError",
    error: new RetryError({
      message: "retries exhausted",
      reason: "maxRetriesExceeded",
      errors: [new Error("x")],
    }),
    expect: "ai_retry_exhausted",
  },
  {
    label: "AI_ToolCallNotFoundForApprovalError",
    error: namedError("AI_ToolCallNotFoundForApprovalError"),
    expect: "ai_approval_not_found",
  },
  {
    label: "AI_ToolCallRepairError",
    error: new ToolCallRepairError({
      cause: new Error("repair failed"),
      originalError: new NoSuchToolError({ toolName: "x" }),
    }),
    expect: "ai_tool_call_repair_failed",
  },
  {
    label: "AI_TooManyEmbeddingValuesForCallError",
    error: new TooManyEmbeddingValuesForCallError({
      provider: "test",
      modelId: "m",
      maxEmbeddingsPerCall: 1,
      values: ["a", "b"],
    }),
    expect: "ai_too_many_embedding_values",
  },
  {
    label: "AI_TypeValidationError",
    error: new TypeValidationError({ value: null, cause: new Error("bad") }),
    expect: "ai_type_validation_failed",
  },
  {
    label: "AI_UnsupportedFunctionalityError",
    error: new UnsupportedFunctionalityError({
      functionality: "something",
      message: "unsupported",
    } as any),
    expect: "ai_unsupported",
  },
];

describe("AISDKAdapter classified error event", () => {
  it.each(cases)("$label", async ({ error, expect: expectedCode }) => {
    nextError = error;

    const adapter = new AISDKAdapter();
    const events: Array<{ _: string; message?: string }> = [];
    let thrown: unknown = null;

    try {
      for await (const event of adapter.stream({
        model: "test" as any,
        messages,
      })) {
        events.push(event as any);
      }
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBe(error);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]?._).toBe("error");
    expect(events[0]?.message).toBe(expectedCode);
  });
});

afterAll(() => {
  mock.restore();
});
