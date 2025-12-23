/**
 * Thread item schemas for agent protocol
 *
 * Thread items represent discrete units of agent output:
 * reasoning, messages, command executions, file changes, etc.
 */

import { z } from "zod";

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

function normalizeAggregatedOutput(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value
      .filter((part): part is string => typeof part === "string")
      .join("\n");
  }
  return typeof value === "string" ? value : "";
}

export const commandExecutionItemSchema =
  commandExecutionItemSchemaBase.transform((item) => ({
    ...item,
    aggregated_output: normalizeAggregatedOutput(item.aggregated_output),
  }));

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

/**
 * Parse a thread item from unknown payload
 */
export function parseThreadItem(payload: unknown): ThreadItem | null {
  const parsed = threadItemSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
