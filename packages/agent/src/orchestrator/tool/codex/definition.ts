import type {
  AgentMessageItem,
  CommandExecutionItem,
  ErrorItem,
  FileChangeItem,
  ItemCompletedEvent,
  ItemStartedEvent,
  ItemUpdatedEvent,
  McpToolCallItem,
  ReasoningItem,
  ThreadErrorEvent,
  ThreadEvent,
  ThreadItem,
  ThreadStartedEvent,
  TodoListItem,
  TurnCompletedEvent,
  TurnFailedEvent,
  TurnStartedEvent,
  WebSearchItem,
} from "@alfred/codex";
import { logger } from "@alfred/logger";
import {
  type AgentMetadata,
  agentMetadataSchema,
  type ResponseSessionState,
  responseSessionStateSchema,
} from "@alfred/protocol";
import Ajv from "ajv";
import Ajv2019 from "ajv/dist/2019";
import Ajv2020 from "ajv/dist/2020";
import { z } from "zod";
import { MAX_TIMEOUT_SEC, MIN_TIMEOUT_SEC } from "./constants.js";

const MAX_SCHEMA_DEPTH = 10;
const MAX_SCHEMA_PROPERTIES = 100;
const EXTERNAL_REF_PATTERN = /^https?:\/\//i;

const ajvOptions = {
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
};

const schemaValidators = [
  new Ajv2020(ajvOptions),
  new Ajv2019(ajvOptions),
  new Ajv(ajvOptions),
];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

type ComplexityState = {
  propertyCount: number;
  tooDeep: boolean;
  tooManyProps: boolean;
  externalRef: boolean;
  invalidNode: boolean;
  visited: WeakSet<object>;
};

function exceedsComplexityLimits(schema: Record<string, unknown>): boolean {
  const state: ComplexityState = {
    propertyCount: 0,
    tooDeep: false,
    tooManyProps: false,
    externalRef: false,
    invalidNode: false,
    visited: new WeakSet<object>(),
  };

  function inspect(node: unknown, depth: number, flags: ComplexityState): void {
    if (
      flags.tooDeep ||
      flags.tooManyProps ||
      flags.externalRef ||
      flags.invalidNode
    ) {
      return;
    }

    if (depth > MAX_SCHEMA_DEPTH) {
      flags.tooDeep = true;
      return;
    }

    if (typeof node !== "object" || node === null) {
      return;
    }

    if (flags.visited.has(node)) {
      return;
    }
    flags.visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        inspect(item, depth + 1, flags);
        if (
          flags.tooDeep ||
          flags.tooManyProps ||
          flags.externalRef ||
          flags.invalidNode
        ) {
          return;
        }
      }
      return;
    }

    if (!isPlainRecord(node)) {
      flags.invalidNode = true;
      return;
    }

    const entries = Object.entries(node);
    flags.propertyCount += entries.length;
    if (flags.propertyCount > MAX_SCHEMA_PROPERTIES) {
      flags.tooManyProps = true;
      return;
    }

    for (const [key, value] of entries) {
      if (key === "$ref" && typeof value === "string") {
        const trimmed = value.trim();
        if (EXTERNAL_REF_PATTERN.test(trimmed)) {
          flags.externalRef = true;
          return;
        }
      }
      inspect(value, depth + 1, flags);
      if (
        flags.tooDeep ||
        flags.tooManyProps ||
        flags.externalRef ||
        flags.invalidNode
      ) {
        return;
      }
    }
  }

  inspect(schema, 1, state);
  return (
    state.tooDeep ||
    state.tooManyProps ||
    state.externalRef ||
    state.invalidNode
  );
}

function isStructurallyValidSchema(schema: Record<string, unknown>): boolean {
  for (const validator of schemaValidators) {
    try {
      if (validator.validateSchema(schema)) {
        return true;
      }
    } catch {
      // ignore and try next validator
    }
  }
  return false;
}

export function validateOutputSchema(schema: unknown): boolean {
  if (schema === undefined) {
    return false;
  }

  if (typeof schema === "boolean") {
    return true;
  }

  if (!isPlainRecord(schema)) {
    return false;
  }

  if (exceedsComplexityLimits(schema)) {
    return false;
  }

  return isStructurallyValidSchema(schema);
}

export const OUTPUT_CAP_BYTES = 5 * 1024 * 1024; // 5 MiB

export const MCP_ENV_ALLOWLIST = new Set([
  "CONTEXT7_API_KEY",
  "CONTEXT7_BASE_URL",
  "GITHUB_PAT",
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "GITHUB_TOKEN",
  "GITHUB_HOST",
  "GITHUB_TOOLSETS",
  "GITHUB_DYNAMIC_TOOLSETS",
  "GITHUB_READ_ONLY",
  "PLAYWRIGHT_BROWSERS_PATH",
  "PLAYWRIGHT_SERVICE_ACCESS_TOKEN",
  "PLAYWRIGHT_WS_ENDPOINT",
  "PLAYWRIGHT_HEADLESS",
  "MCP_AUTH_TOKEN",
]);

export const CODEX_ENV_ALLOWLIST = new Set([
  "CODEX_API_KEY",
  "CODEX_MODEL",
  "CODEX_REGION",
  "CODEX_PROFILE",
  "CODEX_HOME",
  "CODEX_THREAD_ID",
]);

export const codexInputSchema = z.object({
  action: z.literal("exec"),
  prompt: z.string().min(1),
  out: z.enum(["text", "json", "debug"]).default("text"),
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  cw: z.string().optional(),
  model: z.string().optional(),
  profile: z.string().optional(),
  authz: z.string().optional(),
  timeoutSec: z
    .number()
    .int()
    .min(MIN_TIMEOUT_SEC)
    .max(MAX_TIMEOUT_SEC, {
      message: "codex_timeout_exceeds_limit",
    })
    .optional(),
  env: z.record(z.string(), z.string()).optional(),
  sessionId: z.string().min(1).max(255).optional(),
  userId: z.string().optional(), // Injected server-side identity for session binding
  /** AgentFS database path for audit trail */
  agentfsDbPath: z.string().min(1).max(1024).optional(),
  outputSchema: z
    .union([z.boolean(), z.record(z.string(), z.unknown())])
    .optional(),
  context: z
    .object({
      linearIssueId: z.string().optional(),
      linearSessionId: z.string().optional(),
      linearSpace: z.string().optional(),
      linearAuthz: z.string().optional(),
      relevantFiles: z.array(z.string()).optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

export type CodexToolInput = z.infer<typeof codexInputSchema>;

export const toolOutputSchema = z.object({
  result: z.string(),
  artifacts: z
    .array(
      z.object({
        path: z.string(),
        kind: z.string(),
      })
    )
    .optional(),
  reasoning: z
    .array(
      z.object({
        text: z.string(),
        timestamp: z.number(),
      })
    )
    .optional(),
  metadata: agentMetadataSchema.optional(),
  sessionState: responseSessionStateSchema.optional(),
});

export type { AgentMetadata, ResponseSessionState };

export type AlfredCodexEvent =
  | {
      type: "thought";
      content: string;
      timestamp: number;
    }
  | {
      type: "command";
      command: string;
      status: "running" | "completed" | "failed";
    }
  | {
      type: "output";
      content: string;
    }
  | {
      type: "artifact";
      path: string;
      kind: "file" | "image";
    };

export type CodexArtifactSummary = {
  path: string;
  kind: string;
};

const usageSchema = z
  .object({
    input_tokens: z.number().finite(),
    cached_input_tokens: z.number().finite(),
    output_tokens: z.number().finite(),
  })
  .strict();

const reasoningItemSchema: z.ZodType<ReasoningItem> = z
  .object({
    id: z.string().min(1),
    type: z.literal("reasoning"),
    text: z.string(),
  })
  .passthrough();

const agentMessageItemSchema: z.ZodType<AgentMessageItem> = z
  .object({
    id: z.string().min(1),
    type: z.literal("agent_message"),
    text: z.string(),
  })
  .passthrough();

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

const commandExecutionItemSchema = commandExecutionItemSchemaBase.transform(
  (item): CommandExecutionItem => ({
    ...item,
    aggregated_output: normalizeAggregatedOutput(item.aggregated_output),
  })
);

const fileChangeItemSchema: z.ZodType<FileChangeItem> = z
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

const mcpToolCallItemSchema = z
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
  .passthrough() as z.ZodType<McpToolCallItem>;

const webSearchItemSchema: z.ZodType<WebSearchItem> = z
  .object({
    id: z.string().min(1),
    type: z.literal("web_search"),
    query: z.string(),
  })
  .passthrough();

const todoListItemSchema: z.ZodType<TodoListItem> = z
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

const errorItemSchema: z.ZodType<ErrorItem> = z
  .object({
    id: z.string().min(1),
    type: z.literal("error"),
    message: z.string(),
  })
  .passthrough();

const threadItemSchema = z.union([
  reasoningItemSchema,
  agentMessageItemSchema,
  commandExecutionItemSchema,
  fileChangeItemSchema,
  mcpToolCallItemSchema,
  webSearchItemSchema,
  todoListItemSchema,
  errorItemSchema,
]) as z.ZodType<ThreadItem>;

export const threadStartedEventSchema: z.ZodType<ThreadStartedEvent> = z
  .object({
    type: z.literal("thread.started"),
    thread_id: z.string().min(1),
  })
  .passthrough();

export const turnStartedEventSchema: z.ZodType<TurnStartedEvent> = z
  .object({
    type: z.literal("turn.started"),
  })
  .passthrough();

export const turnCompletedEventSchema: z.ZodType<TurnCompletedEvent> = z
  .object({
    type: z.literal("turn.completed"),
    usage: usageSchema,
  })
  .passthrough();

export const turnFailedEventSchema: z.ZodType<TurnFailedEvent> = z
  .object({
    type: z.literal("turn.failed"),
    error: z
      .object({
        message: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

const itemStartedEventSchema: z.ZodType<ItemStartedEvent> = z
  .object({
    type: z.literal("item.started"),
    item: threadItemSchema,
  })
  .passthrough();

const itemUpdatedEventSchema: z.ZodType<ItemUpdatedEvent> = z
  .object({
    type: z.literal("item.updated"),
    item: threadItemSchema,
  })
  .passthrough();

export const itemCompletedEventSchema: z.ZodType<ItemCompletedEvent> = z
  .object({
    type: z.literal("item.completed"),
    item: threadItemSchema,
  })
  .passthrough();

export const errorEventSchema: z.ZodType<ThreadErrorEvent> = z
  .object({
    type: z.literal("error"),
    message: z.string().min(1),
  })
  .passthrough();

const threadEventSchema: z.ZodType<ThreadEvent> = z.union([
  threadStartedEventSchema,
  turnStartedEventSchema,
  turnCompletedEventSchema,
  turnFailedEventSchema,
  itemStartedEventSchema,
  itemUpdatedEventSchema,
  itemCompletedEventSchema,
  errorEventSchema,
]);

export const alfredCodexEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("thought"),
      content: z.string(),
      timestamp: z.number().finite(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("command"),
      command: z.string(),
      status: z.enum(["running", "completed", "failed"]),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("output"),
      content: z.string(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("artifact"),
      path: z.string(),
      kind: z.enum(["file", "image"]),
    })
    .passthrough(),
]);

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

import type { ToolExecuteContext } from "../shared/context.js";

export type CodexExecuteArgs = ToolExecuteContext<CodexToolInput>;

export type SandboxConfig = {
  sandbox: "read-only" | "workspace-write";
  approval: "untrusted" | "on-failure" | "on-request" | "never";
};

export {
  DEFAULT_TIMEOUT_SEC,
  ELEVATED_TIMEOUT_THRESHOLD_SEC,
  MAX_TIMEOUT_SEC,
  MIN_TIMEOUT_SEC,
} from "./constants.js";
