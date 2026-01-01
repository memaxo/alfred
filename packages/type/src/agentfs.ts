/**
 * AgentFS stream DTOs (shared across API + TUI).
 *
 * JSON-serialisable by design.
 */

export type AgentFSDirEntry = {
  name: string;
  ino: number;
  isDirectory: boolean;
  size?: number;
  mtime?: number;
};

export type AgentFSToolCallInfo = {
  id: number;
  name: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  error?: string | null;
  parameters?: unknown;
  result?: unknown;
};

export type AgentFSKVEntry = {
  key: string;
  value: unknown;
  createdAt?: number;
  updatedAt?: number;
};

export type AgentFSStreamCursor = {
  toolCallId?: number;
  toolCallSince?: number;
  kvUpdatedAt?: number;
};

export type AgentFSSnapshot = {
  runId: string;
  dbPath: string;
  ts: number;
  entries: AgentFSDirEntry[];
  toolCalls: AgentFSToolCallInfo[];
  kvStore: AgentFSKVEntry[];
};

export type AgentFSStreamData = {
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
};

export type AgentFSStreamError = {
  type: "error";
  ts: number;
  code: string;
  message: string;
  retryable: boolean;
};

export type AgentFSStreamDone = {
  type: "done";
  ts: number;
  reason: "closed" | "complete";
};

export type AgentFSStreamEvent =
  | AgentFSStreamData
  | AgentFSStreamError
  | AgentFSStreamDone;
