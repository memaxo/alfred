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
    return [...messages];
  }

  return messages.slice(messages.length - max);
}

export function clampUiMessages(
  messages: readonly UIMessage[],
  max = MAX_HISTORY_MESSAGES
): UIMessage[] {
  return clampHistoryMessages(messages, max);
}

function findLatestToolChainBounds(
  messages: readonly UIMessage[]
): { start: number; end: number } | null {
  let toolCallIndex = -1;
  let toolResultIndex = -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message?.parts) {
      continue;
    }

    if (
      toolResultIndex === -1 &&
      message.parts.some((part) => part.type === "tool-result")
    ) {
      toolResultIndex = index;
    }

    if (
      toolCallIndex === -1 &&
      message.parts.some((part) => part.type === "tool-call")
    ) {
      toolCallIndex = index;
    }

    if (toolCallIndex !== -1 && toolResultIndex !== -1) {
      break;
    }
  }

  if (toolCallIndex === -1 && toolResultIndex === -1) {
    return null;
  }

  const start =
    toolCallIndex === -1
      ? toolResultIndex
      : toolResultIndex === -1
        ? toolCallIndex
        : Math.min(toolCallIndex, toolResultIndex);
  const end = Math.max(toolCallIndex, toolResultIndex);

  return { start, end };
}

export function limitUiMessages(
  messages: readonly UIMessage[],
  max = MAX_HISTORY_MESSAGES
): UIMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  if (messages.length <= max) {
    return [...messages];
  }

  const chainBounds = findLatestToolChainBounds(messages);
  const windowStart = messages.length - max;

  if (!chainBounds || chainBounds.end >= windowStart) {
    return messages.slice(windowStart);
  }

  const chainMessages = messages.slice(chainBounds.start, chainBounds.end + 1);
  const remainingSlots = Math.max(max - chainMessages.length, 0);

  if (remainingSlots === 0) {
    return chainMessages;
  }

  const tailStart = Math.max(
    chainBounds.end + 1,
    messages.length - remainingSlots
  );
  const tailMessages =
    tailStart < messages.length ? messages.slice(tailStart) : [];
  return [...chainMessages, ...tailMessages];
}
