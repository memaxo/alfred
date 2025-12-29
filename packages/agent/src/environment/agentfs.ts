/**
 * AgentFSWorkspace - SQLite-based agent filesystem isolation inside Docker.
 *
 * **Architecture: AgentFS runs INSIDE Docker containers.**
 *
 * Docker provides: process isolation, resource limits, network policy, seccomp.
 * AgentFS provides: audit trail, queryable state, checkpoint/restore, learning data.
 *
 * The .agentfs/*.db file is persisted via Docker volume mount so we can:
 * - Query tool calls after the container exits
 * - Feed data into the learning system
 * - Replay/debug agent sessions
 * - Snapshot mid-run for recovery
 *
 * Features:
 * - Structured audit trail of all operations
 * - Copy-on-write overlay over host directories
 * - Queryable tool call history
 * - Instant checkpoint/restore via SQLite snapshots
 *
 * Unlike Poof (Linux-only overlayfs), AgentFS is cross-platform
 * and stores all state in a single portable SQLite file.
 */

import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { logger } from "@alfred/logger";
import {
  agentfsCheckpointsTotal,
  agentfsDbSizeBytes,
  agentfsExecutionDurationSeconds,
  agentfsExecutionsTotal,
} from "../agentfs/metrics.js";
import type {
  AgentFSInterface,
  AgentFSToolCall,
  AgentFSToolCallStats,
  AgentFSWorkspaceConfig,
} from "../agentfs/types.js";
import { AlfredAgentFS } from "../agentfs/wrapper.js";
import { toolDocker } from "../orchestrator/tool/docker.js";
import type { ProjectConfig } from "../utils/project-detector.js";
import type { ExecOptions, ExecResult, Workspace } from "./types.js";

/**
 * Extended config for AgentFS workspace with Docker options.
 */
export interface AgentFSWorkspaceConfigExtended extends AgentFSWorkspaceConfig {
  /** Docker image to use (default: node:18-slim) */
  image?: string;
  /** Authorization token for Docker operations */
  authz?: string;
}

/**
 * Workspace implementation using AgentFS inside Docker containers.
 *
 * All filesystem operations are recorded in SQLite for audit/replay.
 * Commands execute inside a Docker container with the repo mounted at /workspace.
 */
export class AgentFSWorkspace implements Workspace {
  readonly kind = "agentfs" as const;
  private agent: AgentFSInterface | null = null;
  private _initialized = false;
  private readonly _dbPath: string;
  private readonly checkpoints = new Map<string, string>();

  // Docker container state
  private _containerId: string | null = null;
  private readonly _containerName: string;
  private readonly _image: string;
  private readonly _authz?: string;

  constructor(
    readonly id: string,
    readonly runId: string,
    readonly repoBase: string,
    private readonly config: AgentFSWorkspaceConfigExtended = {}
  ) {
    // Default path: .agentfs/{runId}/{agentId}.db
    this._dbPath =
      config.dbPath ??
      path.join(
        ".agentfs",
        runId.replace(/[^a-zA-Z0-9-]/g, "-"),
        `${id.replace(/[^a-zA-Z0-9-]/g, "-")}.db`
      );

    // Docker container configuration
    this._containerName = `alfred-agentfs-${runId.replace(/[^a-zA-Z0-9]/g, "-")}`;
    this._image =
      config.image ?? process.env.ORCH_DOCKER_IMAGE ?? "node:18-slim";
    this._authz = config.authz;
  }

  /** Workspace root on the host filesystem */
  get root(): string {
    return this.repoBase;
  }

  /** Git branch - not managed by AgentFS */
  get branch(): string | null {
    return null;
  }

  /** Path to the AgentFS SQLite database */
  get dbPath(): string {
    return this._dbPath;
  }

  /** Whether overlay mode is enabled */
  get isOverlay(): boolean {
    return this.config.overlay === true;
  }

  /** Docker container ID (if running) */
  get containerId(): string | null {
    return this._containerId;
  }

  /** Docker container name */
  get containerName(): string {
    return this._containerName;
  }

  /** Working directory inside the container */
  get containerCw(): string {
    return "/workspace";
  }

  /**
   * Initialize the AgentFS workspace inside a Docker container.
   *
   * 1. Creates/reuses a Docker container with repo mounted at /workspace
   * 2. Creates the database directory and opens the AgentFS connection
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    // Step 1: Create/reuse Docker container
    await this.initializeContainer();

    // Create parent directory for database
    const dbDir = path.dirname(path.resolve(this._dbPath));
    await mkdir(dbDir, { recursive: true });

    // Step 2: Initialize AgentFS (lazy-load SDK via wrapper)
    this.agent = await AlfredAgentFS.open(
      {
        id: this.id,
        path: this._dbPath,
      },
      this.runId
    );

    this._initialized = true;

    logger.info("agentfs_workspace_initialized", {
      runId: this.runId,
      agentId: this.id,
      containerId: this._containerId,
      containerName: this._containerName,
      dbPath: this._dbPath,
    });
  }

  /**
   * Initialize or reuse a Docker container for this workspace.
   */
  private async initializeContainer(): Promise<void> {
    // Check if container already exists (shared by agents in this run)
    try {
      const inspectResult = await toolDocker.execute({
        input: {
          action: "inspect",
          name: this._containerName,
          authz: this._authz,
          cw: this.repoBase,
        },
      });

      if (inspectResult.ok && inspectResult.details?.containerId) {
        this._containerId = inspectResult.details.containerId;

        // Start container if not running
        if (inspectResult.details.running === false) {
          await toolDocker.execute({
            input: {
              action: "start",
              name: this._containerName,
              authz: this._authz,
              cw: this.repoBase,
            },
          });
        }

        logger.debug("agentfs_container_reused", {
          containerId: this._containerId,
          containerName: this._containerName,
        });
        return;
      }
    } catch {
      // Container doesn't exist, create it
    }

    // Create new container with repository mounted at /workspace
    try {
      const runResult = await toolDocker.execute({
        input: {
          action: "run",
          tag: this._image,
          name: this._containerName,
          volumes: [`${this.repoBase}:/workspace`],
          resources: {
            cpus: 1.0,
            memory: "1g",
          },
          authz: this._authz,
          cw: this.repoBase,
        },
      });

      if (runResult.ok && runResult.details?.containerId) {
        this._containerId = runResult.details.containerId;
        logger.debug("agentfs_container_created", {
          containerId: this._containerId,
          containerName: this._containerName,
          image: this._image,
        });
        return;
      }
    } catch (error) {
      // Possible race condition - another agent created the container
      logger.debug("agentfs_container_create_race", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Retry inspect after potential race condition
    const retryInspect = await toolDocker.execute({
      input: {
        action: "inspect",
        name: this._containerName,
        authz: this._authz,
        cw: this.repoBase,
      },
    });

    if (retryInspect.ok && retryInspect.details?.containerId) {
      this._containerId = retryInspect.details.containerId;

      if (retryInspect.details.running === false) {
        await toolDocker.execute({
          input: {
            action: "start",
            name: this._containerName,
            authz: this._authz,
            cw: this.repoBase,
          },
        });
      }
      return;
    }

    throw new Error("agentfs_container_start_failed");
  }

  /**
   * Clean up the AgentFS workspace and Docker container.
   *
   * Closes the database connection and removes the container.
   * The .db file is preserved for audit trail and potential replay.
   */
  async cleanup(): Promise<void> {
    if (!this._initialized) {
      return;
    }

    // Clean up checkpoint snapshots
    for (const snapshotPath of this.checkpoints.values()) {
      try {
        const { unlink } = await import("node:fs/promises");
        await unlink(snapshotPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.checkpoints.clear();

    // Close AgentFS connection
    if (this.agent) {
      try {
        // Record final db size
        const dbStat = await stat(this._dbPath).catch(() => null);
        if (dbStat) {
          agentfsDbSizeBytes.set({ run_id: this.runId }, dbStat.size);
        }
      } catch {
        // Ignore stat errors
      }

      await this.agent.close();
      this.agent = null;
    }

    // Remove Docker container
    if (this._containerName) {
      try {
        await toolDocker.execute({
          input: {
            action: "rm",
            name: this._containerName,
            authz: this._authz,
            cw: this.repoBase,
          },
        });
        logger.debug("agentfs_container_removed", {
          containerName: this._containerName,
        });
      } catch {
        // Container already removed or in use - ignore
      }
    }

    this._containerId = null;
    this._initialized = false;
  }

  /**
   * Create a checkpoint of the current AgentFS state.
   *
   * Uses SQLite VACUUM INTO for atomic snapshot creation.
   * The snapshot is a complete copy of the database at this point.
   */
  async checkpoint(label: string): Promise<void> {
    const agent = this.requireAgent();

    const snapshotPath = `${this._dbPath}.checkpoint-${label.replace(/[^a-zA-Z0-9-]/g, "-")}`;

    // SQLite VACUUM INTO creates an atomic snapshot
    const didVacuum = await (async () => {
      const db = agent.getDatabase();
      if (!(db && typeof db === "object")) {
        return false;
      }
      const maybe = db as { exec?: unknown; run?: unknown };
      if (typeof maybe.exec === "function") {
        await (maybe.exec as (sql: string) => unknown)(
          `VACUUM INTO '${snapshotPath}'`
        );
        return true;
      }
      if (typeof maybe.run === "function") {
        await (maybe.run as (sql: string) => unknown)(
          `VACUUM INTO '${snapshotPath}'`
        );
        return true;
      }
      return false;
    })();

    if (!didVacuum) {
      // Fallback: copy the file directly
      await copyFile(this._dbPath, snapshotPath);
    }

    this.checkpoints.set(label, snapshotPath);
    agentfsCheckpointsTotal.inc({ operation: "create" });
  }

  /**
   * Restore AgentFS state from a checkpoint.
   *
   * Closes the current connection, replaces the database with
   * the checkpoint snapshot, and reopens the connection.
   */
  async restore(label: string): Promise<void> {
    const agent = this.requireAgent();

    const snapshotPath = this.checkpoints.get(label);
    if (!snapshotPath) {
      throw new Error(`agentfs_checkpoint_not_found:${label}`);
    }

    // Close current connection
    await agent.close();
    this.agent = null;

    // Replace database with checkpoint
    await copyFile(snapshotPath, this._dbPath);

    // Reopen connection
    this.agent = await AlfredAgentFS.open(
      {
        id: this.id,
        path: this._dbPath,
      },
      this.runId
    );

    agentfsCheckpointsTotal.inc({ operation: "restore" });
  }

  /**
   * Execute a command inside the Docker container.
   *
   * Commands execute at /workspace inside the container (mapped to repoBase).
   * All executions are tracked in AgentFS metrics.
   */
  async exec(
    command: string,
    options?: ExecOptions,
    projectConfig?: ProjectConfig | null
  ): Promise<ExecResult> {
    // Ensure the workspace has been initialized (AgentFS + container)
    this.requireAgent();

    // Resolve command via projectConfig (e.g., "test" -> "npm test")
    let finalCommand = command;
    if (projectConfig) {
      if (command === "test") {
        finalCommand = projectConfig.testCommand;
      } else if (command === "build") {
        finalCommand = projectConfig.buildCommand;
      } else if (command === "run") {
        finalCommand = projectConfig.runCommand;
      } else if (command === "install") {
        finalCommand = projectConfig.installCommand;
      }
    }

    // Calculate working directory inside container
    const workingDirectory = options?.cwd
      ? path.posix.join(this.containerCw, options.cwd)
      : this.containerCw;

    const startTime = Date.now();
    const timer = agentfsExecutionDurationSeconds.startTimer({
      command_type: command,
    });

    try {
      // Execute command inside Docker container
      const result = await toolDocker.execute({
        input: {
          action: "exec",
          name: this._containerName,
          cmd: "sh",
          args: ["-c", finalCommand],
          workingDirectory,
          env: {
            ...options?.env,
            AGENTFS_DB_PATH: this._dbPath,
            AGENTFS_RUN_ID: this.runId,
            AGENTFS_AGENT_ID: this.id,
          },
          authz: this._authz,
          timeoutSec: options?.timeoutMs
            ? Math.ceil(options.timeoutMs / 1000)
            : undefined,
          cw: this.repoBase,
        },
      });

      const durationMs = Date.now() - startTime;
      timer();

      const exitCode = result.details?.exitCode ?? 0;
      agentfsExecutionsTotal.inc({
        status: exitCode === 0 ? "success" : "failed",
        overlay: String(this.isOverlay),
      });

      return {
        stdout: result.details?.text ?? "",
        stderr: result.details?.error ?? "",
        exitCode,
        durationMs,
      };
    } catch (error) {
      timer();
      agentfsExecutionsTotal.inc({
        status: "failed",
        overlay: String(this.isOverlay),
      });

      return {
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // --- AgentFS-specific methods ---

  /**
   * Record a tool call to the AgentFS audit trail.
   *
   * This data feeds into ALFRED's learning system for
   * pattern extraction and mistake analysis.
   *
   * @returns The ID of the recorded tool call
   */
  recordToolCall(
    name: string,
    startedAt: number,
    completedAt: number,
    parameters?: unknown,
    result?: unknown,
    error?: string
  ): Promise<number> {
    const agent = this.requireAgent();
    return agent.tools.record(
      name,
      startedAt,
      completedAt,
      parameters,
      result,
      error
    );
  }

  /**
   * Get tool calls from the audit trail.
   *
   * @param since Unix timestamp to filter from (default: all)
   * @param limit Maximum number of results
   */
  getToolCalls(since?: number, limit?: number): Promise<AgentFSToolCall[]> {
    const agent = this.requireAgent();
    return agent.tools.getRecent(since ?? 0, limit);
  }

  /**
   * Get aggregated tool call statistics.
   */
  getToolStats(): Promise<AgentFSToolCallStats[]> {
    const agent = this.requireAgent();
    return agent.tools.getStats();
  }

  /**
   * Set a key-value pair in the AgentFS store.
   *
   * Useful for storing agent context, preferences, and state.
   */
  async setKV(key: string, value: unknown): Promise<void> {
    const agent = this.requireAgent();
    await agent.kv.set(key, value);
  }

  /**
   * Get a value from the AgentFS key-value store.
   */
  async getKV<T>(key: string): Promise<T | undefined> {
    const agent = this.requireAgent();
    return (await agent.kv.get(key)) as T | undefined;
  }

  /**
   * Write a file to the AgentFS virtual filesystem.
   */
  async writeFile(fsPath: string, content: string | Buffer): Promise<void> {
    const agent = this.requireAgent();
    await agent.fs.writeFile(fsPath, content);
  }

  /**
   * Read a file from the AgentFS virtual filesystem.
   */
  readFile(fsPath: string): Promise<string> {
    const agent = this.requireAgent();
    return agent.fs.readFile(fsPath);
  }

  /**
   * List files in a directory in the AgentFS virtual filesystem.
   */
  readdir(fsPath: string): Promise<string[]> {
    const agent = this.requireAgent();
    return agent.fs.readdir(fsPath);
  }

  /**
   * Get the underlying AgentFS interface for advanced operations.
   */
  getAgent(): AgentFSInterface {
    return this.requireAgent();
  }

  private requireAgent(): AgentFSInterface {
    const agent = this.agent;
    if (!(this._initialized && agent)) {
      throw new Error("agentfs_workspace_not_initialized");
    }
    return agent;
  }
}

/**
 * Type guard for AgentFSWorkspace.
 */
export function isAgentFSWorkspace(
  workspace: unknown
): workspace is AgentFSWorkspace {
  if (!workspace || typeof workspace !== "object") {
    return false;
  }
  const w = workspace as {
    kind?: unknown;
    dbPath?: unknown;
    recordToolCall?: unknown;
  };
  return (
    w.kind === "agentfs" &&
    typeof w.dbPath === "string" &&
    typeof w.recordToolCall === "function"
  );
}
