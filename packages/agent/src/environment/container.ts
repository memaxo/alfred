import path from "node:path";
import { toolDocker } from "../orchestrator/tool/docker";
import type { ProjectConfig } from "../utils/project-detector";
import type { ExecOptions, ExecResult, Workspace } from "./types";

/**
 * ContainerWorkspace - Docker-based agent execution environment.
 *
 * Provides complete isolation via Docker containers:
 * - Repository mounted at /workspace via volume
 * - Git operations executed inside container
 * - Resource limits (CPU, memory) enforced by Docker
 * - No host-side worktrees required
 *
 * Container ownership: 1 container per workflow run, shared by all agents.
 */
export class ContainerWorkspace implements Workspace {
  readonly kind = "container" as const;
  private _containerId: string | null = null;
  private readonly _containerName: string;

  constructor(
    readonly id: string,
    readonly runId: string,
    readonly repoBase: string,
    readonly image = process.env.ORCH_DOCKER_IMAGE || "node:18-slim",
    readonly authz?: string,
    // Sessions not implemented for container workspaces
    _enableSessions?: boolean
  ) {
    void _enableSessions; // Unused - sessions require tmux in container
    // Shared container per run - all agents in this run share the same container
    this._containerName = `alfred-runtime-${runId.replace(/[^a-zA-Z0-9]/g, "-")}`;
  }

  /**
   * Workspace root on the host filesystem.
   * For container workspaces, this is the mounted repository root.
   */
  get root(): string {
    return this.repoBase;
  }

  /**
   * Git branch - not tracked for container workspaces.
   * Git operations happen inside the container, not on the host.
   */
  get branch(): string | null {
    return null;
  }

  get containerName(): string {
    return this._containerName;
  }

  get containerId(): string {
    if (!this._containerId) {
      throw new Error("Container not initialized");
    }
    return this._containerId;
  }

  /**
   * Working directory inside the container.
   * Maps host repoBase to /workspace inside container.
   */
  get containerCw(): string {
    return "/workspace";
  }

  /**
   * Initialize the container workspace.
   *
   * Creates or reuses a shared container for this workflow run.
   * The repository is mounted at /workspace via Docker volume.
   */
  async initialize(): Promise<void> {
    // Check if container already exists (shared by other agents in this run)
    let inspectResult:
      | Awaited<ReturnType<typeof toolDocker.execute>>
      | undefined;
    try {
      inspectResult = await toolDocker.execute({
        input: {
          action: "inspect",
          name: this._containerName,
          authz: this.authz,
          cw: this.repoBase,
        },
      });
    } catch {
      inspectResult = undefined;
    }

    // Container exists - reuse it
    if (inspectResult?.ok && inspectResult.details?.containerId) {
      this._containerId = inspectResult.details.containerId;
      if (inspectResult.details.running === false) {
        await toolDocker.execute({
          input: {
            action: "start",
            name: this._containerName,
            authz: this.authz,
            cw: this.repoBase,
          },
        });
      }
      return;
    }

    // Create new container with repository mounted at /workspace
    try {
      const started = await toolDocker.execute({
        input: {
          action: "run",
          tag: this.image,
          name: this._containerName,
          volumes: [`${this.repoBase}:/workspace`],
          resources: {
            cpus: 1.0,
            memory: "1g",
          },
          authz: this.authz,
          cw: this.repoBase,
        },
      });

      if (started.ok && started.details?.containerId) {
        this._containerId = started.details.containerId;
        return;
      }
    } catch {
      // Likely race condition - another agent created the container
      // Fall through to retry inspect
    }

    // Retry inspect after potential race condition
    const retryInspect = await toolDocker.execute({
      input: {
        action: "inspect",
        name: this._containerName,
        authz: this.authz,
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
            authz: this.authz,
            cw: this.repoBase,
          },
        });
      }
      return;
    }

    throw new Error("docker_container_start_failed");
  }

  /**
   * Clean up the container workspace.
   *
   * Removes the shared container. In multi-agent scenarios, the first
   * cleanup call removes the container - subsequent calls are no-ops.
   */
  async cleanup(): Promise<void> {
    if (!this._containerName) {
      return;
    }

    try {
      await toolDocker.execute({
        input: {
          action: "rm",
          name: this._containerName,
          authz: this.authz,
          cw: this.repoBase,
        },
      });
    } catch {
      // Container already removed or in use by another agent - ignore
    }

    this._containerId = null;
  }

  /**
   * Create a checkpoint (git tag) inside the container.
   */
  async checkpoint(label: string): Promise<void> {
    const tagName = `checkpoint/${this.runId}/${this.id}/${label}`;
    await this.execGit(["tag", "-f", tagName]);
  }

  /**
   * Restore to a checkpoint (git reset) inside the container.
   */
  async restore(label: string): Promise<void> {
    const tagName = `checkpoint/${this.runId}/${this.id}/${label}`;
    await this.execGit(["reset", "--hard", tagName]);
    await this.execGit(["clean", "-fd"]);
  }

  /**
   * Execute a command inside the container.
   */
  async exec(
    command: string,
    options?: ExecOptions,
    projectConfig?: ProjectConfig | null
  ): Promise<ExecResult> {
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

    const startedAt = Date.now();

    const result = await toolDocker.execute({
      input: {
        action: "exec",
        name: this._containerName,
        cmd: "sh",
        args: ["-c", finalCommand],
        workingDirectory,
        env: options?.env,
        authz: this.authz,
        timeoutSec: options?.timeoutMs
          ? Math.ceil(options.timeoutMs / 1000)
          : undefined,
        cw: this.repoBase,
      },
    });

    return {
      stdout: result.details?.text ?? "",
      stderr: result.details?.error ?? "",
      exitCode: result.details?.exitCode ?? 0,
      durationMs: Date.now() - startedAt,
    };
  }

  /**
   * Execute a git command inside the container.
   */
  private async execGit(args: string[]): Promise<ExecResult> {
    const startedAt = Date.now();

    const result = await toolDocker.execute({
      input: {
        action: "exec",
        name: this._containerName,
        cmd: "git",
        args,
        workingDirectory: this.containerCw,
        authz: this.authz,
        cw: this.repoBase,
      },
    });

    return {
      stdout: result.details?.text ?? "",
      stderr: result.details?.error ?? "",
      exitCode: result.details?.exitCode ?? 0,
      durationMs: Date.now() - startedAt,
    };
  }

  // Session methods are not supported in container workspaces
  // Sessions require tmux which may not be available in all container images
}
