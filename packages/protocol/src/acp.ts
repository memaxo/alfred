/**
 * ACP SDK Integration
 *
 * Re-exports from @agentclientprotocol/sdk for Agent Client Protocol interop.
 * ALFRED-specific adapters convert between internal types and ACP types.
 *
 * @see https://agentclientprotocol.com/
 * @see https://github.com/agentclientprotocol/typescript-sdk
 */

import type { SessionMode as AcpSessionModeInternal } from "@agentclientprotocol/sdk";

// ============================================================================
// SDK Re-exports - Connection Classes
// ============================================================================

export {
  type Agent,
  AgentSideConnection,
  type Client,
  ClientSideConnection,
  ndJsonStream,
  RequestError,
  type Stream,
  TerminalHandle,
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
  _Error as AcpError,
  // Capabilities
  AgentCapabilities,
  AudioContent,
  AuthenticateRequest,
  AuthenticateResponse,
  CancelNotification,
  ClientCapabilities,
  // Content Types
  ContentBlock,
  ContentChunk,
  // Terminal Types
  CreateTerminalRequest,
  CreateTerminalResponse,
  Diff,
  EmbeddedResource,
  ErrorCode,
  FileSystemCapability,
  ImageContent,
  Implementation,
  // Request/Response Types
  InitializeRequest,
  InitializeResponse,
  KillTerminalCommandRequest,
  KillTerminalCommandResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  McpCapabilities,
  // MCP Types
  McpServer,
  McpServerHttp,
  McpServerSse,
  McpServerStdio,
  NewSessionRequest,
  NewSessionResponse,
  // Permission Types
  PermissionOption as AcpPermissionOption,
  PermissionOptionId,
  PermissionOptionKind as AcpPermissionOptionKind,
  // Plan Types
  Plan,
  PlanEntry,
  PlanEntryPriority,
  PlanEntryStatus,
  PromptCapabilities,
  PromptRequest,
  PromptResponse,
  // File System Types
  ReadTextFileRequest,
  ReadTextFileResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  RequestPermissionOutcome,
  RequestPermissionRequest,
  RequestPermissionResponse,
  ResourceLink,
  Role,
  SessionCapabilities,
  SessionConfigOption,
  // Session Types
  SessionId,
  SessionInfo,
  SessionMode as AcpSessionMode,
  SessionModeId,
  SessionModelState,
  SessionModeState,
  SessionNotification,
  SessionUpdate,
  // Other Types
  StopReason as AcpStopReason,
  TerminalExitStatus,
  TerminalOutputRequest,
  TerminalOutputResponse,
  TextContent,
  // Tool Types
  ToolCall,
  ToolCallContent,
  ToolCallId,
  ToolCallStatus as AcpToolCallStatus,
  ToolCallUpdate,
  ToolKind as AcpToolKind,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from "@agentclientprotocol/sdk";

// ============================================================================
// ALFRED Adapters - Convert between ALFRED and ACP types
// ============================================================================

/**
 * Map ALFRED autonomy levels to ACP session modes
 */
export function mapAutonomyToAcpMode(
  auto: "read" | "low" | "medium" | "high"
): AcpSessionModeInternal {
  const modes: Record<typeof auto, AcpSessionModeInternal> = {
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
