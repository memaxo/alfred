/**
 * ALFRED Message Type Declarations
 * Type definitions for agent/orchestrator messages and events
 */

// TODO: [Phase 4] Align with AI SDK UI message format for additional metadata

/**
 * Message roles
 */
export type Role = "user" | "assistant" | "system" | "tool";

/**
 * Base message structure
 */
export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * User message
 */
export interface UserMessage extends Message {
  role: "user";
}

/**
 * Assistant message (from agent)
 * @deprecated Use UIMessage from @alfred/type/stream for streaming contexts
 */
export interface AgentMessage extends Message {
  role: "assistant";
  agent?: "assistant" | "orchestrator";
  toolCalls?: ToolCall[];
}

/**
 * System message
 */
export interface SystemMessage extends Message {
  role: "system";
}

/**
 * Tool call structure
 */
export interface ToolCall {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  output?: unknown;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
}

/**
 * Tool message (tool execution result)
 */
export interface ToolMessage extends Message {
  role: "tool";
  toolCallId: string;
  toolName: string;
  result: unknown;
}

// TODO: [Phase 4] Add conversation/thread types
// export interface Conversation {
//   id: string;
//   messages: Message[];
//   agent: "assistant" | "orchestrator";
//   created: Date;
//   updated: Date;
// }

// TODO: [Phase 4] Add streaming types for richer AI SDK event modeling
// export interface StreamChunk {
//   delta: string;
//   cumulative: string;
// }
