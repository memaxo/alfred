#!/usr/bin/env bun
import * as fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "bun";
import { ContainerWorkspace } from "../packages/agent/src/environment/container";

async function runCommand(args: string[], options: { cwd?: string } = {}) {
  const proc = spawn(args, {
    cwd: options.cwd ?? process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(""),
    proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(""),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    const error = stderr || stdout || "unknown error";
    throw new Error(`${args.join(" ")} failed: ${error}`);
  }

  return { stdout, stderr };
}

async function ensureImage(tag: string) {
  const dockerfilePath = path.join("tmp", "Dockerfile.sessions-tmux");
  await fs.mkdir(path.dirname(dockerfilePath), { recursive: true });
  await fs.writeFile(
    dockerfilePath,
    [
      "FROM node:20-bullseye",
      "RUN apt-get update && apt-get install -y tmux >/dev/null && rm -rf /var/lib/apt/lists/*",
    ].join("\n"),
    "utf8"
  );

  await runCommand(["docker", "build", "-t", tag, "-f", dockerfilePath, "."]);
}

async function run() {
  const imageTag = "alfred-tmux-session:latest";
  await ensureImage(imageTag);

  const runId = `tmux-container-${Date.now().toString(36)}`;
  const workspace = new ContainerWorkspace(
    "tmux-container",
    runId,
    process.cwd(),
    imageTag,
    undefined,
    true
  );

  try {
    await workspace.initialize();
    const containerId = workspace.containerId;
    const sessionName = `container-session-${Date.now().toString(36)}`;
    const marker = `CONTAINER_TMUX_${Date.now().toString(36)}`;

    await runCommand([
      "docker",
      "exec",
      "-i",
      containerId,
      "tmux",
      "new-session",
      "-d",
      "-s",
      sessionName,
      "bash",
    ]);

    await runCommand([
      "docker",
      "exec",
      "-i",
      containerId,
      "tmux",
      "send-keys",
      "-t",
      sessionName,
      `echo ${marker}`,
      "C-m",
    ]);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const { stdout } = await runCommand([
      "docker",
      "exec",
      "-i",
      containerId,
      "tmux",
      "capture-pane",
      "-t",
      sessionName,
      "-p",
      "-S",
      "-40",
    ]);

    if (!stdout.includes(marker)) {
      throw new Error("container tmux session did not emit expected marker");
    }

    await runCommand([
      "docker",
      "exec",
      "-i",
      containerId,
      "tmux",
      "kill-session",
      "-t",
      sessionName,
      ]);
  } finally {
    await workspace
      .cleanup()
      .catch(() => {
        // Ignore cleanup errors
      });
  }
}

  await run().catch(() => {
    process.exitCode = 1;
  });
