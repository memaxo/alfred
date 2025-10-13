import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { spawn } from "node:child_process";
import { accessSync, realpathSync, statSync } from "node:fs";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { clearTimeout as clearNodeTimeout, setTimeout as setNodeTimeout } from "node:timers";
import { z } from "zod";

const OUTPUT_CAP_BYTES = 5 * 1024 * 1024; // 5 MiB
const DEFAULT_TIMEOUT_SEC = 15 * 60;
const MIN_TIMEOUT_SEC = 10;
const MAX_TIMEOUT_SEC = 2 * 60 * 60;
const PROBE_BODY_CAP_BYTES = 4 * 1024; // 4 KiB for health probe body

const DEFAULT_ALLOW_PREFIXES = (() => {
  const base = realpathSync(process.cwd());
  const raw = process.env.ORCH_ALLOW_CWD_PREFIXES;
  const extras =
    raw && raw.trim().length > 0
      ? raw
          .split(path.delimiter)
          .map(entry => entry.trim())
          .filter(Boolean)
      : [];

  const prefixes = new Set<string>([base]);

  for (const entry of extras) {
    try {
      const absolute = path.isAbsolute(entry) ? entry : path.resolve(base, entry);
      prefixes.add(realpathSync(absolute));
    } catch {
      // Ignore invalid entries so one bad entry does not break execution.
    }
  }

  return Array.from(prefixes);
})();

function safeRealpath(candidate: string) {
  try {
    return realpathSync(candidate);
  } catch {
    return null;
  }
}

function isWithinBase(base: string, target: string) {
  const baseReal = safeRealpath(base);
  const targetReal = safeRealpath(target);
  if (!baseReal || !targetReal) return false;
  const relative = path.relative(baseReal, targetReal);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertAllowedDirectory(candidate: string) {
  const real = safeRealpath(candidate);
  if (!real) {
    throw new Error("docker_invalid_cwd");
  }

  for (const prefix of DEFAULT_ALLOW_PREFIXES) {
    if (isWithinBase(prefix, real)) {
      const stats = statSync(real);
      if (!stats.isDirectory()) {
        throw new Error("docker_invalid_cwd_not_directory");
      }
      return real;
    }
  }

  throw new Error("docker_invalid_cwd");
}

function resolveExecutable(command: string) {
  if (path.isAbsolute(command)) {
    accessSync(command, fsConstants.X_OK);
    return command;
  }

  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, command);
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // continue
    }
  }

  throw new Error("docker_binary_not_found");
}

const dockerInputSchema = z.object({
  action: z.enum(["build", "run", "stop", "rm", "inspect", "logs", "wait", "exec.probe"]),
  cw: z.string().optional(),
  context: z.string().optional(),
  dockerfile: z.string().optional(),
  tag: z.string().optional(),
  name: z.string().optional(),
  containerPort: z.number().int().min(1).max(65535).optional(),
  hostPort: z.number().int().min(1).max(65535).optional(),
  env: z.record(z.string(), z.string()).optional(),
  network: z.string().optional(),
  authz: z.string().optional(),
  follow: z.boolean().optional(),
  tail: z.number().int().min(0).max(5000).optional(),
  url: z.string().url().optional(),
  timeoutSec: z.number().int().min(MIN_TIMEOUT_SEC).max(MAX_TIMEOUT_SEC).optional(),
});

type DockerInput = z.infer<typeof dockerInputSchema>;

type ToolWriter = { write: (chunk: unknown) => Promise<void> | void } | undefined;

async function enforcePolicy(input: DockerInput) {
  const scopes = input.action === "exec.probe" ? ["deploy.read"] : ["deploy.write"];
  await requireToolScopesAndPolicy(input.authz, scopes, {
    action: `docker.${input.action}`,
    resource: {
      kind: "deploy",
      id: input.name ?? input.tag ?? "runtime",
    },
  });
}

function ensure(value: string | undefined, error: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(error);
  }
  return value;
}

function resolveCwd(candidate: string | undefined) {
  if (!candidate) return process.cwd();
  return assertAllowedDirectory(candidate);
}

function resolveDirectory(base: string, target: string) {
  const absolute = path.isAbsolute(target) ? target : path.join(base, target);
  return assertAllowedDirectory(path.normalize(absolute));
}

function resolveSubpath(base: string, target: string) {
  const absolute = path.normalize(path.isAbsolute(target) ? target : path.join(base, target));
  const parent = path.dirname(absolute);
  assertAllowedDirectory(parent);
  return absolute;
}

async function runDocker({
  args,
  cwd,
  writer,
  timeoutSec,
}: {
  args: string[];
  cwd: string;
  writer: ToolWriter;
  timeoutSec: number;
}) {
  const command = resolveExecutable(process.env.DOCKER_BIN ?? "docker");
  const child = spawn(command, args, {
    cwd,
    env: {
      PATH: process.env.PATH ?? "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const accumulator = {
    stdout: "",
    stderr: "",
    capturedBytes: 0,
    truncated: false,
  };

  const timer = setNodeTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // noop
    }
    void Promise.resolve(writer?.write?.({ type: "notice", message: "docker_timeout" })).catch(() => {});
  }, timeoutSec * 1000);

  child.stdout?.on("data", chunk => {
    const text = chunk.toString();
    accumulator.capturedBytes += Buffer.byteLength(text);

    if (!accumulator.truncated) {
      if (accumulator.capturedBytes <= OUTPUT_CAP_BYTES) {
        accumulator.stdout += text;
      } else {
        accumulator.truncated = true;
      }
    }

    void Promise.resolve(writer?.write?.({ type: "stdout", text })).catch(() => {});
  });

  child.stderr?.on("data", chunk => {
    const text = chunk.toString();
    if (accumulator.stderr.length + text.length <= OUTPUT_CAP_BYTES) {
      accumulator.stderr += text;
    }
    void Promise.resolve(writer?.write?.({ type: "stderr", text })).catch(() => {});
  });

  const exitCode: number = await new Promise(resolve => {
    child.once("close", code => resolve(code ?? 1));
    child.once("error", () => resolve(1));
  });

  clearNodeTimeout(timer);

  return {
    exitCode,
    stdout: accumulator.stdout.trim(),
    stderr: accumulator.stderr.trim(),
    truncated: accumulator.truncated,
  };
}

type InspectPortMapping = { host: number; container: number };

function parseInspectPorts(raw: unknown, containerPort?: number) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0] as Record<string, unknown>;
  const networkSettings = first?.NetworkSettings;
  if (typeof networkSettings !== "object" || !networkSettings) return [];
  const ports = (networkSettings as Record<string, unknown>).Ports;
  if (typeof ports !== "object" || !ports) return [];

  const results: InspectPortMapping[] = [];
  for (const [key, value] of Object.entries(ports as Record<string, unknown>)) {
    const [containerPortRaw] = key.split("/");
    if (!containerPortRaw) continue;
    const containerInt = Number.parseInt(containerPortRaw, 10);
    if (Number.isNaN(containerInt)) continue;
    if (containerPort && containerInt !== containerPort) continue;

    if (Array.isArray(value)) {
      for (const binding of value) {
        if (!binding) continue;
        const hostPort = Number.parseInt((binding as Record<string, string>).HostPort ?? "", 10);
        if (!Number.isNaN(hostPort)) {
          results.push({ container: containerInt, host: hostPort });
        }
      }
    }
  }

  return results;
}

async function executeBuild(input: DockerInput, writer: ToolWriter) {
  const cwd = resolveCwd(input.cw);
  const contextPath = resolveDirectory(cwd, ensure(input.context, "docker_context_required"));
  const args = ["build", "-t", ensure(input.tag, "docker_tag_required")];

  if (input.dockerfile) {
    const dockerfilePath = resolveSubpath(cwd, input.dockerfile);
    args.push("-f", dockerfilePath);
  }

  args.push(contextPath);

  const result = await runDocker({
    args,
    cwd,
    writer,
    timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
  });

  if (result.exitCode !== 0) {
    throw new Error("docker_build_failed");
  }

  return { ok: true as const };
}

async function executeRun(input: DockerInput, writer: ToolWriter) {
  const cwd = resolveCwd(input.cw);
  const tag = ensure(input.tag, "docker_tag_required");
  const name = ensure(input.name, "docker_name_required");
  const containerPort = input.containerPort ?? 3000;

  const args = ["run", "-d", "--name", name, "--restart", "unless-stopped"];

  if (input.hostPort) {
    args.push("-p", `${input.hostPort}:${containerPort}`);
  } else {
    args.push("-P");
  }

  if (input.network) {
    args.push("--network", input.network);
  }

  if (input.env) {
    for (const [key, value] of Object.entries(input.env)) {
      args.push("-e", `${key}=${value}`);
    }
  }

  args.push(tag);

  const result = await runDocker({
    args,
    cwd,
    writer,
    timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
  });

  if (result.exitCode !== 0) {
    throw new Error("docker_run_failed");
  }

  const containerId = result.stdout.split(/\s+/u).filter(Boolean)[0] ?? name;

  const inspect = await executeInspect(
    { ...input, action: "inspect", name, containerPort },
    writer,
  );

  const mapped = inspect.details?.ports ?? [];
  const selected = input.hostPort
    ? mapped.find(entry => entry.host === input.hostPort) ?? mapped[0]
    : mapped[0];

  return {
    ok: true as const,
    details: {
      name,
      containerId,
      containerPort,
      hostPort: selected?.host ?? input.hostPort ?? null,
      ports: mapped,
    },
  };
}

async function executeStop(input: DockerInput, writer: ToolWriter) {
  const cwd = resolveCwd(input.cw);
  const name = ensure(input.name, "docker_name_required");

  const result = await runDocker({
    args: ["stop", name],
    cwd,
    writer,
    timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
  });

  if (result.exitCode !== 0) {
    throw new Error("docker_stop_failed");
  }

  return { ok: true as const };
}

async function executeRemove(input: DockerInput, writer: ToolWriter) {
  const cwd = resolveCwd(input.cw);
  const name = ensure(input.name, "docker_name_required");

  const result = await runDocker({
    args: ["rm", "-f", name],
    cwd,
    writer,
    timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
  });

  if (result.exitCode !== 0) {
    throw new Error("docker_remove_failed");
  }

  return { ok: true as const };
}

async function executeInspect(input: DockerInput, writer: ToolWriter) {
  const cwd = resolveCwd(input.cw);
  const name = ensure(input.name, "docker_name_required");

  const result = await runDocker({
    args: ["inspect", name],
    cwd,
    writer,
    timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
  });

  if (result.exitCode !== 0) {
    throw new Error("docker_inspect_failed");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout || "[]");
  } catch {
    parsed = [];
  }

  const ports = parseInspectPorts(parsed, input.containerPort);

  return {
    ok: true as const,
    details: { ports },
  };
}

async function executeLogs(input: DockerInput, writer: ToolWriter) {
  const cwd = resolveCwd(input.cw);
  const name = ensure(input.name, "docker_name_required");
  const args = ["logs"];
  if (input.follow) {
    args.push("-f");
  }
  if (typeof input.tail === "number") {
    args.push("--tail", String(input.tail));
  }
  args.push(name);

  const result = await runDocker({
    args,
    cwd,
    writer,
    timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
  });

  if (result.truncated) {
    await Promise.resolve(
      writer?.write?.({ type: "notice", message: "docker_logs_truncated", name, tail: input.tail }),
    ).catch(() => {});
  }

  if (result.exitCode !== 0) {
    throw new Error("docker_logs_failed");
  }

  return {
    ok: true as const,
    details: {
      name,
      exitCode: result.exitCode,
      text: result.stdout,
      error: result.stderr || undefined,
      truncated: result.truncated,
    },
  };
}

async function executeWait(input: DockerInput, writer: ToolWriter) {
  const cwd = resolveCwd(input.cw);
  const name = ensure(input.name, "docker_name_required");
  const result = await runDocker({
    args: ["wait", name],
    cwd,
    writer,
    timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
  });
  if (result.exitCode !== 0) {
    throw new Error("docker_wait_failed");
  }
  const parsed = Number.parseInt(result.stdout.trim(), 10);
  const containerExitCode = Number.isNaN(parsed) ? null : parsed;
  return {
    ok: true as const,
    details: {
      name,
      exitCode: containerExitCode ?? undefined,
    },
  };
}

async function executeProbe(input: DockerInput, writer: ToolWriter) {
  const url = ensure(input.url, "docker_probe_url_required");
  const seconds = Math.min(Math.max(input.timeoutSec ?? 30, 1), MAX_TIMEOUT_SEC);
  const timeoutMs = seconds * 1000;
  const controller = new AbortController();
  const timer = setNodeTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    const rawBody = await response.text();
    const truncated = rawBody.length > PROBE_BODY_CAP_BYTES;
    const body = truncated ? rawBody.slice(0, PROBE_BODY_CAP_BYTES) : rawBody;

    await Promise.resolve(
      writer?.write?.({
        type: "notice",
        message: "docker_probe_result",
        status: response.status,
        ok: response.ok,
      }),
    ).catch(() => {});

    if (!response.ok) {
      const error = new Error("docker_probe_failed");
      (error as Error & { status?: number; body?: string }).status = response.status;
      (error as Error & { status?: number; body?: string }).body = body;
      throw error;
    }

    return {
      ok: true as const,
      details: {
        status: response.status,
        body,
        truncated,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("docker_probe_timeout");
    }
    throw error;
  } finally {
    clearNodeTimeout(timer);
  }
}

export const toolDocker = {
  name: "docker",
  description: "Manage local Docker containers for preview deployments.",
  inputSchema: dockerInputSchema,
  outputSchema: z.object({
    ok: z.boolean(),
    details: z
      .object({
        name: z.string().optional(),
        containerId: z.string().optional(),
        containerPort: z.number().optional(),
        hostPort: z.number().nullable().optional(),
        ports: z.array(z.object({ host: z.number(), container: z.number() })).optional(),
        exitCode: z.number().optional(),
        text: z.string().optional(),
        error: z.string().optional(),
        truncated: z.boolean().optional(),
        status: z.number().optional(),
        body: z.string().optional(),
      })
      .optional(),
  }),
  execute: async ({
    input,
    writer,
  }: {
    input: DockerInput;
    writer?: { write: (chunk: unknown) => Promise<void> | void };
  }) => {
    await enforcePolicy(input);

    switch (input.action) {
      case "build":
        return executeBuild(input, writer);
      case "run":
        return executeRun(input, writer);
      case "stop":
        return executeStop(input, writer);
      case "rm":
        return executeRemove(input, writer);
      case "inspect":
        return executeInspect(input, writer);
      case "logs":
        return executeLogs(input, writer);
      case "wait":
        return executeWait(input, writer);
      case "exec.probe":
        return executeProbe(input, writer);
      default:
        throw new Error("docker_action_not_supported");
    }
  },
};

export type ToolDocker = typeof toolDocker;
