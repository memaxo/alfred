import type { FileSink } from "bun";

import { logger } from "@alfred/logger";
import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk";
import { spawn } from "bun";

import type { OpenCodeToolInput } from "./definition.js";

import {
  type ExecProfile,
  ensureServer,
  type ServerHandle,
  serverKey,
} from "../shared/server.js";
import { createOpencodeFetch } from "./fetch.js";

type SpawnProc = typeof spawn;

const DEFAULT_PORT = 4096;
const AGENTFS_CONTAINER_PREFIX = "alfred-agentfs-";
const DEFAULT_CONTAINER_CW = "/workspace";

const OPENCODE_DOCKER_ENV_ALLOWLIST = [
  "CEREBRAS_API_KEY",
  "OPENCODE_API_KEY",
  "OPENCODE_CONFIG_CONTENT",
  "OPENCODE_DISABLE_AUTOUPDATE",
] as const;

let spawnProc: SpawnProc = spawn;

function normalizeContainerCw(raw: string | undefined): string {
  const v = raw?.trim() || DEFAULT_CONTAINER_CW;
  const normalized = v.startsWith("/") ? v : `/${v}`;
  if (
    !normalized.startsWith("/workspace") ||
    (normalized !== "/workspace" && !normalized.startsWith("/workspace/"))
  ) {
    throw new Error("opencode_container_cwd_invalid");
  }
  return normalized;
}

function assertAgentfsContainerName(containerName: string): void {
  if (!containerName.startsWith(AGENTFS_CONTAINER_PREFIX)) {
    throw new Error("opencode_container_name_invalid");
  }
}

async function drain(stream: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!stream) {
    return;
  }
  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) {
        return;
      }
    }
  } catch {
    // ignore
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

async function dockerExecText(args: {
  containerName: string;
  argv: string[];
  stdinText?: string;
}): Promise<{ stdout: string; exitCode: number }> {
  const proc = spawnProc(
    ["docker", "exec", "-i", args.containerName, ...args.argv],
    {
      env: process.env,
      stderr: "pipe",
      stdin: "pipe",
      stdout: "pipe",
    }
  );

  if (args.stdinText !== undefined) {
    if (!proc.stdin || typeof proc.stdin === "number") {
      proc.kill();
      throw new Error("opencode_stdin_unavailable");
    }
    const bytes = new TextEncoder().encode(args.stdinText);
    (proc.stdin as FileSink).write(bytes);
    await (proc.stdin as FileSink).end();
  } else if (proc.stdin && typeof proc.stdin !== "number") {
    await (proc.stdin as FileSink).end();
  }

  const stdout = proc.stdout ? await new Response(proc.stdout).text() : "";
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = proc.stderr ? await new Response(proc.stderr).text() : "";
    logger.warn("opencode_http_docker_exec_failed", {
      argv: args.argv.slice(0, 8),
      exitCode,
      stderr: stderr.slice(0, 1000),
    });
  }
  return { exitCode, stdout };
}

export type OpenCodeHttpServerHandle = ServerHandle & {
  readonly profile: ExecProfile;
  readonly containerName?: string;
  readonly containerCw?: string;
  readonly baseUrl: string;
  readonly username?: string;
  readonly password?: string;
  readonly client: OpencodeClient;
  readonly sessionByAlfred: Map<string, string>;
  readonly mcpInstalled: Map<string, string>;
};

async function waitForReady(args: {
  client: OpencodeClient;
  timeoutMs: number;
}): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < args.timeoutMs) {
    try {
      await args.client.path.get();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("opencode_http_server_start_failed");
}

async function startInContainer(args: {
  input: OpenCodeToolInput;
  profile: ExecProfile;
}): Promise<OpenCodeHttpServerHandle> {
  const { containerName } = args.input;
  if (!containerName) {
    throw new Error("opencode_server_requires_container");
  }
  assertAgentfsContainerName(containerName);
  const containerCw = normalizeContainerCw(args.input.containerCw);

  const baseUrl = `http://127.0.0.1:${DEFAULT_PORT}`;
  const username = "alfred";
  const password = crypto.randomUUID();

  const envKeys = OPENCODE_DOCKER_ENV_ALLOWLIST.filter((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.trim().length > 0;
  });

  const argv = [
    "docker",
    "exec",
    "-i",
    "-w",
    containerCw,
    ...envKeys.flatMap((k) => ["-e", k]),
    "-e",
    `OPENCODE_SERVER_USERNAME=${username}`,
    "-e",
    `OPENCODE_SERVER_PASSWORD=${password}`,
    containerName,
    "opencode",
    "serve",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(DEFAULT_PORT),
  ];

  const proc = spawnProc(argv, {
    env: process.env,
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });

  void drain(proc.stdout ?? null);
  void drain(proc.stderr ?? null);

  const fetch = createOpencodeFetch({
    containerName,
    password,
    username,
  });

  const client = createOpencodeClient({
    baseUrl,
    directory: containerCw,
    fetch,
    throwOnError: true,
  });

  await waitForReady({ client, timeoutMs: 10_000 });

  const handle: OpenCodeHttpServerHandle = {
    baseUrl,
    client,
    containerCw,
    containerName,
    mcpInstalled: new Map(),
    password,
    profile: args.profile,
    sessionByAlfred: new Map(),
    stop: async (reason) => {
      try {
        await client.instance.dispose();
      } catch {
        // ignore
      }

      try {
        await dockerExecText({
          containerName,
          argv: ["pkill", "-f", "opencode serve"],
        });
      } catch {
        // ignore
      }

      try {
        proc.kill();
      } catch {
        // ignore
      }

      if (reason) {
        logger.debug("opencode_http_server_stopped", { containerName, reason });
      }
    },
    username,
  };

  return handle;
}

async function startExternal(args: {
  input: OpenCodeToolInput;
  profile: ExecProfile;
}): Promise<OpenCodeHttpServerHandle> {
  const baseUrl =
    args.input.baseUrl?.trim() || process.env.OPENCODE_SERVER_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("opencode_http_baseurl_required");
  }

  const username = args.input.username?.trim();
  const password = args.input.password?.trim();

  const client = createOpencodeClient({
    baseUrl,
    fetch: createOpencodeFetch({ username, password }),
    throwOnError: true,
  });

  await waitForReady({ client, timeoutMs: 10_000 });

  return {
    baseUrl,
    client,
    mcpInstalled: new Map(),
    password,
    profile: args.profile,
    sessionByAlfred: new Map(),
    stop: async () => {
      try {
        await client.instance.dispose();
      } catch {
        // ignore
      }
    },
    username,
  };
}

export function startOpenCodeHttpServer(args: {
  input: OpenCodeToolInput;
  profile: ExecProfile;
}): Promise<OpenCodeHttpServerHandle> {
  if (args.input.containerName) {
    return startInContainer(args);
  }
  return startExternal(args);
}

export async function ensureOpenCodeHttpServer(args: {
  input: OpenCodeToolInput;
  profile: ExecProfile;
}): Promise<OpenCodeHttpServerHandle> {
  if (args.profile !== "server") {
    return startOpenCodeHttpServer(args);
  }

  const { containerName } = args.input;
  if (!containerName) {
    throw new Error("opencode_server_requires_container");
  }

  const key = serverKey({
    containerName,
    executor: "opencode-http",
    profile: "server",
  });

  const healthy = async (handle: ServerHandle) => {
    const h = handle as OpenCodeHttpServerHandle;
    try {
      await h.client.path.get();
      return true;
    } catch {
      return false;
    }
  };

  return (await ensureServer({
    healthy,
    key,
    start: () => startInContainer({ input: args.input, profile: "server" }),
  })) as OpenCodeHttpServerHandle;
}

export const __internals = {
  resetSpawn: () => {
    spawnProc = spawn;
  },
  setSpawn: (fn: SpawnProc) => {
    spawnProc = fn;
  },
};
