/**
 * ALFRED-specific AgentFS wrapper.
 *
 * Provides:
 * - Lazy SDK loading (avoids bundling issues)
 * - ALFRED-compatible error handling
 * - Integration hooks for metrics and logging
 * - Factory functions for common patterns
 */

import { logger } from "@alfred/logger";

import type { AgentFSSDK } from "./sdk.js";
import type {
  AgentFSChange,
  AgentFSInitOptions,
  AgentFSInterface,
  AgentFSKVEntry,
  AgentFSReadFileOptions,
  AgentFSToolCall,
  AgentFSToolCallStats,
} from "./types.js";

import {
  agentfsActiveWorkspaces,
  agentfsKvOpsTotal,
  agentfsOperationLatencyMs,
  agentfsToolCallsTotal,
} from "./metrics.js";

// Cached SDK module
let _agentFSModule: AgentFSSDK | null = null;

/**
 * Lazy-load the AgentFS SDK to avoid bundling issues.
 *
 * The SDK is loaded on first use rather than at module load time.
 * This prevents issues with tree-shaking and allows the SDK to
 * be an optional dependency.
 */
async function loadSDK(): Promise<AgentFSSDK> {
  if (_agentFSModule) {
    return _agentFSModule;
  }

  try {
    _agentFSModule = await import("agentfs-sdk");
    logger.debug("agentfs_sdk_loaded");
    return _agentFSModule;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("agentfs_sdk_load_failed", { err: msg });
    throw new AgentFSError(
      "SDK_LOAD_FAILED",
      `Failed to load agentfs-sdk: ${msg}. Install with: bun add agentfs-sdk`
    );
  }
}

/**
 * ALFRED-specific error class for AgentFS operations.
 */
export class AgentFSError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "AgentFSError";
  }
}

/**
 * Wrapped AgentFS instance with ALFRED integrations.
 *
 * Provides the same interface as AgentFSInterface but with:
 * - Automatic metrics collection
 * - Structured logging
 * - Error normalization
 */
export class AlfredAgentFS implements AgentFSInterface {
  private constructor(
    private readonly inner: AgentFSInterface,
    private readonly agentId: string,
    private readonly runId?: string
  ) {}

  /**
   * Open an AgentFS database with ALFRED integrations.
   *
   * @param options AgentFS initialization options
   * @param runId Optional run ID for metrics labeling
   */
  static async open(
    options: AgentFSInitOptions,
    runId?: string
  ): Promise<AlfredAgentFS> {
    const sdk = await loadSDK();
    const AgentFS =
      sdk.AgentFS ??
      (sdk as unknown as { default?: { AgentFS?: unknown } }).default?.AgentFS;

    if (!AgentFS?.open) {
      throw new AgentFSError("SDK_INVALID", "AgentFS.open not found in SDK");
    }

    const startTime = Date.now();
    try {
      const inner = (await AgentFS.open(
        options
      )) as unknown as AgentFSInterface;
      const duration = Date.now() - startTime;

      logger.debug("agentfs_opened", {
        agentId: options.id,
        duration,
        path: options.path,
      });
      agentfsActiveWorkspaces.inc();
      agentfsOperationLatencyMs.observe({ operation_type: "open" }, duration);

      return new AlfredAgentFS(inner, options.id ?? "ephemeral", runId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("agentfs_open_failed", { err: msg, options });
      throw new AgentFSError(
        "OPEN_FAILED",
        `Failed to open AgentFS: ${msg}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Close the AgentFS connection.
   */
  async close(): Promise<void> {
    const startTime = Date.now();
    try {
      await this.inner.close();
      agentfsActiveWorkspaces.dec();
      agentfsOperationLatencyMs.observe(
        { operation_type: "close" },
        Date.now() - startTime
      );
      logger.debug("agentfs_closed", {
        agentId: this.agentId,
        runId: this.runId,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("agentfs_close_failed", { err: msg });
      throw new AgentFSError(
        "CLOSE_FAILED",
        `Failed to close AgentFS: ${msg}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get the underlying database for advanced operations.
   */
  getDatabase(): unknown {
    return this.inner.getDatabase();
  }

  // --- Key-Value Store ---

  kv = {
    delete: async (key: string): Promise<void> => {
      const startTime = Date.now();
      try {
        await this.inner.kv.delete(key);
        agentfsKvOpsTotal.inc({ operation: "delete" });
        agentfsOperationLatencyMs.observe(
          { operation_type: "kv" },
          Date.now() - startTime
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError(
          "KV_DELETE_FAILED",
          `Failed to delete ${key}: ${msg}`
        );
      }
    },

    get: async <T = unknown>(key: string): Promise<T | undefined> => {
      const startTime = Date.now();
      try {
        const result = await this.inner.kv.get(key);
        agentfsKvOpsTotal.inc({ operation: "get" });
        agentfsOperationLatencyMs.observe(
          { operation_type: "kv" },
          Date.now() - startTime
        );
        return result as T | undefined;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError("KV_GET_FAILED", `Failed to get ${key}: ${msg}`);
      }
    },

    list: async (prefix?: string): Promise<AgentFSKVEntry[]> => {
      const startTime = Date.now();
      try {
        const result = await this.inner.kv.list(prefix);
        agentfsKvOpsTotal.inc({ operation: "list" });
        agentfsOperationLatencyMs.observe(
          { operation_type: "kv" },
          Date.now() - startTime
        );
        // Normalize result to match our interface
        return result.map((entry: { key: string; value: unknown }) => {
          const rec = entry as unknown as {
            key: string;
            value: unknown;
            created_at?: unknown;
            updated_at?: unknown;
          };
          return {
            key: rec.key,
            value: rec.value,
            created_at:
              typeof rec.created_at === "number" ? rec.created_at : undefined,
            updated_at:
              typeof rec.updated_at === "number" ? rec.updated_at : undefined,
          };
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError("KV_LIST_FAILED", `Failed to list keys: ${msg}`);
      }
    },

    set: async (key: string, value: unknown): Promise<void> => {
      const startTime = Date.now();
      try {
        await this.inner.kv.set(key, value);
        agentfsKvOpsTotal.inc({ operation: "set" });
        agentfsOperationLatencyMs.observe(
          { operation_type: "kv" },
          Date.now() - startTime
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError("KV_SET_FAILED", `Failed to set ${key}: ${msg}`);
      }
    },
  };

  // --- Filesystem Operations ---

  fs = {
    deleteFile: async (path: string): Promise<void> => {
      const startTime = Date.now();
      try {
        await this.inner.fs.deleteFile(path);
        agentfsOperationLatencyMs.observe(
          { operation_type: "fs" },
          Date.now() - startTime
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError(
          "FS_DELETE_FAILED",
          `Failed to delete ${path}: ${msg}`
        );
      }
    },

    readFile: async (
      path: string,
      options?: AgentFSReadFileOptions
    ): Promise<string | Buffer> => {
      const startTime = Date.now();
      try {
        const result = await this.inner.fs.readFile(path, options ?? "utf8");
        agentfsOperationLatencyMs.observe(
          { operation_type: "fs" },
          Date.now() - startTime
        );
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError(
          "FS_READ_FAILED",
          `Failed to read ${path}: ${msg}`
        );
      }
    },

    readdir: async (path: string): Promise<string[]> => {
      const startTime = Date.now();
      try {
        const result = await this.inner.fs.readdir(path);
        agentfsOperationLatencyMs.observe(
          { operation_type: "fs" },
          Date.now() - startTime
        );
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError(
          "FS_READDIR_FAILED",
          `Failed to read directory ${path}: ${msg}`
        );
      }
    },

    stat: async (path: string) => {
      const startTime = Date.now();
      try {
        const result = await this.inner.fs.stat(path);
        agentfsOperationLatencyMs.observe(
          { operation_type: "fs" },
          Date.now() - startTime
        );
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError(
          "FS_STAT_FAILED",
          `Failed to stat ${path}: ${msg}`
        );
      }
    },

    writeFile: async (
      path: string,
      content: string | Buffer
    ): Promise<void> => {
      const startTime = Date.now();
      try {
        await this.inner.fs.writeFile(path, content);
        agentfsOperationLatencyMs.observe(
          { operation_type: "fs" },
          Date.now() - startTime
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError(
          "FS_WRITE_FAILED",
          `Failed to write ${path}: ${msg}`
        );
      }
    },
  };

  /**
   * Get filesystem changes (diff) for this session.
   */
  async diff(): Promise<AgentFSChange[]> {
    const startTime = Date.now();
    try {
      // If the SDK has a native diff method, use it
      const innerWithDiff = this.inner as unknown as {
        diff?: () => Promise<AgentFSChange[]>;
      };
      if (typeof innerWithDiff.diff === "function") {
        return await innerWithDiff.diff();
      }

      // Fallback: Query the fs_nodes table for changed/deleted/created files
      // This requires the underlying database handle
      const db = this.getDatabase() as unknown;
      const dbWithAll = db as { all?: unknown };
      if (db && typeof dbWithAll.all === "function") {
        const rows = await (
          dbWithAll as { all: (query: string) => Promise<unknown[]> }
        ).all(`
          SELECT path, 
                 CASE 
                   WHEN deleted = 1 THEN 'deleted'
                   WHEN created_at = updated_at THEN 'created'
                   ELSE 'modified'
                 END as type,
                 size,
                 updated_at as mtime
          FROM fs_nodes
          WHERE deleted = 1 OR created_at IS NOT NULL
        `);
        return rows as AgentFSChange[];
      }

      return [];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("agentfs_diff_failed", { err: msg });
      throw new AgentFSError("DIFF_FAILED", `Failed to get diff: ${msg}`);
    } finally {
      agentfsOperationLatencyMs.observe(
        { operation_type: "diff" },
        Date.now() - startTime
      );
    }
  }

  // --- Tool Call Tracking ---

  tools = {
    get: async (id: number): Promise<AgentFSToolCall | undefined> => {
      try {
        return await this.inner.tools.get(id);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError(
          "TOOL_GET_FAILED",
          `Failed to get tool call ${id}: ${msg}`
        );
      }
    },

    getByName: async (
      name: string,
      limit?: number
    ): Promise<AgentFSToolCall[]> => {
      try {
        return await this.inner.tools.getByName(name, limit);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError(
          "TOOL_GET_BY_NAME_FAILED",
          `Failed to get tool calls for ${name}: ${msg}`
        );
      }
    },

    getRecent: async (
      since: number,
      limit?: number
    ): Promise<AgentFSToolCall[]> => {
      try {
        return await this.inner.tools.getRecent(since, limit);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError(
          "TOOL_GET_RECENT_FAILED",
          `Failed to get recent tool calls: ${msg}`
        );
      }
    },

    getStats: async (): Promise<AgentFSToolCallStats[]> => {
      try {
        return await this.inner.tools.getStats();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError(
          "TOOL_GET_STATS_FAILED",
          `Failed to get tool stats: ${msg}`
        );
      }
    },

    record: async (
      name: string,
      startedAt: number,
      completedAt: number,
      parameters?: unknown,
      result?: unknown,
      error?: string
    ): Promise<number> => {
      const startTime = Date.now();
      try {
        const id = await this.inner.tools.record(
          name,
          startedAt,
          completedAt,
          parameters,
          result,
          error
        );

        agentfsToolCallsTotal.inc({
          tool_name: name,
          status: error ? "error" : "success",
        });
        agentfsOperationLatencyMs.observe(
          { operation_type: "tools" },
          Date.now() - startTime
        );

        logger.debug("agentfs_tool_recorded", {
          agentId: this.agentId,
          toolName: name,
          toolCallId: id,
          hasError: !!error,
        });

        return id;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AgentFSError(
          "TOOL_RECORD_FAILED",
          `Failed to record tool call ${name}: ${msg}`
        );
      }
    },
  };
}

/**
 * Create an ephemeral (in-memory) AgentFS instance.
 *
 * Useful for testing and short-lived operations that don't
 * need persistence.
 */
export function createEphemeralAgentFS(): Promise<AlfredAgentFS> {
  return AlfredAgentFS.open({
    id: `ephemeral-${Date.now().toString(36)}`,
  });
}

/**
 * Create a persistent AgentFS instance for a workflow run.
 *
 * The database is stored at `.agentfs/{runId}/agentfs.db`
 * for later analysis and learning.
 *
 * @param runId Workflow run identifier
 * @param agentId Agent identifier
 * @param basePath Base path for the database (default: current directory)
 */
export function createRunAgentFS(
  runId: string,
  agentId: string,
  basePath?: string
): Promise<AlfredAgentFS> {
  const sanitizedRunId = runId.replaceAll(/[^a-zA-Z0-9-]/g, "-");
  const dbPath = basePath
    ? `${basePath}/.agentfs/${sanitizedRunId}/agentfs.db`
    : `.agentfs/${sanitizedRunId}/agentfs.db`;

  return AlfredAgentFS.open(
    {
      id: agentId,
      path: dbPath,
    },
    runId
  );
}

/**
 * Check if the AgentFS SDK is available.
 *
 * Returns true if the SDK can be loaded, false otherwise.
 * Useful for feature detection and graceful fallback.
 */
export async function isAgentFSAvailable(): Promise<boolean> {
  try {
    await loadSDK();
    return true;
  } catch {
    return false;
  }
}

// Re-export error class
export { AgentFSError as AgentFSWrapperError };
