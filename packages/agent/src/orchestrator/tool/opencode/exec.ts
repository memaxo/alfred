import { logger } from "@alfred/logger";
import {
  type Client,
  ClientSideConnection,
  mapAutonomyToAcpMode,
  ndJsonStream,
  PROTOCOL_VERSION,
  type Stream,
} from "@alfred/protocol/acp";
import type { FileSink } from "bun";
import { spawn } from "bun";
import type { ToolExecuteContext } from "../shared/context.js";
import { executorServerFallbackTotal } from "../shared/metrics.js";
import {
  ensureServer,
  isExecProfileStrict,
  resolveExecProfile,
  type ServerHandle,
  serverKey,
} from "../shared/server.js";
import type { OpenCodeToolInput, OpenCodeToolOutput } from "./definition.js";

type AgentCmd = { cmd: string; args: string[] };
type Writer = ToolExecuteContext<OpenCodeToolInput>["writer"];

const DEFAULT_CONTAINER_CW = "/workspace";
const AGENTFS_CONTAINER_PREFIX = "alfred-agentfs-";

const OPENCODE_DOCKER_ENV_ALLOWLIST = [
  "CEREBRAS_API_KEY",
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
  const args =
    input.args ?? splitArgs(process.env.OPENCODE_ACP_ARGS ?? "").slice();

  return { cmd, args };
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
      type: "stdout",
      event: { type: "output", content: text, timestamp: Date.now() },
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
      type: "stdout",
      event: { type: "command", command: title, status, timestamp: Date.now() },
    })
  ).catch(() => {});
}

type ClientCtx = {
  writer: Writer;
  auto: OpenCodeToolInput["auto"];
  append: (text: string) => void;
};

function createClient(
  getCtx: (sessionId: string) => ClientCtx | undefined
): Client {
  return {
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
      const update = params.update;
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

      if (kind === "tool_call") {
        const title = (update as { title?: unknown }).title;
        const status = (update as { status?: unknown }).status;
        const titleStr = typeof title === "string" ? title : "tool_call";
        const statusStr = status === "failed" ? "failed" : "running";
        emitCommand(writer, titleStr, statusStr);
        return;
      }

      if (kind === "tool_call_update") {
        const status = (update as { status?: unknown }).status;
        const id = (update as { toolCallId?: unknown }).toolCallId;
        const titleStr =
          typeof id === "string" ? `tool_call:${id}` : "tool_call";
        const mapped =
          status === "completed"
            ? "completed"
            : status === "failed"
              ? "failed"
              : "running";
        emitCommand(writer, titleStr, mapped);
      }
    },

    async readTextFile(_params: unknown) {
      return { content: "" };
    },
    async writeTextFile(_params: unknown) {
      return {};
    },
  };
}

function sinkToWritableStream(sink: FileSink): WritableStream<Uint8Array> {
  return new WritableStream<Uint8Array>({
    write(chunk) {
      sink.write(chunk);
    },
    async close() {
      await sink.end();
    },
    async abort(reason) {
      await sink.end(reason instanceof Error ? reason : undefined);
    },
  });
}

type SpawnSpec = {
  argv: string[];
  cwd: string | undefined;
  sessionCw: string;
};

function resolveSpawnSpec(input: OpenCodeToolInput, cmd: AgentCmd): SpawnSpec {
  if (input.containerName) {
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

  const cwd = input.cw ? pathResolveSafe(input.cw) : undefined;
  return {
    argv: [cmd.cmd, ...cmd.args],
    cwd,
    sessionCw: cwd ?? process.cwd(),
  };
}

type SessionState = {
  writer: Writer;
  auto: OpenCodeToolInput["auto"];
  append: (text: string) => void;
};

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
  if (!args.input.containerName) {
    throw new Error("opencode_server_requires_container");
  }

  const cmd = resolveAgentCmd(args.input);
  const spec = resolveSpawnSpec(args.input, cmd);

  const proc = spawnProc(spec.argv, {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    cwd: spec.cwd,
    env: process.env,
  });

  if (!proc.stdin || typeof proc.stdin === "number") {
    proc.kill();
    throw new Error("opencode_stdin_unavailable");
  }
  if (!proc.stdout || typeof proc.stdout === "number") {
    proc.kill();
    throw new Error("opencode_stdout_unavailable");
  }

  const sessions = new Map<string, SessionState>();
  const getCtx = (sessionId: string): ClientCtx | undefined => {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }
    return {
      writer: session.writer,
      auto: session.auto,
      append: session.append,
    };
  };

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
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
    },
  });

  const withLock = createPromptLock();

  return {
    get exited() {
      return exited;
    },
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
    runPrompt: async ({ input, writer, signal, prompt }) =>
      withLock(async () => {
        const sessionText: { value: string } = { value: "" };
        const append = (delta: string) => {
          sessionText.value += delta;
        };

        const sessionCw = input.containerName
          ? normalizeContainerCw(input.containerCw)
          : (input.cw ?? process.cwd());

        const session = await connection.newSession({
          cwd: sessionCw,
          mcpServers: [],
          ...(input.sessionId ? { sessionId: input.sessionId } : {}),
          ...(input.model ? { model: input.model } : {}),
          mode: mapAutonomyToAcpMode(input.auto),
        } as any);

        sessions.set(session.sessionId, {
          writer,
          auto: input.auto,
          append,
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
          artifacts: [],
          stopReason: undefined,
        };
      }),
  };
}

async function execOnce(args: ToolExecuteContext<OpenCodeToolInput>) {
  const timeoutMs = (args.input.timeoutSec ?? 20 * 60) * 1000;
  const cmd = resolveAgentCmd(args.input);
  const spec = resolveSpawnSpec(args.input, cmd);

  const proc = spawnProc(spec.argv, {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    cwd: spec.cwd,
    env: process.env,
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

  const ctx: ClientCtx = {
    writer: args.writer,
    auto: args.input.auto,
    append,
  };

  const connection = new ClientSideConnection(
    () => createClient(() => ctx),
    stream
  );

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
          args.writer?.write?.({ type: "stderr", text: chunk })
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
          protocolVersion: PROTOCOL_VERSION,
          clientCapabilities: {
            fs: { readTextFile: true, writeTextFile: true },
          },
        });

        const session = await connection.newSession({
          cwd: spec.sessionCw,
          mcpServers: [],
          ...(args.input.sessionId ? { sessionId: args.input.sessionId } : {}),
          ...(args.input.model ? { model: args.input.model } : {}),
          mode: mapAutonomyToAcpMode(args.input.auto),
        } as any);

        const promptResult = await connection.prompt({
          sessionId: session.sessionId,
          prompt: [{ type: "text", text: args.input.prompt }],
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

  return { result: text, artifacts: [], stopReason: undefined };
}

export async function executeWithOpenCode({
  input,
  writer,
  signal,
}: ToolExecuteContext<OpenCodeToolInput>): Promise<OpenCodeToolOutput> {
  const profile = resolveExecProfile(input.execProfile, input.containerName);
  if (profile !== "server") {
    return execOnce({ input, writer, signal });
  }
  if (!input.containerName) {
    throw new Error("opencode_server_requires_container");
  }
  // Validate container cwd eagerly so we don't wrap it as a server-start failure.
  normalizeContainerCw(input.containerCw);

  const key = serverKey({
    containerName: input.containerName,
    executor: "opencode",
    profile,
  });

  let server: OpenCodeServer;
  try {
    server = (await ensureServer({
      key,
      start: () => startOpenCodeServer({ input }),
      healthy: (handle): boolean => {
        const s = handle as OpenCodeServer;
        return !s.exited;
      },
    })) as OpenCodeServer;
  } catch (error) {
    const err = new Error("opencode_server_start_failed");
    (err as unknown as { cause?: unknown }).cause = error;
    if (!(isExecProfileStrict() || signal?.aborted)) {
      executorServerFallbackTotal.inc({ executor: "opencode" });
      void Promise.resolve(
        writer?.write?.({
          type: "notice",
          message: "executor_server_fallback_default",
        })
      ).catch(() => {});
      return execOnce({ input, writer, signal });
    }
    throw err;
  }

  try {
    return await server.runPrompt({
      input,
      writer,
      signal,
      prompt: input.prompt,
    });
  } catch (error) {
    logger.warn("opencode_server_exec_failed", {
      error: error instanceof Error ? error.message : String(error),
      containerName: input.containerName,
    });
    throw error;
  }
}

function pathResolveSafe(cw: string): string {
  try {
    return cw.trim().length > 0 ? cw : process.cwd();
  } catch {
    return process.cwd();
  }
}

export const __internals = {
  setSpawn: (fn: SpawnProc) => {
    spawnProc = fn;
  },
  resetSpawn: () => {
    spawnProc = spawn;
  },
  setConnection: (fn: CreateConnection) => {
    createConnection = fn;
  },
  resetConnection: () => {
    createConnection = (factory, stream) =>
      new ClientSideConnection(factory, stream);
  },
};
