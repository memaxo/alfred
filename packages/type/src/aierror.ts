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
  NoOutputGeneratedError,
  NoSuchModelError,
  NoSuchProviderError,
  NoSuchToolError,
  RetryError,
  ToolCallRepairError,
  TooManyEmbeddingValuesForCallError,
  TypeValidationError,
  UnsupportedFunctionalityError,
} from "ai";

export type AiSdkErrorKind =
  | "client"
  | "transient"
  | "misconfig"
  | "approval"
  | "tool"
  | "output"
  | "unknown";

export type AiSdkErrorClassification = {
  name: string | null;
  kind: AiSdkErrorKind;
  retryable: boolean;
  httpStatus: number;
  trpcCode:
    | "BAD_REQUEST"
    | "CONFLICT"
    | "INTERNAL_SERVER_ERROR"
    | "PAYLOAD_TOO_LARGE"
    | "PRECONDITION_FAILED"
    | "SERVICE_UNAVAILABLE"
    | "TIMEOUT";
  safeCode: string;
  safeMessage: string;
  log: Record<string, unknown>;
};

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function errName(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" ? name : null;
}

function errMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return null;
}

export function isAbortError(error: unknown): boolean {
  const name = errName(error);
  if (name === "AbortError") {
    return true;
  }
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === "ABORT_ERR";
}

function classifyByNameFallback(name: string): AiSdkErrorClassification {
  const log = { name };

  switch (name) {
    case "AI_InvalidToolApprovalError":
      return {
        name,
        kind: "approval",
        retryable: false,
        httpStatus: 409,
        trpcCode: "CONFLICT",
        safeCode: "ai_invalid_tool_approval",
        safeMessage: "Tool approval state is invalid.",
        log,
      };
    case "AI_ToolCallNotFoundForApprovalError":
      return {
        name,
        kind: "approval",
        retryable: false,
        httpStatus: 409,
        trpcCode: "CONFLICT",
        safeCode: "ai_approval_not_found",
        safeMessage: "Tool approval request was not found.",
        log,
      };
    case "AI_NoTranscriptGeneratedError":
      return {
        name,
        kind: "output",
        retryable: false,
        httpStatus: 502,
        trpcCode: "SERVICE_UNAVAILABLE",
        safeCode: "ai_no_transcript_generated",
        safeMessage: "No transcript was generated.",
        log,
      };
    case "AI_InvalidDataContent":
      return {
        name,
        kind: "client",
        retryable: false,
        httpStatus: 400,
        trpcCode: "BAD_REQUEST",
        safeCode: "ai_invalid_data_content",
        safeMessage: "Invalid data content.",
        log,
      };
    case "AI_InvalidDataContentError":
      return {
        name,
        kind: "client",
        retryable: false,
        httpStatus: 400,
        trpcCode: "BAD_REQUEST",
        safeCode: "ai_invalid_data_content",
        safeMessage: "Invalid data content.",
        log,
      };
    case "AI_NoOutputSpecifiedError":
      return {
        name,
        kind: "misconfig",
        retryable: false,
        httpStatus: 500,
        trpcCode: "INTERNAL_SERVER_ERROR",
        safeCode: "ai_no_output_specified",
        safeMessage: "AI output configuration is missing.",
        log,
      };
    default:
      return {
        name,
        kind: "unknown",
        retryable: false,
        httpStatus: 500,
        trpcCode: "INTERNAL_SERVER_ERROR",
        safeCode: "ai_unknown_error",
        safeMessage: "AI request failed.",
        log,
      };
  }
}

export function classifyAiSdkError(error: unknown): AiSdkErrorClassification {
  const name = errName(error);
  const message = errMessage(error);

  if (isAbortError(error)) {
    return {
      name,
      kind: "unknown",
      retryable: false,
      httpStatus: 499,
      trpcCode: "TIMEOUT",
      safeCode: "request_aborted",
      safeMessage: "Request was aborted.",
      log: { name, message },
    };
  }

  if (APICallError.isInstance(error)) {
    const url = safeUrl(error.url);
    const statusCode = error.statusCode ?? null;
    const retryable = Boolean(error.isRetryable);
    const kind: AiSdkErrorKind =
      statusCode === 401 || statusCode === 403 ? "misconfig" : "transient";
    return {
      name: error.name,
      kind,
      retryable,
      httpStatus: retryable ? 503 : 502,
      trpcCode: retryable ? "SERVICE_UNAVAILABLE" : "INTERNAL_SERVER_ERROR",
      safeCode: "ai_api_call_failed",
      safeMessage: "Upstream AI provider request failed.",
      log: {
        name: error.name,
        message,
        url,
        statusCode,
        isRetryable: retryable,
      },
    };
  }

  if (DownloadError.isInstance(error)) {
    return {
      name: error.name,
      kind: "transient",
      retryable: true,
      httpStatus: 503,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_download_failed",
      safeMessage: "Upstream download failed.",
      log: {
        name: error.name,
        message,
        url: safeUrl(error.url),
        statusCode: error.statusCode ?? null,
      },
    };
  }

  if (EmptyResponseBodyError.isInstance(error)) {
    return {
      name: error.name,
      kind: "transient",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_empty_response",
      safeMessage: "Upstream AI provider returned an empty response.",
      log: { name: error.name, message },
    };
  }

  if (JSONParseError.isInstance(error)) {
    return {
      name: error.name,
      kind: "transient",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_json_parse_failed",
      safeMessage: "Upstream AI provider returned invalid JSON.",
      log: { name: error.name, message },
    };
  }

  if (InvalidArgumentError.isInstance(error)) {
    return {
      name: error.name,
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_invalid_argument",
      safeMessage: "Invalid AI request argument.",
      log: { name: error.name, message },
    };
  }

  if (InvalidDataContentError.isInstance(error)) {
    return {
      name: error.name,
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_invalid_data_content",
      safeMessage: "Invalid data content.",
      log: { name: error.name, message },
    };
  }

  if (InvalidMessageRoleError.isInstance(error)) {
    return {
      name: error.name,
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_invalid_message_role",
      safeMessage: "Invalid message role.",
      log: { name: error.name, message },
    };
  }

  if (InvalidPromptError.isInstance(error)) {
    return {
      name: error.name,
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_invalid_prompt",
      safeMessage: "Invalid prompt.",
      log: { name: error.name, message },
    };
  }

  if (InvalidResponseDataError.isInstance(error)) {
    return {
      name: error.name,
      kind: "transient",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_invalid_response_data",
      safeMessage: "Upstream AI provider returned invalid data.",
      log: { name: error.name, message },
    };
  }

  if (InvalidToolInputError.isInstance(error)) {
    return {
      name: error.name,
      kind: "tool",
      retryable: false,
      httpStatus: 422,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_invalid_tool_input",
      safeMessage: "Tool input did not match the expected schema.",
      log: { name: error.name, message },
    };
  }

  if (LoadAPIKeyError.isInstance(error)) {
    return {
      name: error.name,
      kind: "misconfig",
      retryable: false,
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_api_key_missing",
      safeMessage: "AI provider API key is missing.",
      log: { name: error.name, message },
    };
  }

  if (LoadSettingError.isInstance(error)) {
    return {
      name: error.name,
      kind: "misconfig",
      retryable: false,
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_setting_missing",
      safeMessage: "AI provider setting is missing.",
      log: { name: error.name, message },
    };
  }

  if (MessageConversionError.isInstance(error)) {
    return {
      name: error.name,
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_message_conversion_failed",
      safeMessage: "Invalid message format.",
      log: { name: error.name, message },
    };
  }

  if (NoContentGeneratedError.isInstance(error)) {
    return {
      name: error.name,
      kind: "output",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_no_content_generated",
      safeMessage: "No content was generated.",
      log: { name: error.name, message },
    };
  }

  if (NoObjectGeneratedError.isInstance(error)) {
    return {
      name: error.name,
      kind: "output",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_no_object_generated",
      safeMessage: "No structured output was generated.",
      log: { name: error.name, message },
    };
  }

  if (NoOutputGeneratedError.isInstance(error)) {
    return {
      name: error.name,
      kind: "output",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_no_output_generated",
      safeMessage: "No output was generated.",
      log: { name: error.name, message },
    };
  }

  if (name === "AI_NoSpeechGeneratedError") {
    return {
      name,
      kind: "output",
      retryable: false,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_no_speech_generated",
      safeMessage: "No speech was generated.",
      log: { name, message },
    };
  }

  if (NoImageGeneratedError.isInstance(error)) {
    return {
      name: error.name,
      kind: "output",
      retryable: false,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_no_image_generated",
      safeMessage: "No image was generated.",
      log: { name: error.name, message },
    };
  }

  if (NoSuchProviderError.isInstance(error)) {
    return {
      name: error.name,
      kind: "misconfig",
      retryable: false,
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_no_such_provider",
      safeMessage: "AI provider is not configured.",
      log: { name: error.name, message },
    };
  }

  if (NoSuchModelError.isInstance(error)) {
    return {
      name: error.name,
      kind: "misconfig",
      retryable: false,
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_no_such_model",
      safeMessage: "AI model is not configured.",
      log: { name: error.name, message },
    };
  }

  if (NoSuchToolError.isInstance(error)) {
    return {
      name: error.name,
      kind: "misconfig",
      retryable: false,
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_no_such_tool",
      safeMessage: "Tool is not available.",
      log: { name: error.name, message },
    };
  }

  if (RetryError.isInstance(error)) {
    return {
      name: error.name,
      kind: "transient",
      retryable: false,
      httpStatus: 503,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_retry_exhausted",
      safeMessage: "AI provider retries were exhausted.",
      log: { name: error.name, message, reason: error.reason },
    };
  }

  if (ToolCallRepairError.isInstance(error)) {
    return {
      name: error.name,
      kind: "tool",
      retryable: true,
      httpStatus: 502,
      trpcCode: "SERVICE_UNAVAILABLE",
      safeCode: "ai_tool_call_repair_failed",
      safeMessage: "Tool call repair failed.",
      log: { name: error.name, message },
    };
  }

  if (TooManyEmbeddingValuesForCallError.isInstance(error)) {
    return {
      name: error.name,
      kind: "client",
      retryable: false,
      httpStatus: 413,
      trpcCode: "PAYLOAD_TOO_LARGE",
      safeCode: "ai_too_many_embedding_values",
      safeMessage: "Embedding request is too large.",
      log: { name: error.name, message },
    };
  }

  if (TypeValidationError.isInstance(error)) {
    return {
      name: error.name,
      kind: "client",
      retryable: false,
      httpStatus: 400,
      trpcCode: "BAD_REQUEST",
      safeCode: "ai_type_validation_failed",
      safeMessage: "AI response failed schema validation.",
      log: { name: error.name, message },
    };
  }

  if (UnsupportedFunctionalityError.isInstance(error)) {
    return {
      name: error.name,
      kind: "misconfig",
      retryable: false,
      httpStatus: 501,
      trpcCode: "INTERNAL_SERVER_ERROR",
      safeCode: "ai_unsupported",
      safeMessage: "Requested AI functionality is not supported.",
      log: { name: error.name, message },
    };
  }

  if (typeof name === "string" && name.startsWith("AI_")) {
    return classifyByNameFallback(name);
  }

  return {
    name,
    kind: "unknown",
    retryable: false,
    httpStatus: 500,
    trpcCode: "INTERNAL_SERVER_ERROR",
    safeCode: "ai_unknown_error",
    safeMessage: "AI request failed.",
    log: { name, message },
  };
}
