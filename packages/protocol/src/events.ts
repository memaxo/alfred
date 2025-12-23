/**
 * Thread event schemas for agent protocol
 *
 * Thread events represent the lifecycle of agent interactions:
 * thread start, turn start/complete/fail, item updates, errors.
 */

import { z } from "zod";
import { threadItemSchema, type ThreadItem } from "./items.js";

export const usageSchema = z
  .object({
    input_tokens: z.number().finite(),
    cached_input_tokens: z.number().finite(),
    output_tokens: z.number().finite(),
  })
  .strict();

export type Usage = z.infer<typeof usageSchema>;

export const threadStartedEventSchema = z
  .object({
    type: z.literal("thread.started"),
    thread_id: z.string().min(1),
  })
  .passthrough();

export type ThreadStartedEvent = z.infer<typeof threadStartedEventSchema>;

export const turnStartedEventSchema = z
  .object({
    type: z.literal("turn.started"),
  })
  .passthrough();

export type TurnStartedEvent = z.infer<typeof turnStartedEventSchema>;

export const turnCompletedEventSchema = z
  .object({
    type: z.literal("turn.completed"),
    usage: usageSchema,
  })
  .passthrough();

export type TurnCompletedEvent = z.infer<typeof turnCompletedEventSchema>;

export const turnFailedEventSchema = z
  .object({
    type: z.literal("turn.failed"),
    error: z
      .object({
        message: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

export type TurnFailedEvent = z.infer<typeof turnFailedEventSchema>;

export const itemStartedEventSchema = z
  .object({
    type: z.literal("item.started"),
    item: threadItemSchema,
  })
  .passthrough();

export type ItemStartedEvent = z.infer<typeof itemStartedEventSchema>;

export const itemUpdatedEventSchema = z
  .object({
    type: z.literal("item.updated"),
    item: threadItemSchema,
  })
  .passthrough();

export type ItemUpdatedEvent = z.infer<typeof itemUpdatedEventSchema>;

export const itemCompletedEventSchema = z
  .object({
    type: z.literal("item.completed"),
    item: threadItemSchema,
  })
  .passthrough();

export type ItemCompletedEvent = z.infer<typeof itemCompletedEventSchema>;

export const errorEventSchema = z
  .object({
    type: z.literal("error"),
    message: z.string().min(1),
  })
  .passthrough();

export type ThreadErrorEvent = z.infer<typeof errorEventSchema>;

export const threadEventSchema = z.union([
  threadStartedEventSchema,
  turnStartedEventSchema,
  turnCompletedEventSchema,
  turnFailedEventSchema,
  itemStartedEventSchema,
  itemUpdatedEventSchema,
  itemCompletedEventSchema,
  errorEventSchema,
]);

export type ThreadEvent = z.infer<typeof threadEventSchema>;

const stringifyForLog = (payload: unknown): string => {
  try {
    const text = JSON.stringify(payload);
    return text.length > 500 ? `${text.slice(0, 500)}...` : text;
  } catch {
    return "[unserializable]";
  }
};

export type ParseOptions = {
  onWarning?: (message: string, context: Record<string, unknown>) => void;
};

/**
 * Parse a thread event from unknown payload
 *
 * Handles both direct events and wrapped { event: ... } payloads
 */
export function parseThreadEvent(
  payload: unknown,
  options?: ParseOptions
): ThreadEvent | null {
  const unwrapped =
    payload && typeof payload === "object" && "event" in payload
      ? (payload as { event?: unknown }).event
      : payload;

  const parsed = threadEventSchema.safeParse(unwrapped);
  if (parsed.success) {
    return parsed.data;
  }

  if (unwrapped !== undefined && options?.onWarning) {
    options.onWarning("invalid_thread_event", {
      issues: parsed.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path,
        code: issue.code,
      })),
      sample: stringifyForLog(unwrapped),
    });
  }

  return null;
}

// Re-export item types for convenience
export type { ThreadItem };
