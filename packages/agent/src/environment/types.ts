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

/**
 * Workspace environment kind.
 *
 * Production builds use "container" only.
 * Development builds with feature flags can include legacy types.
 *
 * Build commands:
 *   Production: bun build ./src/index.ts --outdir ./dist
 *   Development: bun build --feature=LEGACY_WORKTREE --feature=LEGACY_POOF ./src/index.ts
 */
export type WorkspaceKind = "container" | "worktree" | "poof" | "host";

/**
 * Production-only workspace kind (container isolation).
 * Use this type when you want to enforce container-only at compile time.
 */
export type ProductionWorkspaceKind = "container";

export type Workspace = {
  readonly id: string;
  readonly kind: WorkspaceKind;
  readonly root: string; // Absolute path on HOST machine (for file ops)
  readonly branch?: string | null; // Active git branch when applicable

  /**
   * Prepare the environment (e.g. docker run)
   */
  initialize(): Promise<void>;

  /**
   * Destroy the environment (e.g. docker rm)
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

export type ContainerWorkspace = Workspace & {
  readonly kind: "container";
  /** Docker container identifier (or name) used for execution. */
  readonly containerId: string;
  /** Stable container name for this run. */
  readonly containerName: string;
  /** Working directory inside the container corresponding to `root`. */
  readonly containerCw: string;
};

export function isContainerWorkspace(workspace: Workspace): workspace is ContainerWorkspace {
  return (
    workspace.kind === "container" &&
    "containerId" in workspace &&
    "containerName" in workspace &&
    "containerCw" in workspace
  );
}

/**
 * Type guard for PoofWorkspace-specific methods.
 * Only available when built with --feature=LEGACY_POOF.
 */
export function isPoofWorkspace(
  workspace: Workspace
): workspace is Workspace & {
  hasChanges(): Promise<boolean>;
  getChanges(): Promise<PoofChange[]>;
  applyChanges(targetDir?: string): Promise<void>;
} {
  return workspace.kind === "poof" && "hasChanges" in workspace;
}

/**
 * Poof change type (legacy).
 * Only used when built with --feature=LEGACY_POOF.
 */
export type PoofChange = {
  path: string;
  type: "added" | "modified" | "deleted";
  isDirectory: boolean;
};
