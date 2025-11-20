import type { UIMessage } from "./stream";

export const MAX_HISTORY_MESSAGES = 60;

export function clampHistoryMessages<T>(
  messages: readonly T[],
  max = MAX_HISTORY_MESSAGES
): T[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  if (messages.length <= max) {
    return messages.slice();
  }

  return messages.slice(messages.length - max);
}

export function clampUiMessages(
  messages: readonly UIMessage[],
  max = MAX_HISTORY_MESSAGES
): UIMessage[] {
  return clampHistoryMessages(messages, max);
}
