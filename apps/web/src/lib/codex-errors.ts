const ERROR_MESSAGES: Record<string, string> = {
  codex_timeout_requires_elevation:
    "Timeouts longer than 10 minutes require biometric elevation. Use a passkey or lower the timeout before retrying.",
  codex_timeout_exceeds_limit:
    "Codex requests cannot run longer than 30 minutes. Reduce the requested timeout and try again.",
  biometric_required:
    "Biometric elevation is required to continue. Complete the passkey challenge and retry.",
};

export function formatCodexErrorMessage(message: string | undefined): string {
  if (!message) {
    return "Codex request failed. Please retry.";
  }
  return ERROR_MESSAGES[message] ?? message;
}
