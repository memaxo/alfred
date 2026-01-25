import type { DockerToolOutput } from "@alfred/agent/orchestrator/tool/docker";

import { toolDocker } from "@alfred/agent/orchestrator/tool/docker";

function execOkOrThrow(res: DockerToolOutput, label: string): string {
  const { details } = res;
  const code = details?.exitCode ?? 0;
  const stdout = details?.text ?? "";
  const stderr = details?.error ?? "";
  if (code !== 0) {
    const err = new Error(`${label}: exit=${code}`);
    (err as Error & { details?: Record<string, unknown> }).details = {
      exitCode: code,
      stdoutPreview: stdout.slice(0, 200),
      stderrPreview: stderr.slice(0, 200),
    };
    throw err;
  }
  return stdout;
}

export async function checkDockerAvailable(timeoutMs: number): Promise<void> {
  const proc = Bun.spawn(["docker", "info"], {
    stdin: "ignore",
    stdout: "ignore",
    stderr: "pipe",
  });

  const timer = setTimeout(() => proc.kill(), timeoutMs);
  timer.unref();

  try {
    const code = await proc.exited;
    if (code === 0) {
      return;
    }
    const stderr = proc.stderr ? await new Response(proc.stderr).text() : "";
    if (stderr.includes("Cannot connect to the Docker daemon")) {
      throw new Error(
        "docker_daemon_not_running: Start Docker Desktop and wait for it to be ready."
      );
    }
    if (stderr.toLowerCase().includes("permission denied")) {
      throw new Error(
        `docker_permission_denied: ${stderr.trim().slice(0, 200)}`
      );
    }
    throw new Error(
      `docker_check_failed: exit ${code} stderr=${stderr.trim().slice(0, 200)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function dockerImageExists(
  tag: string,
  timeoutMs: number
): Promise<boolean> {
  const proc = Bun.spawn(["docker", "image", "inspect", tag], {
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  const timer = setTimeout(() => proc.kill(), timeoutMs);
  timer.unref();
  try {
    const code = await proc.exited;
    return code === 0;
  } finally {
    clearTimeout(timer);
  }
}

export async function ensureAgentfsImage(args: {
  authz: string;
  image: string;
  timeoutSec: number;
  onLog: (text: string) => void;
}): Promise<void> {
  if (await dockerImageExists(args.image, 60_000)) {
    return;
  }

  await toolDocker.execute({
    input: {
      action: "build",
      cw: process.cwd(),
      context: ".",
      dockerfile: "docker/agentfs/Dockerfile",
      tag: args.image,
      authz: args.authz,
      timeoutSec: args.timeoutSec,
    },
    writer: {
      write: (chunk) => {
        if (chunk && typeof chunk === "object") {
          const maybe = chunk as { text?: unknown };
          if (typeof maybe.text === "string" && maybe.text.length > 0) {
            args.onLog(maybe.text);
          }
        }
      },
    },
  });
}

async function execInContainer(args: {
  authz: string;
  containerName: string;
  cmd: string;
  sh: string;
  timeoutSec: number;
}): Promise<string> {
  const res = await toolDocker.execute({
    input: {
      action: "exec",
      cw: process.cwd(),
      name: args.containerName,
      cmd: args.cmd,
      args: ["-lc", args.sh],
      authz: args.authz,
      timeoutSec: args.timeoutSec,
    },
  });
  return execOkOrThrow(res, "docker_exec_failed");
}

export async function findPidInContainer(args: {
  authz: string;
  containerName: string;
  pattern: string;
}): Promise<number | null> {
  const cmd = `pgrep -f "${args.pattern.replaceAll('"', String.raw`\"`)}" | head -n 1`;
  const out = await execInContainer({
    authz: args.authz,
    containerName: args.containerName,
    cmd: "sh",
    sh: `${cmd} || true`,
    timeoutSec: 30,
  });
  const pid = Number(out.trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

export async function killPidInContainer(args: {
  authz: string;
  containerName: string;
  pid: number;
}): Promise<void> {
  await execInContainer({
    authz: args.authz,
    containerName: args.containerName,
    cmd: "sh",
    sh: `kill -TERM ${args.pid} 2>/dev/null || true; sleep 0.5; kill -KILL ${args.pid} 2>/dev/null || true`,
    timeoutSec: 60,
  });
}
