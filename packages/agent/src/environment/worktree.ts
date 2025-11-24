import path from "node:path";
import { toolRunner } from "../orchestrator/tool/runner";
import {
  type WorktreeHandle,
  worktreeManager,
} from "../orchestrator/tool/worktree";
import type { ProjectConfig } from "../utils/project-detector";
import type { ExecOptions, ExecResult, Workspace } from "./types";

export class WorktreeWorkspace implements Workspace {
  readonly kind: "worktree" | "container" = "worktree";
  private _handle: WorktreeHandle | null = null;

  constructor(
    readonly id: string,
    readonly runId: string,
    readonly repoBase: string // The main repo path
  ) {}

  get root(): string {
    if (!this._handle) {
      throw new Error("Workspace not initialized");
    }
    return this._handle.path;
  }

  get branch(): string | null {
    return this._handle?.branch ?? null;
  }

  async initialize(): Promise<void> {
    this._handle = await worktreeManager.create(
      this.repoBase,
      this.runId,
      this.id
    );
  }

  async cleanup(): Promise<void> {
    if (this._handle) {
      await worktreeManager.remove(this.repoBase, this._handle.path);
      this._handle = null;
    }
  }

  async checkpoint(label: string): Promise<void> {
    const tagName = `checkpoint/${this.runId}/${this.id}/${label}`;
    // Force tag creation at current HEAD
    await toolRunner.execute(`git tag -f ${tagName}`, this.root);
  }

  async restore(label: string): Promise<void> {
    const tagName = `checkpoint/${this.runId}/${this.id}/${label}`;
    // Hard reset to tag
    await toolRunner.execute(`git reset --hard ${tagName}`, this.root);
    // Clean untracked files
    await toolRunner.execute("git clean -fd", this.root);
  }

  async exec(
    command: string,
    options?: ExecOptions,
    projectConfig?: ProjectConfig | null
  ): Promise<ExecResult> {
    const cwd = options?.cwd ? path.join(this.root, options.cwd) : this.root;
    // Use toolRunner which handles projectConfig mapping (e.g. "test" -> "cargo test")
    return toolRunner.execute(
      command,
      cwd,
      options?.timeoutMs,
      projectConfig ?? undefined
    );
  }
}
