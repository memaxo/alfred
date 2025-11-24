import type { ProjectConfig } from "../utils/project-detector";

export type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
};

export type ExecOptions = {
  cwd?: string; // Relative to workspace root
  env?: Record<string, string>;
  timeoutMs?: number;
};

export type Workspace = {
  readonly id: string;
  readonly kind: "host" | "worktree" | "container";
  readonly root: string; // Absolute path on HOST machine (for file ops)
  readonly branch?: string | null; // Active git branch when applicable

  /**
   * Prepare the environment (e.g. git worktree add, docker run)
   */
  initialize(): Promise<void>;

  /**
   * Destroy the environment (e.g. git worktree remove, docker rm)
   */
  cleanup(): Promise<void>;

  /**
   * Create a recovery point (e.g. git tag)
   */
  checkpoint(label: string): Promise<void>;

  /**
   * Revert to a recovery point (e.g. git reset --hard)
   */
  restore(label: string): Promise<void>;

  /**
   * Execute a command in the environment
   */
  exec(
    command: string,
    options?: ExecOptions,
    projectConfig?: ProjectConfig | null
  ): Promise<ExecResult>;

  /**
   * Optional persistent session helpers (tmux-backed).
   */
  startSession?(command: string, sessionId?: string): Promise<string>;
  stopSession?(sessionId: string): Promise<void>;
  listSessions?(): Promise<string[]>;
};
