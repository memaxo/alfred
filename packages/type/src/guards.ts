import type { ModelMessage, UIMessage } from "./stream";

/**
 * Type guard for AI SDK v6 UIMessage.
 */
export function isUIMessage(value: unknown): value is UIMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const msg = value as Record<string, unknown>;
  const hasValidRole =
    typeof msg.role === "string" &&
    ["system", "user", "assistant"].includes(msg.role);
  const parts = msg.parts;
  const hasValidParts =
    parts === undefined ||
    Array.isArray(parts) ||
    (typeof parts === "object" && parts !== null);
  return typeof msg.id === "string" && hasValidRole && hasValidParts;
}

/**
 * Type guard for AI SDK v6 ModelMessage.
 */
export function isModelMessage(value: unknown): value is ModelMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const msg = value as Record<string, unknown>;
  const role = msg.role;
  if (
    typeof role !== "string" ||
    !["system", "user", "assistant", "tool"].includes(role)
  ) {
    return false;
  }
  const content = msg.content;
  return (
    typeof content === "string" ||
    Array.isArray(content) ||
    content === undefined
  );
}

export function isUIMessageArray(value: unknown): value is UIMessage[] {
  return Array.isArray(value) && value.every(isUIMessage);
}

export function isModelMessageArray(value: unknown): value is ModelMessage[] {
  return Array.isArray(value) && value.every(isModelMessage);
}
