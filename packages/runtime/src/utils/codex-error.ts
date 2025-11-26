const CODEX_ERROR_MESSAGES: Record<
  string,
  { message: string; needsElevation?: boolean; limitExceeded?: boolean }
> = {
  codex_timeout_requires_elevation: {
    message:
      "Codex timeout above 10 minutes requires biometric elevation. Provide a passkey token or lower the requested timeout.",
    needsElevation: true,
  },
  codex_timeout_exceeds_limit: {
    message:
      "Codex cannot run longer than 30 minutes. Reduce the timeout to stay within the limit.",
    limitExceeded: true,
  },
};

export type CodexRuntimeErrorInfo = {
  code: string | null;
  rawMessage: string;
  userMessage: string;
  needsElevation: boolean;
  limitExceeded: boolean;
};

export function formatCodexRuntimeError(error: unknown): CodexRuntimeErrorInfo {
  const rawMessage =
    error instanceof Error
      ? error.message ?? "codex_unknown_error"
      : typeof error === "string"
        ? error
        : "codex_unknown_error";

  const mapped = CODEX_ERROR_MESSAGES[rawMessage];
  if (mapped) {
    return {
      code: rawMessage,
      rawMessage,
      userMessage: mapped.message,
      needsElevation: Boolean(mapped.needsElevation),
      limitExceeded: Boolean(mapped.limitExceeded),
    };
  }

  return {
    code: null,
    rawMessage,
    userMessage: rawMessage,
    needsElevation: false,
    limitExceeded: false,
  };
}
