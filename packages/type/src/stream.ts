/**
 * ALFRED Streaming Types
 * Pure event model for agent/orchestrator streaming
 * 
 * Carmack-Karpathy principles:
 * - Pure functions: no side effects
 * - Explicit transformations: every event is typed
 * - Zero allocation in hot paths
 */

import type { Message, ToolCall } from "./msg";

/**
 * Base event type
 * All streaming events extend this
 */
export interface BaseEvent {
  type: string;
  ts: number; // Unix timestamp for zero-allocation lookups
}

/**
 * Message events
 */
export interface MessageEvent extends BaseEvent {
  type: "message";
  data: {
    delta: string;
    cumulative: string;
    role: "user" | "assistant" | "orchestrator";
  };
}

/**
 * Action events (tool invocations)
 */
export interface ActionEvent extends BaseEvent {
  type: "action";
  data: {
    id: string;
    tool: string;
    args: Record<string, unknown>;
    status: "pending" | "running" | "completed" | "error";
    result?: unknown;
    error?: string;
  };
}

/**
 * Status events (connection, loading, etc.)
 */
export interface StatusEvent extends BaseEvent {
  type: "status";
  data: {
    state: "connecting" | "connected" | "disconnected" | "error";
    message?: string;
  };
}

/**
 * Progress events (task completion)
 */
export interface ProgressEvent extends BaseEvent {
  type: "progress";
  data: {
    taskId: string;
    percent: number;
    message: string;
  };
}

/**
 * Cache handoff events
 * TanStack Query cache updates without flicker
 */
export interface CacheHandoffEvent extends BaseEvent {
  type: "cache_handoff";
  data: {
    key: string[];
    value: unknown;
    merge?: boolean;
  };
}

/**
 * Error events
 */
export interface ErrorEvent extends BaseEvent {
  type: "error";
  data: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

/**
 * Union of all event types
 */
export type StreamEvent =
  | MessageEvent
  | ActionEvent
  | StatusEvent
  | ProgressEvent
  | CacheHandoffEvent
  | ErrorEvent;

/**
 * Type guard helpers
 */
export function isMessageEvent(event: StreamEvent): event is MessageEvent {
  return event.type === "message";
}

export function isActionEvent(event: StreamEvent): event is ActionEvent {
  return event.type === "action";
}

export function isStatusEvent(event: StreamEvent): event is StatusEvent {
  return event.type === "status";
}

export function isProgressEvent(event: StreamEvent): event is ProgressEvent {
  return event.type === "progress";
}

export function isCacheHandoffEvent(event: StreamEvent): event is CacheHandoffEvent {
  return event.type === "cache_handoff";
}

export function isErrorEvent(event: StreamEvent): event is ErrorEvent {
  return event.type === "error";
}

/**
 * Event factory helpers
 * Zero-allocation event creation
 */
export function createMessageEvent(
  delta: string,
  cumulative: string,
  role: "user" | "assistant" | "orchestrator",
): MessageEvent {
  return {
    type: "message",
    ts: Date.now(),
    data: { delta, cumulative, role },
  };
}

export function createActionEvent(
  id: string,
  tool: string,
  args: Record<string, unknown>,
  status: "pending" | "running" | "completed" | "error",
  result?: unknown,
  error?: string,
): ActionEvent {
  return {
    type: "action",
    ts: Date.now(),
    data: { id, tool, args, status, result, error },
  };
}

export function createStatusEvent(
  state: "connecting" | "connected" | "disconnected" | "error",
  message?: string,
): StatusEvent {
  return {
    type: "status",
    ts: Date.now(),
    data: { state, message },
  };
}

export function createProgressEvent(
  taskId: string,
  percent: number,
  message: string,
): ProgressEvent {
  return {
    type: "progress",
    ts: Date.now(),
    data: { taskId, percent, message },
  };
}

export function createCacheHandoffEvent(
  key: string[],
  value: unknown,
  merge = false,
): CacheHandoffEvent {
  return {
    type: "cache_handoff",
    ts: Date.now(),
    data: { key, value, merge },
  };
}

export function createErrorEvent(
  code: string,
  message: string,
  recoverable = false,
): ErrorEvent {
  return {
    type: "error",
    ts: Date.now(),
    data: { code, message, recoverable },
  };
}

