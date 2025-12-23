/**
 * ACP SDK Integration
 *
 * Re-exports from @agentclientprotocol/sdk for Agent Client Protocol interop.
 * ALFRED-specific adapters convert between internal types and ACP types.
 *
 * @see https://agentclientprotocol.com/
 * @see https://github.com/agentclientprotocol/typescript-sdk
 */

// ============================================================================
// SDK Re-exports - Connection Classes
// ============================================================================

export {
  AgentSideConnection,
  ClientSideConnection,
  TerminalHandle,
  RequestError,
  type Agent,
  type Client,
  type Stream,
  ndJsonStream,
} from "@agentclientprotocol/sdk";

// ============================================================================
// SDK Re-exports - Protocol Constants
// ============================================================================

export {
  AGENT_METHODS,
  CLIENT_METHODS,
  PROTOCOL_VERSION,
} from "@agentclientprotocol/sdk";

// ============================================================================
// SDK Re-exports - TypeScript Types (Generated from JSON Schema v0.10.4)
// ============================================================================

export type {
  // Session Types
  SessionId,
  SessionInfo,
  SessionMode as AcpSessionMode,
  SessionModeId,
  SessionModeState,
  SessionNotification,
  SessionUpdate,
  SessionCapabilities,
  SessionConfigOption,
  SessionModelState,

  // Request/Response Types
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  PromptRequest,
  PromptResponse,
  AuthenticateRequest,
  AuthenticateResponse,
  CancelNotification,

  // Permission Types
  PermissionOption as AcpPermissionOption,
  PermissionOptionId,
  PermissionOptionKind as AcpPermissionOptionKind,
  RequestPermissionRequest,
  RequestPermissionResponse,
  RequestPermissionOutcome,

  // Content Types
  ContentBlock,
  ContentChunk,
  TextContent,
  ImageContent,
  AudioContent,
  EmbeddedResource,
  ResourceLink,

  // Tool Types
  ToolCall,
  ToolCallContent,
  ToolCallId,
  ToolKind as AcpToolKind,
  ToolCallStatus as AcpToolCallStatus,
  ToolCallUpdate,

  // Plan Types
  Plan,
  PlanEntry,
  PlanEntryPriority,
  PlanEntryStatus,

  // Terminal Types
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  KillTerminalCommandRequest,
  KillTerminalCommandResponse,
  TerminalExitStatus,

  // File System Types
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,

  // MCP Types
  McpServer,
  McpServerStdio,
  McpServerHttp,
  McpServerSse,
  McpCapabilities,

  // Capabilities
  AgentCapabilities,
  ClientCapabilities,
  FileSystemCapability,
  PromptCapabilities,

  // Other Types
  StopReason as AcpStopReason,
  Implementation,
  Role,
  Diff,
  _Error as AcpError,
  ErrorCode,
} from "@agentclientprotocol/sdk";

// ============================================================================
// ALFRED Legacy Aliases (Deprecated - use SDK types directly)
// ============================================================================

import { z } from "zod";

/**
 * @deprecated Use AcpToolCallStatus from SDK instead
 */
export const toolCallStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
]);

/** @deprecated Use AcpToolCallStatus from SDK instead */
export type ToolCallStatus = z.infer<typeof toolCallStatusSchema>;

/**
 * @deprecated Use AcpToolKind from SDK instead
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

/** @deprecated Use AcpToolKind from SDK instead */
export type ToolKind = z.infer<typeof toolKindSchema>;

/**
 * @deprecated Use AcpPermissionOptionKind from SDK instead
 */
export const permissionOptionKindSchema = z.enum([
  "allow_once",
  "allow_always",
  "reject_once",
  "reject_always",
]);

/** @deprecated Use AcpPermissionOptionKind from SDK instead */
export type PermissionOptionKind = z.infer<typeof permissionOptionKindSchema>;

/**
 * @deprecated Use AcpPermissionOption from SDK instead
 */
export const permissionOptionSchema = z.object({
  optionId: z.string(),
  name: z.string(),
  kind: permissionOptionKindSchema,
});

/** @deprecated Use AcpPermissionOption from SDK instead */
export type PermissionOption = z.infer<typeof permissionOptionSchema>;

/**
 * @deprecated Use RequestPermissionRequest from SDK instead
 */
export const permissionRequestSchema = z.object({
  sessionId: z.string(),
  toolCallId: z.string(),
  title: z.string(),
  kind: toolKindSchema.optional(),
  options: z.array(permissionOptionSchema),
});

/** @deprecated Use RequestPermissionRequest from SDK instead */
export type PermissionRequest = z.infer<typeof permissionRequestSchema>;

/**
 * @deprecated Use RequestPermissionOutcome from SDK instead
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

/** @deprecated Use RequestPermissionOutcome from SDK instead */
export type PermissionOutcome = z.infer<typeof permissionOutcomeSchema>;

/**
 * @deprecated Use AcpSessionMode from SDK instead
 */
export const sessionModeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

/** @deprecated Use AcpSessionMode from SDK instead */
export type SessionMode = z.infer<typeof sessionModeSchema>;

/**
 * @deprecated Use AcpStopReason from SDK instead
 */
export const stopReasonSchema = z.enum([
  "end_turn",
  "max_tokens",
  "max_turn_requests",
  "refusal",
  "cancelled",
]);

/** @deprecated Use AcpStopReason from SDK instead */
export type StopReason = z.infer<typeof stopReasonSchema>;

// ============================================================================
// ALFRED Adapters - Convert between ALFRED and ACP types
// ============================================================================

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

/**
 * Map ACP session mode to ALFRED autonomy level.
 * Note: This is a lossy mapping - both "read" and "low" autonomy map to "ask" mode,
 * so round-tripping loses the distinction. "medium" also maps to "code" alongside "high".
 */
export function mapAcpModeToAutonomy(
  modeId: string
): "low" | "medium" | "high" {
  switch (modeId) {
    case "ask":
      return "low";
    case "architect":
      return "medium";
    case "code":
      return "high";
    default:
      return "low";
  }
}
