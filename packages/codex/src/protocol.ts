import { logger } from "@alfred/logger";
import { z } from "zod";

const usageSchema = z
  .object({
    input_tokens: z.number().finite(),
    cached_input_tokens: z.number().finite(),
    output_tokens: z.number().finite(),
  })
  .strict();

export const reasoningItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("reasoning"),
    text: z.string(),
  })
  .passthrough();

export type ReasoningItem = z.infer<typeof reasoningItemSchema>;

export const agentMessageItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("agent_message"),
    text: z.string(),
  })
  .passthrough();

export type AgentMessageItem = z.infer<typeof agentMessageItemSchema>;

const commandExecutionItemSchemaBase = z
  .object({
    id: z.string().min(1),
    type: z.literal("command_execution"),
    command: z.string(),
    aggregated_output: z.union([z.string(), z.array(z.string())]).optional(),
    exit_code: z.number().int().optional(),
    status: z.enum(["in_progress", "completed", "failed"]),
  })
  .passthrough();

const normalizeAggregatedOutput = (
  value: string | string[] | undefined
): string => {
  if (Array.isArray(value)) {
    return value
      .filter((part): part is string => typeof part === "string")
      .join("\n");
  }
  return typeof value === "string" ? value : "";
};

export const commandExecutionItemSchema = commandExecutionItemSchemaBase.transform(
  (item) => ({
    ...item,
    aggregated_output: normalizeAggregatedOutput(item.aggregated_output),
  })
);

export type CommandExecutionItem = z.infer<typeof commandExecutionItemSchema>;

export const fileChangeItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("file_change"),
    status: z.enum(["completed", "failed"]),
    changes: z
      .array(
        z
          .object({
            path: z.string().min(1),
            kind: z.enum(["add", "delete", "update"]),
          })
          .passthrough()
      )
      .min(1),
  })
  .passthrough();

export type FileChangeItem = z.infer<typeof fileChangeItemSchema>;

export const mcpToolCallItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("mcp_tool_call"),
    server: z.string(),
    tool: z.string(),
    arguments: z.unknown(),
    result: z
      .object({
        content: z.array(z.unknown()),
        structured_content: z.unknown(),
      })
      .optional(),
    error: z.object({ message: z.string() }).optional(),
    status: z.enum(["in_progress", "completed", "failed"]),
  })
  .passthrough();

export type McpToolCallItem = z.infer<typeof mcpToolCallItemSchema>;

export const webSearchItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("web_search"),
    query: z.string(),
  })
  .passthrough();

export type WebSearchItem = z.infer<typeof webSearchItemSchema>;

export const todoListItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("todo_list"),
    items: z.array(
      z
        .object({
          text: z.string(),
          completed: z.boolean(),
        })
        .passthrough()
    ),
  })
  .passthrough();

export type TodoListItem = z.infer<typeof todoListItemSchema>;

export const errorItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("error"),
    message: z.string(),
  })
  .passthrough();

export type ErrorItem = z.infer<typeof errorItemSchema>;

export const threadItemSchema = z.union([
  reasoningItemSchema,
  agentMessageItemSchema,
  commandExecutionItemSchema,
  fileChangeItemSchema,
  mcpToolCallItemSchema,
  webSearchItemSchema,
  todoListItemSchema,
  errorItemSchema,
]);

export type ThreadItem = z.infer<typeof threadItemSchema>;

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

export function parseThreadEvent(payload: unknown): ThreadEvent | null {
  const unwrapped =
    payload && typeof payload === "object" && "event" in payload
      ? (payload as { event?: unknown }).event
      : payload;

  const parsed = threadEventSchema.safeParse(unwrapped);
  if (parsed.success) {
    return parsed.data;
  }

  if (unwrapped !== undefined) {
    logger.warn("codex_invalid_thread_event", {
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
