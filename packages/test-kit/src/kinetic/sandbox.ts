import { logger } from "@alfred/logger";
import { spawn } from "bun";

export interface SandboxOptions {
  image?: string;
  timeout?: number;
  env?: Record<string, string>;
}

/**
 * Kinetic Layer Sandbox
 *
 * Uses direct `docker` CLI calls via Bun.spawn for reliability and performance.
 * Avoids testcontainers library issues with stream handling.
 */
export class DockerSandbox {
  private containerId: string | null = null;
  private readonly image: string;

  constructor(options: SandboxOptions = {}) {
    this.image = options.image ?? "alpine:latest";
  }

  async start(): Promise<void> {
    if (this.containerId) {
      return;
    }

    logger.info("sandbox_start", { image: this.image });

    // Start detached container
    const proc = spawn(
      [
        "docker",
        "run",
        "--rm", // Cleanup on stop
        "-d", // Detached
        this.image,
        "tail",
        "-f",
        "/dev/null",
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const output = await new Response(proc.stdout).text();
    const error = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      logger.error("sandbox_start_failed", { error, exitCode });
      throw new Error(`Failed to start sandbox: ${error}`);
    }

    this.containerId = output.trim();
    logger.info("sandbox_started", { id: this.containerId });
  }

  async stop(): Promise<void> {
    if (this.containerId) {
      const proc = spawn(["docker", "stop", "-t", "0", this.containerId]);
      await proc.exited;
      this.containerId = null;
      logger.info("sandbox_stopped");
    }
  }

  async exec(
    command: string[]
  ): Promise<{ exitCode: number; output: string; error: string }> {
    if (!this.containerId) {
      throw new Error("Sandbox not started");
    }

    logger.info("sandbox_exec", { command });

    const proc = spawn(["docker", "exec", this.containerId, ...command], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    logger.info("sandbox_exec_done", { exitCode });

    return {
      exitCode,
      output: stdout,
      error: stderr,
    };
  }

  // Helper to write file content
  async writeFile(path: string, content: string): Promise<void> {
    if (!this.containerId) {
      throw new Error("Sandbox not started");
    }

    // Use printf for safer writing than echo
    const safeContent = content.replaceAll("'", String.raw`'\''`);
    await this.exec(["sh", "-c", `printf '%s' '${safeContent}' > "${path}"`]);
  }

  async readFile(path: string): Promise<string> {
    if (!this.containerId) {
      throw new Error("Sandbox not started");
    }
    const result = await this.exec(["cat", path]);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to read file ${path}: ${result.error}`);
    }
    return result.output;
  }
}
