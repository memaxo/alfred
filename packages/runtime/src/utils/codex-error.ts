const CODEX_ERROR_MESSAGES: Record<string, string> = {
  codex_timeout_requires_elevation:
    "Codex timeout above 10 minutes requires biometric elevation. Provide a passkey token or lower the requested timeout.",
  codex_timeout_exceeds_limit:
    "Codex cannot run longer than 30 minutes. Reduce the timeout to stay within the limit.",
};

export type CodexRuntimeErrorInfo = {
  code: string | null;
  rawMessage: string;
  userMessage: string;
};

export function formatCodexRuntimeError(error: unknown): CodexRuntimeErrorInfo {
  const rawMessage =
    error instanceof Error
      ? error.message ?? "codex_unknown_error"
      : typeof error === "string"
        ? error
        : "codex_unknown_error";

  if (CODEX_ERROR_MESSAGES[rawMessage]) {
    return {
      code: rawMessage,
      rawMessage,
      userMessage: CODEX_ERROR_MESSAGES[rawMessage],
    };
  }

  return {
    code: null,
    rawMessage,
    userMessage: rawMessage,
  };
}
