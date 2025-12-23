/**
 * ACP-compatible types for future Agent Client Protocol interop
 *
 * These types align with the ACP specification to enable future
 * integration with ACP-compatible agents and clients.
 *
 * @see https://agentclientprotocol.com/
 */

import { z } from "zod";

/**
 * Tool call status aligned with ACP
 */
export const toolCallStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
]);

export type ToolCallStatus = z.infer<typeof toolCallStatusSchema>;

/**
 * Tool kind for categorizing tool operations
 */
export const toolKindSchema = z.enum([
  "read",
  "edit",
  "delete",
  "move",
  "search",
  "execute",
  "think",
  "fetch",
  "other",
]);

export type ToolKind = z.infer<typeof toolKindSchema>;

/**
 * Permission option kinds aligned with ACP
 */
export const permissionOptionKindSchema = z.enum([
  "allow_once",
  "allow_always",
  "reject_once",
  "reject_always",
]);

export type PermissionOptionKind = z.infer<typeof permissionOptionKindSchema>;

/**
 * Permission option for tool approval
 */
export const permissionOptionSchema = z.object({
  optionId: z.string(),
  name: z.string(),
  kind: permissionOptionKindSchema,
});

export type PermissionOption = z.infer<typeof permissionOptionSchema>;

/**
 * Permission request for tool execution
 */
export const permissionRequestSchema = z.object({
  sessionId: z.string(),
  toolCallId: z.string(),
  title: z.string(),
  kind: toolKindSchema.optional(),
  options: z.array(permissionOptionSchema),
});

export type PermissionRequest = z.infer<typeof permissionRequestSchema>;

/**
 * Permission response outcome
 */
export const permissionOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("selected"),
    optionId: z.string(),
  }),
  z.object({
    outcome: z.literal("cancelled"),
  }),
]);

export type PermissionOutcome = z.infer<typeof permissionOutcomeSchema>;

/**
 * Session mode aligned with ACP
 */
export const sessionModeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

export type SessionMode = z.infer<typeof sessionModeSchema>;

/**
 * Stop reasons aligned with ACP
 */
export const stopReasonSchema = z.enum([
  "end_turn",
  "max_tokens",
  "max_turn_requests",
  "refusal",
  "cancelled",
]);

export type StopReason = z.infer<typeof stopReasonSchema>;

/**
 * Map ALFRED autonomy levels to ACP session modes
 */
export function mapAutonomyToAcpMode(
  auto: "read" | "low" | "medium" | "high"
): SessionMode {
  const modes: Record<typeof auto, SessionMode> = {
    read: {
      id: "ask",
      name: "Ask",
      description: "Request permission before making any changes",
    },
    low: {
      id: "ask",
      name: "Ask",
      description: "Request permission before making any changes",
    },
    medium: {
      id: "code",
      name: "Code",
      description: "Write and modify code with tool access",
    },
    high: {
      id: "code",
      name: "Code",
      description: "Write and modify code with full tool access",
    },
  };
  return modes[auto];
}
