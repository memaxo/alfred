/**
 * PoofWorkspace - Ephemeral filesystem isolation using poof.
 *
 * Provides a Workspace implementation that isolates filesystem changes
 * using Linux overlayfs via poof. Changes can be reviewed and applied.
 */

import { cpSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  applyUpperLayer,
  formatChanges,
  hasChanges,
  isPoofAvailable,
  POOF_PROFILES,
  type PoofChange,
  type PoofMode,
  type PoofProfile,
  parseUpperLayer,
  spawnIsolated,
  summarizeChanges,
} from "../spawn/index.js";
import type { ProjectConfig } from "../utils/project-detector.js";
import type { ExecOptions, ExecResult, Workspace } from "./types.js";

/** PoofWorkspace configuration */
export type PoofWorkspaceConfig = {
  /** Resource profile for poof */
  profile?: PoofProfile;
  /** Default poof mode */
  mode?: PoofMode;
  /** Enable verbose poof output */
  verbose?: boolean;
};

/**
 * Workspace implementation using poof for ephemeral filesystem isolation.
 *
 * In 'run' mode, filesystem changes are captured in an upper layer
 * and can be reviewed before being applied to the target.
 *
 * In 'exec' mode, all filesystem changes vanish when the command exits.
 */
export class PoofWorkspace implements Workspace {
  readonly kind = "poof" as const;
  private _upperDir: string | null = null;
  private _initialized = false;
  private readonly checkpoints = new Map<string, string>();

  constructor(
    readonly id: string,
    readonly runId: string,
    readonly repoBase: string,
    private readonly config: PoofWorkspaceConfig = {}
  ) {}

  /** Get the workspace root (same as repoBase for poof) */
  get root(): string {
    return this.repoBase;
  }

  /** Get the current branch (delegates to git) */
  get branch(): string | null {
    // Poof doesn't manage git branches, return null
    return null;
  }

  /** Get the upper directory containing changes */
  get upperDir(): string | null {
    return this._upperDir;
  }

  /** Get the resource profile */
  get profile(): PoofProfile {
    return this.config.profile ?? POOF_PROFILES.standard;
  }

  /** Get the poof mode */
  get mode(): PoofMode {
    return this.config.mode ?? "run";
  }

  /**
   * Initialize the workspace.
   *
   * Creates the upper directory for capturing changes.
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    if (!isPoofAvailable()) {
      throw new Error("poof_not_available");
    }

    // Create upper directory for capturing changes
    const prefix = `poof-${this.runId}-${this.id}`.replace(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    this._upperDir = path.join(tmpdir(), prefix);
    await mkdir(this._upperDir, { recursive: true });

    this._initialized = true;
  }

  /**
   * Clean up the workspace.
   *
   * Removes the upper directory and all captured changes.
   */
  async cleanup(): Promise<void> {
    if (!this._initialized) {
      return;
    }

    // Clean up checkpoints
    for (const checkpointDir of this.checkpoints.values()) {
      try {
        await rm(checkpointDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    this.checkpoints.clear();

    // Clean up upper directory
    if (this._upperDir) {
      try {
        await rm(this._upperDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      this._upperDir = null;
    }

    this._initialized = false;
  }

  /**
   * Create a checkpoint of the current upper layer state.
   */
  async checkpoint(label: string): Promise<void> {
    this.ensureInitialized();

    if (!this._upperDir) {
      return;
    }

    // Create a snapshot directory
    const snapshotDir = path.join(
      tmpdir(),
      `poof-checkpoint-${this.runId}-${this.id}-${label}`.replace(
        /[^a-zA-Z0-9-]/g,
        "-"
      )
    );

    await mkdir(snapshotDir, { recursive: true });

    // Copy current upper layer to snapshot
    cpSync(this._upperDir, snapshotDir, {
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });

    this.checkpoints.set(label, snapshotDir);
  }

  /**
   * Restore the upper layer from a checkpoint.
   */
  async restore(label: string): Promise<void> {
    this.ensureInitialized();

    const snapshotDir = this.checkpoints.get(label);
    if (!snapshotDir) {
      throw new Error(`poof_checkpoint_not_found:${label}`);
    }

    if (!this._upperDir) {
      return;
    }

    // Clear current upper layer
    await rm(this._upperDir, { recursive: true, force: true });
    await mkdir(this._upperDir, { recursive: true });

    // Restore from snapshot
    cpSync(snapshotDir, this._upperDir, {
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });
  }

  /**
   * Execute a command inside poof isolation.
   */
  async exec(
    command: string,
    options?: ExecOptions,
    projectConfig?: ProjectConfig | null
  ): Promise<ExecResult> {
    this.ensureInitialized();

    const cwd = options?.cwd ? path.join(this.root, options.cwd) : this.root;
    const timeoutMs = options?.timeoutMs ?? 300_000; // 5 minutes default

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

    const startTime = Date.now();

    // Use poof isolation
    const result = await spawnIsolated({
      mode: this.mode,
      upperDir: this._upperDir ?? undefined,
      profile: {
        ...this.profile,
        timeout: Math.ceil(timeoutMs / 1000),
      },
      cwd,
      command: ["sh", "-c", finalCommand],
      env: options?.env,
      captureStdout: true,
      captureStderr: true,
      verbose: this.config.verbose,
    });

    const durationMs = Date.now() - startTime;

    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      exitCode: result.exitCode,
      durationMs,
    };
  }

  // --- Poof-specific methods ---

  /**
   * Get changes captured in the upper layer.
   */
  async getChanges(): Promise<PoofChange[]> {
    this.ensureInitialized();

    if (!this._upperDir) {
      return [];
    }

    return parseUpperLayer(this._upperDir, this.root);
  }

  /**
   * Get a summary of changes.
   */
  async getChangeSummary() {
    const changes = await this.getChanges();
    return summarizeChanges(changes);
  }

  /**
   * Format changes as a human-readable string.
   */
  async formatChanges(): Promise<string> {
    const changes = await this.getChanges();
    return formatChanges(changes);
  }

  /**
   * Check if there are any captured changes.
   */
  async hasChanges(): Promise<boolean> {
    this.ensureInitialized();

    if (!this._upperDir) {
      return false;
    }

    return hasChanges(this._upperDir, this.root);
  }

  /**
   * Apply captured changes to the target directory.
   */
  async applyChanges(targetDir?: string): Promise<void> {
    this.ensureInitialized();

    if (!this._upperDir) {
      return;
    }

    await applyUpperLayer(this._upperDir, targetDir ?? this.root);
  }

  /**
   * Discard all captured changes.
   */
  async discardChanges(): Promise<void> {
    this.ensureInitialized();

    if (!this._upperDir) {
      return;
    }

    // Clear the upper directory contents but keep the directory
    await rm(this._upperDir, { recursive: true, force: true });
    await mkdir(this._upperDir, { recursive: true });
  }

  /**
   * Get the path to the upper directory (for inspection).
   */
  getUpperDir(): string | null {
    return this._upperDir;
  }

  private ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error("poof_workspace_not_initialized");
    }
  }
}
