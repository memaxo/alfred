/**
 * AgentFS TypeScript types for ALFRED integration.
 *
 * These types mirror the AgentFS SDK and SPEC.md schema,
 * adapted for ALFRED's conventions.
 */

/**
 * Tool call record from AgentFS audit trail.
 * Corresponds to the `tool_calls` table in AgentFS schema.
 */
export type AgentFSToolCall = {
  id: number;
  name: string;
  parameters?: unknown;
  result?: unknown;
  error?: string;
  started_at: number; // Unix timestamp (seconds)
  completed_at: number; // Unix timestamp (seconds)
  duration_ms: number;
};

/**
 * Aggregated tool call statistics.
 */
export type AgentFSToolCallStats = {
  name: string;
  total_calls: number;
  successful: number;
  failed: number;
  avg_duration_ms: number;
};

/**
 * Key-value entry from AgentFS kv_store.
 * Note: The SDK returns a simpler format, timestamps may be optional.
 */
export type AgentFSKVEntry = {
  key: string;
  value: unknown; // JSON-deserialized
  created_at?: number; // Unix timestamp (optional in some SDK versions)
  updated_at?: number; // Unix timestamp (optional in some SDK versions)
};

/**
 * File stat information from AgentFS virtual filesystem.
 * Mirrors POSIX stat structure.
 */
export type AgentFSStats = {
  ino: number;
  mode: number;
  nlink: number;
  uid: number;
  gid: number;
  size: number;
  atime: number; // Unix timestamp
  mtime: number; // Unix timestamp
  ctime: number; // Unix timestamp
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
};

/**
 * Directory entry from AgentFS virtual filesystem.
 */
export type AgentFSDirEntry = {
  name: string;
  ino: number;
  parentIno: number;
};

/**
 * AgentFS workspace configuration.
 */
export type AgentFSWorkspaceConfig = {
  /** Enable overlay mode over base directory (copy-on-write) */
  overlay?: boolean;
  /** Custom database path (default: .agentfs/{runId}/agentfs.db) */
  dbPath?: string;
  /** Chunk size for file storage (default: 4096) */
  chunkSize?: number;
};

/**
 * AgentFS initialization options.
 */
export type AgentFSInitOptions = {
  /** Agent identifier */
  id: string;
  /** Database file path */
  path?: string;
  /** Base directory for overlay mode */
  base?: string;
};

/**
 * AgentFS SDK interface (subset used by ALFRED).
 * Full interface available in agentfs-sdk package.
 */
export type AgentFSInterface = {
  /** Key-value store operations */
  kv: {
    set(key: string, value: unknown): Promise<void>;
    get<T = unknown>(key: string): Promise<T | undefined>;
    delete(key: string): Promise<void>;
    list(prefix?: string): Promise<AgentFSKVEntry[]>;
  };

  /** Filesystem operations */
  fs: {
    writeFile(path: string, content: string | Buffer): Promise<void>;
    readFile(path: string): Promise<string>;
    readdir(path: string): Promise<string[]>;
    deleteFile(path: string): Promise<void>;
    stat(path: string): Promise<AgentFSStats>;
  };

  /** Tool call tracking */
  tools: {
    record(
      name: string,
      startedAt: number,
      completedAt: number,
      parameters?: unknown,
      result?: unknown,
      error?: string
    ): Promise<number>;
    get(id: number): Promise<AgentFSToolCall | undefined>;
    getByName(name: string, limit?: number): Promise<AgentFSToolCall[]>;
    getRecent(since: number, limit?: number): Promise<AgentFSToolCall[]>;
    getStats(): Promise<AgentFSToolCallStats[]>;
  };

  /** Get underlying database for advanced queries */
  getDatabase(): unknown;

  /** Close the AgentFS connection */
  close(): Promise<void>;
};

/**
 * Environment kind for codex run recording.
 * AgentFS is the only supported execution environment.
 */
export type AgentFSEnvironmentKind = "agentfs";

/**
 * AgentFS run metadata for codex recording.
 */
export type AgentFSRunMetadata = {
  environmentKind: AgentFSEnvironmentKind;
  agentfsDbPath?: string;
  agentfsRunId?: string;
  /** @deprecated Use agentfsDbPath instead */
  poofUpperDir?: string;
  /** @deprecated Removed in agentfs migration */
  poofProfile?: string;
};
