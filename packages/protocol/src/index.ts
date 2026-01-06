/**
 * @alfred/protocol - Agent protocol schemas
 *
 * Consolidated schemas for agent communication including:
 * - Thread events and items
 * - Session state
 * - ACP-compatible types
 * - Agent metadata
 */

// ACP-compatible types
export { mapAutonomyToAcpMode } from "./acp.js";

// Thread events
export {
  errorEventSchema,
  type ItemCompletedEvent,
  type ItemStartedEvent,
  type ItemUpdatedEvent,
  itemCompletedEventSchema,
  itemStartedEventSchema,
  itemUpdatedEventSchema,
  type ParseOptions,
  parseThreadEvent,
  type ThreadErrorEvent,
  type ThreadEvent,
  type ThreadStartedEvent,
  type TurnCompletedEvent,
  type TurnFailedEvent,
  type TurnStartedEvent,
  threadEventSchema,
  threadStartedEventSchema,
  turnCompletedEventSchema,
  turnFailedEventSchema,
  turnStartedEventSchema,
  type Usage,
  usageSchema,
} from "./events.js";
// Thread items
export {
  type AgentMessageItem,
  agentMessageItemSchema,
  type CommandExecutionItem,
  commandExecutionItemSchema,
  type ErrorItem,
  errorItemSchema,
  type FileChangeItem,
  fileChangeItemSchema,
  type McpToolCallItem,
  mcpToolCallItemSchema,
  parseThreadItem,
  type ReasoningItem,
  reasoningItemSchema,
  type ThreadItem,
  type TodoListItem,
  threadItemSchema,
  todoListItemSchema,
  type WebSearchItem,
  webSearchItemSchema,
} from "./items.js";
// Agent metadata
export {
  type AgentMetadata,
  type ArtifactSummary,
  agentMetadataSchema,
  artifactSummarySchema,
  createAgentMetadata,
  type ReasoningTrace,
  reasoningTraceSchema,
  type TokenUsage,
  type ToolOutputWithMetadata,
  tokenUsageSchema,
  toolOutputWithMetadataSchema,
} from "./metadata.js";
// Session state
export {
  type ResponseSessionState,
  responseSessionStateSchema,
  type SessionResumeResult,
  type SessionState,
  type SessionStatus,
  sessionResumeResultSchema,
  sessionStateSchema,
  sessionStatusSchema,
} from "./session.js";
