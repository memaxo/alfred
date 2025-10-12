/**
 * ALFRED Message Type Declarations
 * Type definitions for agent/orchestrator messages and events
 */

// TODO: [Phase 4] Align with Mastra message format and streaming events

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
 */
export interface AssistantMessage extends Message {
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

/**
 * Stream event types
 */
export type StreamEventType =
  | "message_start"
  | "message_delta"
  | "message_end"
  | "tool_start"
  | "tool_delta"
  | "tool_end"
  | "error"
  | "cache_handoff";

/**
 * Stream event
 */
export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: Date;
}

/**
 * Cache handoff event (Stream-to-Cache pattern)
 * Sent to TanStack Query to update cache without flicker
 */
export interface CacheHandoffEvent extends StreamEvent {
  type: "cache_handoff";
  data: {
    queryKey: string[];
    value: unknown;
    merge?: boolean; // If true, merge with existing cache
  };
}

// TODO: [Phase 4] Add conversation/thread types
// export interface Conversation {
//   id: string;
//   messages: Message[];
//   agent: "assistant" | "orchestrator";
//   created: Date;
//   updated: Date;
// }

// TODO: [Phase 4] Add streaming types for Mastra integration
// export interface StreamChunk {
//   delta: string;
//   cumulative: string;
// }
