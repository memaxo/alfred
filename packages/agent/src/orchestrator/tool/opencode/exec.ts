import type { FileSink } from "bun";

import { logger } from "@alfred/logger";
import {
  type Client,
  ClientSideConnection,
  mapAutonomyToAcpMode,
  ndJsonStream,
  PROTOCOL_VERSION,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type Stream,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
} from "@alfred/protocol/acp";
import { spawn } from "bun";

import type { ToolExecuteContext } from "../shared/context.js";
import type { OpenCodeToolInput, OpenCodeToolOutput } from "./definition.js";

import { executorServerFallbackTotal } from "../shared/metrics.js";
import {
  ensureServer,
  isExecProfileStrict,
  type ServerHandle,
  serverKey,
} from "../shared/server.js";

interface AgentCmd {
  cmd: string;
  args: string[];
}
type Writer = ToolExecuteContext<OpenCodeToolInput>["writer"];

const DEFAULT_CONTAINER_CW = "/workspace";
const AGENTFS_CONTAINER_PREFIX = "alfred-agentfs-";

const OPENCODE_DOCKER_ENV_ALLOWLIST = [
  "CEREBRAS_API_KEY",
  "OPENCODE_API_KEY",
  "OPENCODE_CONFIG_CONTENT",
  "OPENCODE_DISABLE_AUTOUPDATE",
] as const;

type SpawnProc = typeof spawn;
type Connection = Pick<
  ClientSideConnection,
  "initialize" | "newSession" | "prompt" | "cancel"
>;
type CreateConnection = (factory: () => Client, stream: Stream) => Connection;

let spawnProc: SpawnProc = spawn;
let createConnection: CreateConnection = (factory, stream) =>
  new ClientSideConnection(factory, stream);

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

function splitArgs(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed.split(/\s+/).filter(Boolean);
}

function resolveAgentCmd(input: OpenCodeToolInput): AgentCmd {
  const cmd = input.cmd ?? process.env.OPENCODE_ACP_CMD ?? "opencode";
  const args = input.args ?? [
    ...splitArgs(process.env.OPENCODE_ACP_ARGS ?? ""),
  ];

  return { args, cmd };
}

function abortPromise(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) {
      return;
    }
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal.addEventListener(
      "abort",
      () => reject(new DOMException("Aborted", "AbortError")),
      { once: true }
    );
  });
}

function emitText(writer: Writer, text: string) {
  if (!text) {
    return;
  }
  void Promise.resolve(
    writer?.write?.({
      event: { type: "output", content: text, timestamp: Date.now() },
      type: "stdout",
    })
  ).catch(() => {});
}

function emitThought(writer: Writer, text: string) {
  if (!text) {
    return;
  }
  void Promise.resolve(
    writer?.write?.({
      event: { type: "thought", content: text, timestamp: Date.now() },
      type: "stdout",
    })
  ).catch(() => {});
}

function emitArtifact(writer: Writer, filePath: string, kind: string) {
  if (!filePath) {
    return;
  }
  void Promise.resolve(
    writer?.write?.({
      event: { type: "artifact", path: filePath, kind, timestamp: Date.now() },
      type: "stdout",
    })
  ).catch(() => {});
}

function emitCommand(
  writer: Writer,
  title: string,
  status: "running" | "completed" | "failed"
) {
  void Promise.resolve(
    writer?.write?.({
      event: { type: "command", command: title, status, timestamp: Date.now() },
      type: "stdout",
    })
  ).catch(() => {});
}

interface ClientCtx {
  writer: Writer;
  auto: OpenCodeToolInput["auto"];
  append: (text: string) => void;
  addArtifact: (filePath: string, kind: string) => void;
  onPlan: (entries: unknown) => void;
  sessionCw: string;
  containerName: string;
}

function createClient(
  getCtx: (sessionId: string) => ClientCtx | undefined
): Client {
  return {
    async readTextFile(
      params: ReadTextFileRequest
    ): Promise<ReadTextFileResponse> {
      const sessionId =
        params && typeof params.sessionId === "string" ? params.sessionId : "";
      const ctx = sessionId ? getCtx(sessionId) : undefined;
      if (!ctx) {
        throw new Error("opencode_fs_unknown_session");
      }
      const filePath =
        params && typeof params.path === "string" ? params.path : "";
      if (!filePath) {
        throw new Error("opencode_fs_path_missing");
      }
      return await readTextFileImpl({
        path: filePath,
        sessionCw: ctx.sessionCw,
        containerName: ctx.containerName,
      });
    },

    async requestPermission(params) {
      const sessionId =
        params && typeof params.sessionId === "string" ? params.sessionId : "";
      const ctx = sessionId ? getCtx(sessionId) : undefined;
      const auto = ctx?.auto ?? "read";
      const writer = ctx?.writer;

      const options = Array.isArray(params.options) ? params.options : [];
      const preferredKinds =
        auto === "read" || auto === "low"
          ? ["deny", "reject", "cancel"]
          : ["allow", "approve", "accept"];

      const pick = () => {
        for (const kind of preferredKinds) {
          const found = options.find((o) => o.kind === kind);
          if (found?.optionId) {
            return found.optionId;
          }
        }
        const fallback = options[0]?.optionId;
        if (!fallback) {
          throw new Error("opencode_permission_options_missing");
        }
        return fallback;
      };

      const title =
        params.toolCall && typeof params.toolCall.title === "string"
          ? params.toolCall.title
          : "permission";
      emitCommand(writer, title, "running");
      return {
        outcome: {
          outcome: "selected",
          optionId: pick(),
        },
      };
    },

    async sessionUpdate(params) {
      const sessionId =
        params && typeof params.sessionId === "string" ? params.sessionId : "";
      const ctx = sessionId ? getCtx(sessionId) : undefined;
      const writer = ctx?.writer;
      const { update } = params;
      if (!update || typeof update !== "object") {
        return;
      }

      const kind = (update as { sessionUpdate?: unknown }).sessionUpdate;
      if (kind === "agent_message_chunk") {
        const content = (update as { content?: unknown }).content as
          | { type?: unknown; text?: unknown }
          | undefined;
        if (content?.type === "text" && typeof content.text === "string") {
          ctx?.append(content.text);
          emitText(writer, content.text);
        }
        return;
      }

      if (kind === "agent_thought_chunk") {
        const content = (update as { content?: unknown }).content as
          | { type?: unknown; text?: unknown }
          | undefined;
        if (content?.type === "text" && typeof content.text === "string") {
          emitThought(writer, content.text);
        }
        return;
      }

      if (kind === "plan") {
        const { entries } = update as { entries?: unknown };
        ctx?.onPlan(entries);
        void Promise.resolve(
          writer?.write?.({
            type: "notice",
            message: "opencode_plan",
            entries,
          })
        ).catch(() => {});
        return;
      }

      if (kind === "tool_call") {
        const { title } = update as { title?: unknown };
        const { status } = update as { status?: unknown };
        const titleStr = typeof title === "string" ? title : "tool_call";
        const statusStr = status === "failed" ? "failed" : "running";
        emitCommand(writer, titleStr, statusStr);
        return;
      }

      if (kind === "tool_call_update") {
        const { status } = update as { status?: unknown };
        const id = (update as { toolCallId?: unknown }).toolCallId;
        const titleStr =
          typeof id === "string" ? `tool_call:${id}` : "tool_call";
        const mapped =
          status === "completed"
            ? "completed"
            : (status === "failed"
              ? "failed"
              : "running");
        emitCommand(writer, titleStr, mapped);

        // Capture diff payloads (ACP tool_call_update may include `content` array).
        const { content } = update as { content?: unknown };
        if (Array.isArray(content)) {
          for (const item of content) {
            if (!item || typeof item !== "object") {
              continue;
            }
            const { type } = item as { type?: unknown };
            if (type !== "diff") {
              continue;
            }
            const p = (item as { path?: unknown }).path;
            if (typeof p === "string" && p.trim().length > 0) {
              ctx?.addArtifact(p, "file");
              emitArtifact(writer, p, "file");
            }
          }
        }
      }
    },

    async writeTextFile(
      params: WriteTextFileRequest
    ): Promise<WriteTextFileResponse> {
      const sessionId =
        params && typeof params.sessionId === "string" ? params.sessionId : "";
      const ctx = sessionId ? getCtx(sessionId) : undefined;
      if (!ctx) {
        throw new Error("opencode_fs_unknown_session");
      }
      const filePath =
        params && typeof params.path === "string" ? params.path : "";
      if (!filePath) {
        throw new Error("opencode_fs_path_missing");
      }
      const content =
        params && typeof params.content === "string" ? params.content : "";
      return await writeTextFileImpl({
        path: filePath,
        content,
        sessionCw: ctx.sessionCw,
        containerName: ctx.containerName,
      });
    },
  };
}

const MAX_FS_BYTES = 5 * 1024 * 1024;

function normalizeContainerPath(args: {
  sessionCw: string;
  rawPath: string;
}): string {
  const p = args.rawPath.trim();
  if (!p) {
    throw new Error("opencode_fs_path_missing");
  }
  const base = args.sessionCw.trim() || DEFAULT_CONTAINER_CW;
  const joined = p.startsWith("/") ? p : `${base.replaceAll(/\/+$/g, "")}/${p}`;
  const parts = joined.split("/").filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    if (part === ".") {
      continue;
    }
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  const normalized = `/${out.join("/")}`;
  if (
    !normalized.startsWith("/workspace") ||
    (normalized !== "/workspace" && !normalized.startsWith("/workspace/"))
  ) {
    throw new Error("opencode_container_cwd_invalid");
  }
  return normalized;
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
    logger.warn("opencode_docker_exec_failed", {
      argv: args.argv.slice(0, 8),
      exitCode,
      stderr: stderr.slice(0, 1000),
    });
  }
  return { exitCode, stdout };
}

async function readTextFileImpl(args: {
  path: string;
  sessionCw: string;
  containerName: string;
}): Promise<ReadTextFileResponse> {
  const filePath = normalizeContainerPath({
    rawPath: args.path,
    sessionCw: normalizeContainerCw(args.sessionCw),
  });
  const { stdout, exitCode } = await dockerExecText({
    argv: ["cat", filePath],
    containerName: args.containerName,
  });
  if (exitCode !== 0) {
    throw new Error("opencode_fs_read_failed");
  }
  if (stdout.length > MAX_FS_BYTES) {
    throw new Error("opencode_fs_read_too_large");
  }
  return { content: stdout };
}

async function writeTextFileImpl(args: {
  path: string;
  content: string;
  sessionCw: string;
  containerName: string;
}): Promise<WriteTextFileResponse> {
  if (args.content.length > MAX_FS_BYTES) {
    throw new Error("opencode_fs_write_too_large");
  }

  const filePath = normalizeContainerPath({
    rawPath: args.path,
    sessionCw: normalizeContainerCw(args.sessionCw),
  });
  const dir = filePath.split("/").slice(0, -1).join("/") || "/workspace";
  const mkdirRes = await dockerExecText({
    argv: ["mkdir", "-p", dir],
    containerName: args.containerName,
  });
  if (mkdirRes.exitCode !== 0) {
    throw new Error("opencode_fs_write_failed");
  }
  const writeRes = await dockerExecText({
    argv: ["tee", filePath],
    containerName: args.containerName,
    stdinText: args.content,
  });
  if (writeRes.exitCode !== 0) {
    throw new Error("opencode_fs_write_failed");
  }
  return {};
}

function sinkToWritableStream(sink: FileSink): WritableStream<Uint8Array> {
  return new WritableStream<Uint8Array>({
    async abort(reason) {
      await sink.end(reason instanceof Error ? reason : undefined);
    },
    async close() {
      await sink.end();
    },
    write(chunk) {
      sink.write(chunk);
    },
  });
}

interface SpawnSpec {
  argv: string[];
  cwd: string | undefined;
  sessionCw: string;
}

function resolveSpawnSpec(input: OpenCodeToolInput, cmd: AgentCmd): SpawnSpec {
  if (!input.containerName.startsWith(AGENTFS_CONTAINER_PREFIX)) {
    throw new Error("opencode_container_name_invalid");
  }
  const containerCw = normalizeContainerCw(input.containerCw);
  const envKeys = OPENCODE_DOCKER_ENV_ALLOWLIST.filter((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
  return {
    argv: [
      "docker",
      "exec",
      "-i",
      "-w",
      containerCw,
      ...envKeys.flatMap((k) => ["-e", k]),
      input.containerName,
      cmd.cmd,
      ...cmd.args,
    ],
    cwd: undefined,
    sessionCw: containerCw,
  };
}

type OpenCodeServer = ServerHandle & {
  exited: boolean;
  runPrompt: (args: {
    input: OpenCodeToolInput;
    writer: Writer;
    signal?: AbortSignal;
    prompt: string;
  }) => Promise<OpenCodeToolOutput>;
};

function createPromptLock() {
  let tail = Promise.resolve();
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.then(
      () => {},
      () => {}
    );
    return run;
  };
}

async function startOpenCodeServer(args: {
  input: OpenCodeToolInput;
}): Promise<OpenCodeServer> {
  const cmd = resolveAgentCmd(args.input);
  const spec = resolveSpawnSpec(args.input, cmd);

  const proc = spawnProc(spec.argv, {
    cwd: spec.cwd,
    env: process.env,
    stderr: "pipe",
    stdin: "pipe",
    stdout: "pipe",
  });

  if (!proc.stdin || typeof proc.stdin === "number") {
    proc.kill();
    throw new Error("opencode_stdin_unavailable");
  }
  if (!proc.stdout || typeof proc.stdout === "number") {
    proc.kill();
    throw new Error("opencode_stdout_unavailable");
  }

  const sessions = new Map<string, ClientCtx>();
  const getCtx = (sessionId: string): ClientCtx | undefined =>
    sessions.get(sessionId);

  const stream = ndJsonStream(sinkToWritableStream(proc.stdin), proc.stdout);
  const connection = createConnection(() => createClient(getCtx), stream);

  let exited = false;
  void proc.exited
    .then(() => {
      exited = true;
    })
    .catch(() => {
      exited = true;
    });

  await connection.initialize({
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
    },
    protocolVersion: PROTOCOL_VERSION,
  });

  const withLock = createPromptLock();

  return {
    get exited() {
      return exited;
    },
    runPrompt: async ({ input, writer, signal, prompt }) =>
      withLock(async () => {
        const sessionText: { value: string } = { value: "" };
        const append = (delta: string) => {
          sessionText.value += delta;
        };
        const artifacts: { path: string; kind: string }[] = [];
        const addArtifact = (p: string, kind: string) => {
          const trimmed = p.trim();
          if (!trimmed) {
            return;
          }
          if (artifacts.some((a) => a.path === trimmed && a.kind === kind)) {
            return;
          }
          artifacts.push({ path: trimmed, kind });
        };
        const onPlan = (_entries: unknown) => {};

        const sessionCw = normalizeContainerCw(input.containerCw);

        const auto = input.auto ?? "read";
        const session = await connection.newSession({
          cwd: sessionCw,
          mcpServers: input.mcpServers ?? [],
          ...(input.sessionId ? { sessionId: input.sessionId } : {}),
          ...(input.model ? { model: input.model } : {}),
          mode: mapAutonomyToAcpMode(auto),
        } as any);

        sessions.set(session.sessionId, {
          writer,
          auto,
          append,
          addArtifact,
          onPlan,
          sessionCw,
          containerName: input.containerName,
        });

        let didTimeout = false;
        const timeoutMs = (input.timeoutSec ?? 20 * 60) * 1000;
        const timer = setTimeout(() => {
          didTimeout = true;
          void connection
            .cancel({ sessionId: session.sessionId })
            .catch(() => {});
        }, timeoutMs);
        (timer as unknown as { unref?: () => void }).unref?.();

        const handleAbort = () => {
          void connection
            .cancel({ sessionId: session.sessionId })
            .catch(() => {});
        };
        if (signal) {
          if (signal.aborted) {
            handleAbort();
          } else {
            signal.addEventListener("abort", handleAbort, { once: true });
          }
        }

        try {
          await Promise.race([
            connection.prompt({
              sessionId: session.sessionId,
              prompt: [{ type: "text", text: prompt }],
            }),
            abortPromise(signal),
          ]);
        } finally {
          clearTimeout(timer);
          if (signal) {
            signal.removeEventListener("abort", handleAbort);
          }
          sessions.delete(session.sessionId);
        }

        if (didTimeout) {
          throw new Error("opencode_prompt_timeout");
        }

        return {
          result: sessionText.value,
          artifacts,
          stopReason: undefined,
        };
      }),
    stop: async () => {
      try {
        proc.kill();
      } catch {
        // ignore
      }
      // Best-effort wait for exit (avoid hanging shutdown on stuck processes).
      await Promise.race([
        proc.exited.catch(() => 0),
        new Promise<void>((resolve) => {
          const t = setTimeout(resolve, 2000);
          (t as unknown as { unref?: () => void }).unref?.();
        }),
      ]);
    },
  };
}

async function execOnce(args: ToolExecuteContext<OpenCodeToolInput>) {
  const timeoutMs = (args.input.timeoutSec ?? 20 * 60) * 1000;
  const cmd = resolveAgentCmd(args.input);
  const spec = resolveSpawnSpec(args.input, cmd);

  const proc = spawnProc(spec.argv, {
    cwd: spec.cwd,
    env: process.env,
    stderr: "pipe",
    stdin: "pipe",
    stdout: "pipe",
  });

  if (!proc.stdin || typeof proc.stdin === "number") {
    proc.kill();
    throw new Error("opencode_stdin_unavailable");
  }
  if (!proc.stdout || typeof proc.stdout === "number") {
    proc.kill();
    throw new Error("opencode_stdout_unavailable");
  }

  const stream = ndJsonStream(sinkToWritableStream(proc.stdin), proc.stdout);
  let text = "";
  const append = (delta: string) => {
    text += delta;
  };

  const artifacts: { path: string; kind: string }[] = [];
  const addArtifact = (p: string, kind: string) => {
    const trimmed = p.trim();
    if (!trimmed) {
      return;
    }
    if (artifacts.some((a) => a.path === trimmed && a.kind === kind)) {
      return;
    }
    artifacts.push({ kind, path: trimmed });
  };
  const onPlan = (_entries: unknown) => {};

  const ctx: ClientCtx = {
    addArtifact,
    append,
    auto: args.input.auto,
    containerName: args.input.containerName,
    onPlan,
    sessionCw: spec.sessionCw,
    writer: args.writer,
  };
  const getCtx = (_sessionId: string) => ctx;

  const connection = createConnection(() => createClient(getCtx), stream);

  const timer = setTimeout(() => {
    proc.kill();
  }, timeoutMs);
  (timer as unknown as { unref?: () => void }).unref?.();

  const stderrChunks: string[] = [];
  const decoder = new TextDecoder();
  const readStderr = async () => {
    if (!proc.stderr || typeof proc.stderr === "number") {
      return;
    }
    const reader = proc.stderr.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        stderrChunks.push(chunk);
        void Promise.resolve(
          args.writer?.write?.({ text: chunk, type: "stderr" })
        ).catch(() => {});
      }
    } catch {
      // ignore (killed)
    }
  };

  try {
    await Promise.race([
      (async () => {
        await connection.initialize({
          clientCapabilities: {
            fs: { readTextFile: true, writeTextFile: true },
          },
          protocolVersion: PROTOCOL_VERSION,
        });

        const auto = args.input.auto ?? "read";
        const session = await connection.newSession({
          cwd: spec.sessionCw,
          mcpServers: [],
          ...(args.input.sessionId ? { sessionId: args.input.sessionId } : {}),
          ...(args.input.model ? { model: args.input.model } : {}),
          mode: mapAutonomyToAcpMode(auto),
        } as any);

        const promptResult = await connection.prompt({
          prompt: [{ type: "text", text: args.input.prompt }],
          sessionId: session.sessionId,
        });

        return promptResult;
      })(),
      abortPromise(args.signal),
      readStderr(),
    ]);
  } catch (error) {
    logger.warn("opencode_exec_failed", {
      error: error instanceof Error ? error.message : String(error),
      stderr: stderrChunks.join("").slice(0, 2000),
    });
    proc.kill();
    throw error;
  } finally {
    clearTimeout(timer);
    proc.kill();
  }

  return { artifacts, result: text, stopReason: undefined };
}

export async function executeWithOpenCode({
  input,
  writer,
  signal,
}: ToolExecuteContext<OpenCodeToolInput>): Promise<OpenCodeToolOutput> {
  const profile = "server" as const;
  if (profile !== "server") {
    return execOnce({ input, signal, writer });
  }
  // Validate container cwd eagerly so we don't wrap it as a server-start failure.
  normalizeContainerCw(input.containerCw);

  const key = serverKey({
    containerName: input.containerName,
    executor: "opencode",
  });

  let server: OpenCodeServer;
  try {
    server = (await ensureServer({
      healthy: (handle): boolean => {
        const s = handle as OpenCodeServer;
        return !s.exited;
      },
      key,
      start: () => startOpenCodeServer({ input }),
    })) as OpenCodeServer;
  } catch (error) {
    const err = new Error("opencode_server_start_failed");
    (err as unknown as { cause?: unknown }).cause = error;
    if (!(isExecProfileStrict() || signal?.aborted)) {
      executorServerFallbackTotal.inc({ executor: "opencode" });
      void Promise.resolve(
        writer?.write?.({
          message: "executor_server_fallback_default",
          type: "notice",
        })
      ).catch(() => {});
      return execOnce({ input, signal, writer });
    }
    throw err;
  }

  try {
    const out = await server.runPrompt({
      input,
      prompt: input.prompt,
      signal,
      writer,
    });

    return out;
  } catch (error) {
    logger.warn("opencode_server_exec_failed", {
      containerName: input.containerName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export const __internals = {
  dockerEnvAllowlist: OPENCODE_DOCKER_ENV_ALLOWLIST,
  resetConnection: () => {
    createConnection = (factory, stream) =>
      new ClientSideConnection(factory, stream);
  },
  resetSpawn: () => {
    spawnProc = spawn;
  },
  setConnection: (fn: CreateConnection) => {
    createConnection = fn;
  },
  setSpawn: (fn: SpawnProc) => {
    spawnProc = fn;
  },
};
