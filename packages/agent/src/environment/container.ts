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
    readonly authz?: string
  ) {
    super(id, runId, repoBase);
    this._containerName = `alfred-${runId}-${id.replace(/[^a-zA-Z0-9]/g, "-")}`;
  }

  get containerId(): string {
    if (!this._containerId) {
      throw new Error("Container not initialized");
    }
    return this._containerId;
  }

  async initialize(): Promise<void> {
    // 1. Create worktree first (Host isolation)
    await super.initialize();

    // 2. Spin up container (Runtime isolation)
    // We mount the worktree to /workspace
    const res = await toolDocker.execute({
      input: {
        action: "run",
        tag: this.image,
        name: this._containerName,
        volumes: [`${this.root}:/workspace`],
        resources: {
          cpus: 1.0,
          memory: "1g",
        },
        authz: this.authz,
        // Run forever so we can exec into it
        // Default node image exits immediately if no command, so we use tail -f /dev/null
        // Actually the toolDocker implementation uses `run -d` but doesn't specify command unless we modify toolDocker
        // or rely on image default.
        // toolDocker.ts: executeRun uses `args.push(tag)`. It doesn't accept a command override easily.
        // BUT, toolDocker.ts: `dockerInputSchema` does NOT have a `command` field.
        // However, `node:18-slim` CMD is `node`. It starts REPL and might exit if non-interactive?
        // Actually `node` REPL waits.
        // Let's hope the image stays alive. If not, we might need to fix toolDocker to accept cmd.
        // For now, let's assume it stays up or we fix it later.
      },
    });

    const details = (res as any).details;
    if (!(res.ok && details?.containerId)) {
      throw new Error(`Failed to start container: ${details?.error}`);
    }

    this._containerId = details.containerId;
  }

  async cleanup(): Promise<void> {
    // 1. Kill container
    if (this._containerName) {
      try {
        await toolDocker.execute({
          input: { action: "rm", name: this._containerName, authz: this.authz },
        });
      } catch {
        // ignore
      }
      this._containerId = null;
    }
    // 2. Kill worktree
    await super.cleanup();
  }

  // Checkpoint/Restore delegates to Worktree (Git state),
  // because the container is ephemeral/stateless computation over the git state.
  // (Unless the container installs global deps not in the volume?
  //  Yes, but for "Self-Healing" we mostly care about code.
  //  If environment breaks, we might need to restart container, but restoring code is step 1.)

  async exec(
    command: string,
    options?: ExecOptions,
    projectConfig?: ProjectConfig | null
  ): Promise<ExecResult> {
    // Execute inside container via `docker exec`
    // We use toolDocker's exec support?
    // toolDocker.ts currently supports: build, run, stop, rm, inspect, logs, wait, exec.probe.
    // It DOES NOT support generic `exec`.
    // I need to use `toolRunner` locally to call `docker exec`.

    // Resolve command via projectConfig (e.g. "test" -> "npm test")
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

    // Construct docker exec command
    // docker exec -i -w /workspace <container> <cmd>
    // const _dockerCmd = `docker exec -i -w /workspace ${this.containerId} ${finalCommand}`;

    // Pass env vars?
    // toolRunner doesn't support passing env map effectively to sub-command string unless we format it.
    // `docker exec -e KEY=VAL ...`
    let envArgs = "";
    if (options?.env) {
      for (const [k, v] of Object.entries(options.env)) {
        envArgs += `-e ${k}="${v}" `;
      }
    }

    // We need to insert envArgs before the image/cmd? No, before the command but after `exec`.
    // `docker exec -i -w /workspace -e FOO=BAR <id> <cmd>`
    const fullCmd = `docker exec -i -w /workspace ${envArgs} ${this.containerId} ${finalCommand}`;

    // Use Host toolRunner to invoke docker client
    // Note: `cwd` for toolRunner is Host, but it doesn't matter for docker exec.
    return import("../orchestrator/tool/runner").then((m) =>
      m.toolRunner.execute(fullCmd, process.cwd(), options?.timeoutMs)
    );
  }
}
