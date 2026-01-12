import { z } from "zod";

/**
 * Zod schema for router message input (simplified format for tRPC).
 */
export const routerMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().min(1),
});

/**
 * Zod schema for AI SDK v6 UIMessage.
 * Accepts the common part types surfaced to the UI layer while tolerating
 * additional data payloads via `.passthrough()`.
 */
const dataPartSchema = z
  .object({
    type: z
      .string()
      .min(1)
      .refine((value) => value.startsWith("data-")),
    id: z.string().optional(),
    data: z.unknown(),
  })
  .passthrough();

const toolInvocationPartSchema = z
  .object({
    type: z
      .string()
      .min(1)
      .refine((value) => value.startsWith("tool-")),
    toolCallId: z.string(),
    input: z.unknown(),
    output: z.unknown().optional(),
    state: z.string().optional(),
    errorText: z.string().optional(),
    approval: z
      .object({
        id: z.string(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const dynamicToolInvocationPartSchema = z
  .object({
    type: z.literal("dynamic-tool"),
    toolName: z.string(),
    toolCallId: z.string(),
    input: z.unknown().optional(),
    output: z.unknown().optional(),
    state: z.string().optional(),
    errorText: z.string().optional(),
    approval: z
      .object({
        id: z.string(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const uiMessagePartSchema = z.union([
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("reasoning"),
    text: z.string(),
    state: z.enum(["streaming", "done"]).optional(),
    providerMetadata: z.record(z.string(), z.unknown()).optional(),
  }),
  // ALFRED's explicit tool-call / tool-result formats (persisted)
  z.object({
    type: z.literal("tool-call"),
    toolCallId: z.string(),
    toolName: z.string(),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal("tool-result"),
    toolCallId: z.string(),
    toolName: z.string(),
    output: z.unknown(),
  }),
  // AI SDK v6 tool invocation parts (template-literal: tool-${NAME})
  toolInvocationPartSchema,
  // AI SDK v6 dynamic tool invocation parts
  dynamicToolInvocationPartSchema,
  z.object({
    type: z.literal("file"),
    mediaType: z.string(),
    url: z.string(),
    filename: z.string().optional(),
  }),
  z.object({
    type: z.literal("source-url"),
    sourceId: z.string(),
    url: z.string(),
    title: z.string().optional(),
    providerMetadata: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("source-document"),
    sourceId: z.string(),
    mediaType: z.string(),
    title: z.string(),
    filename: z.string().optional(),
    providerMetadata: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("step-start"),
  }),
  z
    .object({
      type: z.literal("data-status"),
      data: z.unknown(),
      transient: z.boolean().optional(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("data-cache"),
      data: z.unknown(),
      transient: z.boolean().optional(),
    })
    .passthrough(),
  dataPartSchema,
]);

export const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["system", "user", "assistant"]),
  metadata: z.unknown().optional(),
  parts: z.array(uiMessagePartSchema).optional().default([]),
});

/**
 * Zod schema for AI SDK v6 ModelMessage.
 */
export const modelMessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("system"),
    content: z.string(),
  }),
  z.object({
    role: z.literal("user"),
    content: z.union([z.string(), z.array(z.unknown())]),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.union([z.string(), z.array(z.unknown())]),
  }),
  z.object({
    role: z.literal("tool"),
    content: z.array(
      z.object({
        type: z.literal("tool-result"),
        toolCallId: z.string(),
        toolName: z.string(),
        output: z.unknown(),
      })
    ),
  }),
]);
