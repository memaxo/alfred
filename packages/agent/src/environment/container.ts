import path from "node:path";
import { toolDocker } from "../orchestrator/tool/docker";
import type { ProjectConfig } from "../utils/project-detector";
import type { ExecOptions, ExecResult } from "./types";
import { WorktreeWorkspace } from "./worktree";

export class ContainerWorkspace extends WorktreeWorkspace {
  override readonly kind = "container";
  private _containerId: string | null = null;
  private readonly _containerName: string;

  constructor(
    id: string,
    runId: string,
    repoBase: string,
    readonly image = process.env.ORCH_DOCKER_IMAGE || "node:18-slim",
    readonly authz?: string,
    enableSessions?: boolean
  ) {
    super(id, runId, repoBase, { enableSessions });
    // Shared container per run
    this._containerName = `alfred-runtime-${runId.replace(/[^a-zA-Z0-9]/g, "-")}`;
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

  get containerCw(): string {
    const relativePath = path.relative(this.repoBase, this.root);
    const safeRelative =
      relativePath === "" || !(relativePath.startsWith("..") || path.isAbsolute(relativePath))
        ? relativePath
        : "";
    const relativePosix = safeRelative.split(path.sep).join(path.posix.sep);
    return relativePosix.length > 0
      ? path.posix.join("/workspace", relativePosix)
      : "/workspace";
  }

  async initialize(): Promise<void> {
    // 1. Create worktree first (Host isolation)
    await super.initialize();

    // 2. Find or start shared container
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

    // We mount the entire repoBase to /workspace so that all worktrees (which are under repoBase) are accessible.
    // .agent/worktrees/<runId>/<agentId> -> /workspace/.agent/worktrees/<runId>/<agentId>
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
      // Likely already created by another workspace; fall through to retry inspect.
    }

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

  async cleanup(): Promise<void> {
    // 1. Try to kill container (best effort)
    // In shared mode, the first cleanup might kill it for others if we are not careful.
    // However, cleanup is typically called at the end of the run.
    // If called concurrently, subsequent calls will fail to stop/rm, which we ignore.
    if (this._containerName) {
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
        // ignore - likely already removed or in use
      }
      this._containerId = null;
    }
    // 2. Kill worktree
    await super.cleanup();
  }

  exec(
    command: string,
    options?: ExecOptions,
    projectConfig?: ProjectConfig | null
  ): Promise<ExecResult> {
    // Resolve command via projectConfig
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

    // Calculate working directory relative to repoBase
    // Host: this.root (worktree path)
    // Container mount: /workspace
    // We need the relative path from repoBase to this.root
    const startedAt = Date.now();

    return toolDocker
      .execute({
        input: {
          action: "exec",
          name: this._containerName, // Use name instead of ID for stability
          cmd: "sh",
          args: ["-c", finalCommand],
          workingDirectory: this.containerCw,
          env: options?.env,
          authz: this.authz,
          timeoutSec: options?.timeoutMs
            ? Math.ceil(options.timeoutMs / 1000)
            : undefined,
          cw: this.repoBase,
        },
      })
      .then((result) => ({
        stdout: result.details?.text ?? "",
        stderr: result.details?.error ?? "",
        exitCode: result.details?.exitCode ?? 0,
        durationMs: Date.now() - startedAt,
      }));
  }
}
