/**
 * @alfred/protocol - Agent protocol schemas
 *
 * Consolidated schemas for agent communication including:
 * - Thread events and items
 * - Session state
 * - ACP-compatible types
 * - Agent metadata
 */

// Thread items
export {
  agentMessageItemSchema,
  commandExecutionItemSchema,
  errorItemSchema,
  fileChangeItemSchema,
  mcpToolCallItemSchema,
  parseThreadItem,
  reasoningItemSchema,
  threadItemSchema,
  todoListItemSchema,
  webSearchItemSchema,
  type AgentMessageItem,
  type CommandExecutionItem,
  type ErrorItem,
  type FileChangeItem,
  type McpToolCallItem,
  type ReasoningItem,
  type ThreadItem,
  type TodoListItem,
  type WebSearchItem,
} from "./items.js";

// Thread events
export {
  errorEventSchema,
  itemCompletedEventSchema,
  itemStartedEventSchema,
  itemUpdatedEventSchema,
  parseThreadEvent,
  threadEventSchema,
  threadStartedEventSchema,
  turnCompletedEventSchema,
  turnFailedEventSchema,
  turnStartedEventSchema,
  usageSchema,
  type ItemCompletedEvent,
  type ItemStartedEvent,
  type ItemUpdatedEvent,
  type ParseOptions,
  type ThreadErrorEvent,
  type ThreadEvent,
  type ThreadStartedEvent,
  type TurnCompletedEvent,
  type TurnFailedEvent,
  type TurnStartedEvent,
  type Usage,
} from "./events.js";

// Session state
export {
  responseSessionStateSchema,
  sessionResumeResultSchema,
  sessionStateSchema,
  sessionStatusSchema,
  type ResponseSessionState,
  type SessionResumeResult,
  type SessionState,
  type SessionStatus,
} from "./session.js";

// ACP-compatible types
export {
  mapAutonomyToAcpMode,
  permissionOptionKindSchema,
  permissionOptionSchema,
  permissionOutcomeSchema,
  permissionRequestSchema,
  sessionModeSchema,
  stopReasonSchema,
  toolCallStatusSchema,
  toolKindSchema,
  type PermissionOption,
  type PermissionOptionKind,
  type PermissionOutcome,
  type PermissionRequest,
  type SessionMode,
  type StopReason,
  type ToolCallStatus,
  type ToolKind,
} from "./acp.js";

// Agent metadata
export {
  agentMetadataSchema,
  artifactSummarySchema,
  createAgentMetadata,
  reasoningTraceSchema,
  tokenUsageSchema,
  toolOutputWithMetadataSchema,
  type AgentMetadata,
  type ArtifactSummary,
  type ReasoningTrace,
  type TokenUsage,
  type ToolOutputWithMetadata,
} from "./metadata.js";
