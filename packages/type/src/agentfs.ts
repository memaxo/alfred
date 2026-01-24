/**
 * AgentFS stream DTOs (shared across API + TUI).
 *
 * JSON-serialisable by design.
 */

export interface AgentFSDirEntry {
  name: string;
  ino: number;
  isDirectory: boolean;
  size?: number;
  mtime?: number;
}

export interface AgentFSToolCallInfo {
  id: number;
  name: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  error?: string | null;
  parameters?: unknown;
  result?: unknown;
}

export interface AgentFSKVEntry {
  key: string;
  value: unknown;
  createdAt?: number;
  updatedAt?: number;
}

export interface AgentFSChange {
  path: string;
  type: "created" | "modified" | "deleted";
  size?: number;
  mtime?: number;
}

export interface AgentFSStreamCursor {
  toolCallId?: number;
  toolCallSince?: number;
  kvUpdatedAt?: number;
}

export interface AgentFSSnapshot {
  runId: string;
  dbPath: string;
  ts: number;
  entries: AgentFSDirEntry[];
  toolCalls: AgentFSToolCallInfo[];
  kvStore: AgentFSKVEntry[];
}

export interface AgentFSStreamData {
  type: "data";
  ts: number;
  runId: string;
  dbPath: string;
  cursor: AgentFSStreamCursor;
  /**
   * Partial updates. Omitted fields mean “unchanged”.
   */
  entries?: AgentFSDirEntry[];
  toolCalls?: AgentFSToolCallInfo[];
  kvStore?: AgentFSKVEntry[];
  changes?: AgentFSChange[];
}

export interface AgentFSStreamError {
  type: "error";
  ts: number;
  code: string;
  message: string;
  retryable: boolean;
}

export interface AgentFSStreamDone {
  type: "done";
  ts: number;
  reason: "closed" | "complete";
}

export type AgentFSStreamEvent =
  | AgentFSStreamData
  | AgentFSStreamError
  | AgentFSStreamDone;
