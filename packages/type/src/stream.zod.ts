import { z } from "zod";

/**
 * Zod schema for AI SDK v6 UIMessage.
 * Accepts the common part types surfaced to the UI layer while tolerating
 * additional data payloads via `.passthrough()`.
 */
export const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["system", "user", "assistant"]),
  metadata: z.unknown().optional(),
  parts: z
    .array(
      z
        .discriminatedUnion("type", [
          z.object({
            type: z.literal("text"),
            text: z.string(),
          }),
          z.object({
            type: z.literal("reasoning"),
            reasoning: z.string(),
          }),
          z.object({
            type: z.literal("tool-call"),
            toolCallId: z.string(),
            toolName: z.string(),
            args: z.unknown(),
          }),
          z.object({
            type: z.literal("tool-result"),
            toolCallId: z.string(),
            toolName: z.string(),
            result: z.unknown(),
          }),
          z.object({
            type: z.literal("file"),
            mimeType: z.string(),
            data: z.string(),
          }),
          z.object({
            type: z.literal("data"),
            data: z.unknown(),
          }),
          z.object({
            type: z.literal("source"),
            url: z.string().optional(),
            document: z.unknown().optional(),
          }),
          z.object({
            type: z.literal("step-start"),
            stepId: z.string(),
          }),
          z.object({
            type: z.literal("error"),
            errorText: z.string(),
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
        ])
    )
    .optional()
    .default([]),
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
    content: z.union([z.string(), z.array(z.unknown())]),
    toolCallId: z.string(),
    toolName: z.string(),
  }),
]);
