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
import { describe, expect, it } from "bun:test";

import { classifyAiSdkError } from "../src/aierror";

type Case = {
  label: string;
  error: unknown;
  expect: {
    kind: string;
    retryable: boolean;
    httpStatus: number;
    trpcCode: string;
    safeCode: string;
  };
};

function namedError(name: string): Error {
  const err = new Error(name);
  err.name = name;
  return err;
}

const cases: Case[] = [
  {
    label: "AI_APICallError",
    error: new APICallError({
      message: "upstream failed",
      url: "https://example.com/v1/chat",
      requestBodyValues: { prompt: "x" },
      statusCode: 503,
      responseHeaders: {},
      responseBody: "oops",
      isRetryable: true,
    }),
    expect: {
      kind: "transient",
      retryable: true,
      httpStatus: 503,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_api_call_failed",
    },
  },
  {
    label: "AI_DownloadError",
    error: new DownloadError({
      url: "https://example.com/file",
      statusCode: 502,
      statusText: "bad gateway",
    }),
    expect: {
      kind: "transient",
      retryable: true,
      httpStatus: 503,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_download_failed",
    },
  },
  {
    label: "AI_EmptyResponseBodyError",
    error: new EmptyResponseBodyError(),
    expect: {
      kind: "transient",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_empty_response",
    },
  },
  {
    label: "AI_InvalidArgumentError",
    error: new InvalidArgumentError({
      parameter: "messages",
      value: null,
      message: "invalid",
    }),
    expect: {
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_invalid_argument",
    },
  },
  {
    label: "AI_InvalidDataContent",
    error: namedError("AI_InvalidDataContent"),
    expect: {
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_invalid_data_content",
    },
  },
  {
    label: "AI_InvalidDataContentError",
    error: new InvalidDataContentError({ content: { bad: true } }),
    expect: {
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_invalid_data_content",
    },
  },
  {
    label: "AI_InvalidMessageRoleError",
    error: new InvalidMessageRoleError({ role: "unknown" }),
    expect: {
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_invalid_message_role",
    },
  },
  {
    label: "AI_InvalidPromptError",
    error: new InvalidPromptError({ prompt: null, message: "bad prompt" }),
    expect: {
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_invalid_prompt",
    },
  },
  {
    label: "AI_InvalidResponseDataError",
    error: new InvalidResponseDataError({ data: { bad: true } }),
    expect: {
      kind: "transient",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_invalid_response_data",
    },
  },
  {
    label: "AI_InvalidToolApprovalError",
    error: namedError("AI_InvalidToolApprovalError"),
    expect: {
      kind: "approval",
      retryable: false,
      httpStatus: 409,
      trpcCode: "CONFLICT",
      safeCode: "ai_invalid_tool_approval",
    },
  },
  {
    label: "AI_InvalidToolInputError",
    error: new InvalidToolInputError({
      toolInput: "{",
      toolName: "test",
      cause: new Error("bad json"),
    }),
    expect: {
      kind: "tool",
      retryable: false,
      httpStatus: 422,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_invalid_tool_input",
    },
  },
  {
    label: "AI_JSONParseError",
    error: new JSONParseError({ text: "{", cause: new Error("bad") }),
    expect: {
      kind: "transient",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_json_parse_failed",
    },
  },
  {
    label: "AI_LoadAPIKeyError",
    error: new LoadAPIKeyError({ message: "missing key" }),
    expect: {
      kind: "misconfig",
      retryable: false,
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_api_key_missing",
    },
  },
  {
    label: "AI_LoadSettingError",
    error: new LoadSettingError({ message: "missing setting" }),
    expect: {
      kind: "misconfig",
      retryable: false,
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_setting_missing",
    },
  },
  {
    label: "AI_MessageConversionError",
    error: new MessageConversionError({
      originalMessage: { role: "assistant", parts: [] },
      message: "bad message",
    }),
    expect: {
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_message_conversion_failed",
    },
  },
  {
    label: "AI_NoSpeechGeneratedError",
    error: namedError("AI_NoSpeechGeneratedError"),
    expect: {
      kind: "output",
      retryable: false,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_no_speech_generated",
    },
  },
  {
    label: "AI_NoContentGeneratedError",
    error: new NoContentGeneratedError(),
    expect: {
      kind: "output",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_no_content_generated",
    },
  },
  {
    label: "AI_NoImageGeneratedError",
    error: new NoImageGeneratedError({ responses: [] }),
    expect: {
      kind: "output",
      retryable: false,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_no_image_generated",
    },
  },
  {
    label: "AI_NoTranscriptGeneratedError",
    error: namedError("AI_NoTranscriptGeneratedError"),
    expect: {
      kind: "output",
      retryable: false,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_no_transcript_generated",
    },
  },
  {
    label: "AI_NoObjectGeneratedError",
    error: new NoObjectGeneratedError({
      response: {
        timestamp: new Date(),
        modelId: "test",
      },
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
      },
      finishReason: "stop",
    } as any),
    expect: {
      kind: "output",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_no_object_generated",
    },
  },
  {
    label: "AI_NoOutputSpecifiedError",
    error: namedError("AI_NoOutputSpecifiedError"),
    expect: {
      kind: "misconfig",
      retryable: false,
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_no_output_specified",
    },
  },
  {
    label: "AI_NoSuchModelError",
    error: new NoSuchModelError({
      modelId: "missing",
      modelType: "languageModel",
    }),
    expect: {
      kind: "misconfig",
      retryable: false,
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_no_such_model",
    },
  },
  {
    label: "AI_NoSuchProviderError",
    error: new NoSuchProviderError({
      modelId: "missing",
      modelType: "languageModel",
      providerId: "missing",
      availableProviders: [],
    }),
    expect: {
      kind: "misconfig",
      retryable: false,
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_no_such_provider",
    },
  },
  {
    label: "AI_NoSuchToolError",
    error: new NoSuchToolError({ toolName: "missing" }),
    expect: {
      kind: "misconfig",
      retryable: false,
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_no_such_tool",
    },
  },
  {
    label: "AI_RetryError",
    error: new RetryError({
      message: "retries exhausted",
      reason: "maxRetriesExceeded",
      errors: [new Error("x")],
    }),
    expect: {
      kind: "transient",
      retryable: false,
      httpStatus: 503,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_retry_exhausted",
    },
  },
  {
    label: "AI_ToolCallNotFoundForApprovalError",
    error: namedError("AI_ToolCallNotFoundForApprovalError"),
    expect: {
      kind: "approval",
      retryable: false,
      httpStatus: 409,
      trpcCode: "CONFLICT",
      safeCode: "ai_approval_not_found",
    },
  },
  {
    label: "AI_ToolCallRepairError",
    error: new ToolCallRepairError({
      cause: new Error("repair failed"),
      originalError: new NoSuchToolError({ toolName: "x" }),
    }),
    expect: {
      kind: "tool",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_tool_call_repair_failed",
    },
  },
  {
    label: "AI_TooManyEmbeddingValuesForCallError",
    error: new TooManyEmbeddingValuesForCallError({
      provider: "test",
      modelId: "m",
      maxEmbeddingsPerCall: 1,
      values: ["a", "b"],
    }),
    expect: {
      kind: "client",
      retryable: false,
      httpStatus: 413,
      trpcCode: "PAYLOAD_TOO_LARGE",
      safeCode: "ai_too_many_embedding_values",
    },
  },
  {
    label: "AI_TypeValidationError",
    error: new TypeValidationError({ value: null, cause: new Error("bad") }),
    expect: {
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_type_validation_failed",
    },
  },
  {
    label: "AI_UnsupportedFunctionalityError",
    error: new UnsupportedFunctionalityError({
      functionality: "something",
      message: "unsupported",
    } as any),
    expect: {
      kind: "misconfig",
      retryable: false,
      httpStatus: 501,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_unsupported",
    },
  },
];

describe("classifyAiSdkError", () => {
  it.each(cases)("$label", ({ error, expect: expected }) => {
    const classified = classifyAiSdkError(error);
    expect(classified.kind).toBe(expected.kind);
    expect(classified.retryable).toBe(expected.retryable);
    expect(classified.httpStatus).toBe(expected.httpStatus);
    expect(classified.trpcCode).toBe(expected.trpcCode);
    expect(classified.safeCode).toBe(expected.safeCode);
  });
});
