import type {
  AgentFileBeforeEvent,
  AgentShellBeforeEvent,
  HookContext,
  HookRegistry,
} from "@alfred/type";
import type { FileSink, Subprocess } from "bun";

import { logger } from "@alfred/logger";
import * as path from "node:path";

import type { DirectoryHandle } from "../../../security/filesystem.js";
import type { CodexToolInput } from "./definition.js";

import { spawnWithSecureCwd } from "../../../security/secure-spawn.js";
import {
  ensureServer,
  type ServerHandle,
  serverKey,
} from "../shared/server.js";
import { mapAutoToCodex, pickEnvCodex, resolveExecutable } from "./policy.js";

type Writer = { write?: (chunk: unknown) => Promise<void> | void } | undefined;

type AllowedDirectoryHandle = DirectoryHandle;

type JsonRpcId = number;

interface JsonRpcRequest {
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

interface JsonRpcNotification {
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  id: JsonRpcId;
  result?: unknown;
  error?: unknown;
}

interface TurnState {
  threadId: string;
  turnId: string;
  auto: CodexToolInput["auto"];
  writer: Writer;
  signal?: AbortSignal;
  hooks?: HooksRuntime | null;
  text: string;
  artifacts: { path: string; kind: string }[];
  resolve: () => void;
  reject: (error: unknown) => void;
  done: Promise<void>;
  status: "running" | "completed" | "failed" | "interrupted";
}

interface HooksRuntime {
  readonly registry: HookRegistry;
  readonly ctx: HookContext;
}

type CodexServer = ServerHandle & {
  exited: boolean;
  exec: (args: {
    input: CodexToolInput;
    writer: Writer;
    signal?: AbortSignal;
    containerCw: string;
  }) => Promise<{
    result: string;
    artifacts: { path: string; kind: string }[];
  }>;
};

const DEFAULT_CONTAINER_CW = "/workspace";

type SpawnOptions = Parameters<typeof spawnWithSecureCwd>[0];
type SpawnProc = (options: SpawnOptions) => Subprocess;

let spawnProc: SpawnProc = spawnWithSecureCwd;

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

async function* readLines(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const idx = buffer.indexOf("\n");
        if (idx === -1) {
          break;
        }
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        yield line;
      }
    }

    buffer += decoder.decode();
    if (buffer.length > 0) {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function emit(
  writer: Writer,
  payload: { type: "stdout" | "stderr" | "notice"; [k: string]: unknown }
) {
  void Promise.resolve(writer?.write?.(payload)).catch(() => {});
}

function emitNotice(writer: Writer, message: string) {
  emit(writer, { type: "notice", message });
}

function emitCommand(
  writer: Writer,
  command: string,
  status: "running" | "completed" | "failed"
) {
  emit(writer, {
    type: "stdout",
    event: { type: "command", command, status, timestamp: Date.now() },
  });
}

function emitArtifact(writer: Writer, filePath: string, kind: string) {
  emit(writer, {
    type: "stdout",
    event: { type: "artifact", path: filePath, kind, timestamp: Date.now() },
  });
}

function emitOutput(writer: Writer, text: string) {
  if (!text) {
    return;
  }
  emit(writer, {
    type: "stdout",
    event: { type: "output", content: text, timestamp: Date.now() },
  });
}

function coerceParams(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function parseCommandForApproval(
  params: Record<string, unknown> | null
): string {
  const command =
    (params ? asString(params.command) : undefined) ??
    (params ? asString(params.cmd) : undefined) ??
    (params ? asString(params.value) : undefined);
  return command ?? "command";
}

function parsePatchForApproval(params: Record<string, unknown> | null): string {
  const patch =
    (params ? asString(params.patch) : undefined) ??
    (params ? asString(params.diff) : undefined) ??
    (params ? asString(params.value) : undefined);
  return patch ?? "";
}

function guessPatchPath(patch: string): string | undefined {
  const lines = patch.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const m1 = /^\*\*\* (?:Update File|Add File|Delete File):\s+(.+)$/.exec(
      trimmed
    );
    if (m1?.[1]) {
      return m1[1].trim();
    }
    const m2 = /^diff --git a\/(.+) b\//.exec(trimmed);
    if (m2?.[1]) {
      return m2[1].trim();
    }
  }
  return;
}

async function maybeCreateHooksRuntime(args: {
  projectDir: string;
  sessionId: string;
  workflowId: string | undefined;
  signal: AbortSignal;
}): Promise<HooksRuntime | null> {
  const hooksFile = path.join(args.projectDir, "hooks.json");
  try {
    if (!(await Bun.file(hooksFile).exists())) {
      return null;
    }
  } catch {
    return null;
  }

  const { createHookRegistry, loadHooksJsonFile } =
    await import("@alfred/hooks");

  const registry = createHookRegistry();

  try {
    registry.loadConfig(await loadHooksJsonFile(hooksFile));
  } catch (error) {
    logger.warn("codex_server_hooks_config_load_failed", {
      error: error instanceof Error ? error.message : String(error),
      hooksFile,
    });
    return null;
  }

  const ctx: HookContext = {
    sessionId: args.sessionId,
    workflowId: args.workflowId,
    autonomy: 0.5,
    cognitive: {
      state: "idle",
      autonomy: 0.5,
      physiology: { energy: 1, boredom: 0, frustration: 0 },
    },
    alfredVersion: process.env.ALFRED_VERSION ?? "dev",
    projectDir: args.projectDir,
    emit: async () => {},
    signal: args.signal,
    log: {
      debug: (msg, data) => logger.debug(msg, data as any),
      info: (msg, data) => logger.info(msg, data as any),
      warn: (msg, data) => logger.warn(msg, data as any),
      error: (msg, data) => logger.error(msg, data as any),
    },
  };

  return { ctx, registry };
}

function createLock() {
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

function createDeferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = () => res();
    reject = (error) => rej(error);
  });
  return { promise, resolve, reject };
}

function normalizeContainerCw(raw: string | undefined): string {
  const v = raw?.trim() || DEFAULT_CONTAINER_CW;
  const normalized = v.startsWith("/") ? v : `/${v}`;
  if (
    !normalized.startsWith("/workspace") ||
    (normalized !== "/workspace" && !normalized.startsWith("/workspace/"))
  ) {
    throw new Error("codex_container_cwd_invalid");
  }
  return normalized;
}

function writeJsonLine(
  sink: WritableStream<Uint8Array>,
  value: unknown
): Promise<void> {
  const line = `${JSON.stringify(value)}\n`;
  const bytes = new TextEncoder().encode(line);
  const writer = sink.getWriter();
  return writer.write(bytes).finally(() => writer.releaseLock());
}

function parseMessage(
  line: string
): JsonRpcRequest | JsonRpcResponse | JsonRpcNotification | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const method = asString(parsed.method);
  const { id } = parsed;
  if (typeof id === "number") {
    const base: JsonRpcResponse = { id };
    if ("result" in parsed) {
      base.result = parsed.result;
    }
    if ("error" in parsed) {
      base.error = parsed.error;
    }
    if (method) {
      return { id, method, params: parsed.params } satisfies JsonRpcRequest;
    }
    return base;
  }
  if (method) {
    return { method, params: parsed.params } satisfies JsonRpcNotification;
  }
  return null;
}

async function startServer(args: {
  input: CodexToolInput;
  cwdHandle: AllowedDirectoryHandle;
}): Promise<CodexServer> {
  const containerName = args.input.containerName?.trim();
  if (!containerName) {
    throw new Error("codex_server_requires_container");
  }

  const containerCw = normalizeContainerCw(args.input.containerCw);
  const envBase = pickEnvCodex(args.input.env);
  const envWithAgentFS = args.input.agentfsDbPath
    ? { ...envBase, AGENTFS_DB_PATH: args.input.agentfsDbPath }
    : envBase;

  const serverAbort = new AbortController();

  const dockerBin = resolveExecutable("docker");
  const envKeys = Object.keys(envWithAgentFS ?? {}).filter((k) => k !== "PATH");

  const dockerArgs = [
    "exec",
    "-i",
    "--workdir",
    containerCw,
    ...envKeys.flatMap((k) => ["-e", k]),
    containerName,
    "codex",
    "app-server",
  ];

  const proc = spawnProc({
    cwdHandle: args.cwdHandle,
    cmd: dockerBin,
    args: dockerArgs,
    env: envWithAgentFS,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  if (!proc.stdin || typeof proc.stdin === "number") {
    proc.kill();
    throw new Error("codex_server_stdin_unavailable");
  }
  if (!proc.stdout || typeof proc.stdout === "number") {
    proc.kill();
    throw new Error("codex_server_stdout_unavailable");
  }

  let exited = false;
  void proc.exited
    .then(() => {
      exited = true;
    })
    .catch(() => {
      exited = true;
    });

  const stdin = sinkToWritableStream(proc.stdin as FileSink);
  const pending = new Map<
    JsonRpcId,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >();
  let nextId = 1;

  const threads = new Map<string, string>();
  const lock = createLock();
  const turns = new Map<string, TurnState>();
  const pendingText = new Map<string, string>();
  const pendingStatus = new Map<string, string>();
  let activeTurnId: string | null = null;
  let currentHooks: HooksRuntime | null = null;

  const request = async <T = unknown>(
    method: string,
    params?: unknown
  ): Promise<T> => {
    const id = nextId++;
    const message: JsonRpcRequest = {
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    };

    const promise = new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    });

    try {
      await writeJsonLine(stdin, message);
    } catch (error) {
      pending.delete(id);
      throw error;
    }

    return await promise;
  };

  const notify = async (method: string, params?: unknown): Promise<void> => {
    const msg: JsonRpcNotification = {
      method,
      ...(params !== undefined ? { params } : {}),
    };
    await writeJsonLine(stdin, msg);
  };

  const handleNotification = (note: JsonRpcNotification) => {
    const { method } = note;
    const params = isRecord(note.params) ? note.params : null;

    if (method === "item/agentMessage/delta") {
      const delta = params ? asString(params.delta) : undefined;
      const turnId = params ? asString(params.turnId) : undefined;
      if (!(delta && turnId)) {
        return;
      }
      const turn = turns.get(turnId);
      if (!turn) {
        pendingText.set(turnId, (pendingText.get(turnId) ?? "") + delta);
        return;
      }
      turn.text += delta;
      emitOutput(turn.writer, delta);
      return;
    }

    if (method === "item/started" || method === "item/completed") {
      const item = params && isRecord(params.item) ? params.item : null;
      const turnId = params ? asString(params.turnId) : undefined;
      if (!(item && turnId)) {
        return;
      }
      const turn = turns.get(turnId);
      if (!turn) {
        return;
      }

      const itemType = asString(item.type);
      if (itemType === "commandExecution") {
        const command = asString(item.command) ?? "command";
        const status = asString(item.status) ?? "";
        const mapped =
          status === "failed" || status === "declined"
            ? "failed"
            : status === "completed"
              ? "completed"
              : "running";
        emitCommand(turn.writer, command, mapped);
        return;
      }

      if (itemType === "fileChange") {
        const changes = Array.isArray(item.changes) ? item.changes : [];
        for (const change of changes) {
          if (!isRecord(change)) {
            continue;
          }
          const filePath = asString(change.path);
          const kind = "file";
          if (!filePath) {
            continue;
          }
          turn.artifacts.push({ path: filePath, kind });
          emitArtifact(turn.writer, filePath, kind);
        }
      }
      return;
    }

    if (method === "turn/completed") {
      if (!params) {
        return;
      }
      const turn = isRecord(params.turn) ? params.turn : null;
      if (!turn) {
        return;
      }
      const turnId = asString(turn.id);
      if (!turnId) {
        return;
      }

      const status = asString(turn.status) ?? "";
      const state = turns.get(turnId);
      if (!state) {
        pendingStatus.set(turnId, status);
        return;
      }

      state.status =
        status === "interrupted"
          ? "interrupted"
          : status === "failed"
            ? "failed"
            : "completed";

      if (state.status === "failed") {
        const errRecord = isRecord(turn.error) ? turn.error : null;
        const errMsg =
          (errRecord ? asString(errRecord.message) : null) ??
          asString((turn as Record<string, unknown>).failureReason) ??
          asString((turn as Record<string, unknown>).reason);
        let payload = "";
        if (!errMsg) {
          try {
            payload = JSON.stringify(turn).slice(0, 2000);
          } catch {
            payload = "";
          }
        }
        state.reject(
          new Error(
            errMsg
              ? `codex_server_turn_failed: ${errMsg}`
              : payload
                ? `codex_server_turn_failed: ${payload}`
                : "codex_server_turn_failed"
          )
        );
      } else if (state.status === "interrupted") {
        state.reject(new DOMException("Aborted", "AbortError"));
      } else {
        state.resolve();
      }
      turns.delete(turnId);
      if (activeTurnId === turnId) {
        activeTurnId = null;
      }
      return;
    }
  };

  const handleServerRequest = async (req: JsonRpcRequest) => {
    const auto = activeTurnId
      ? (turns.get(activeTurnId)?.auto ?? "read")
      : "read";
    const allow = auto !== "read";
    const decision = allow ? "approved" : "denied";

    const active = activeTurnId ? turns.get(activeTurnId) : undefined;
    const hooks = active?.hooks ?? currentHooks;

    if (hooks) {
      const params = coerceParams(req.params);
      const ctx: HookContext = {
        ...hooks.ctx,
        signal: active?.signal ?? hooks.ctx.signal,
      };

      if (req.method === "execCommandApproval") {
        const cmd = parseCommandForApproval(params);
        const hookEvent: AgentShellBeforeEvent = {
          type: "agent:shell:before",
          command: cmd,
          cwd: hooks.ctx.projectDir ?? process.cwd(),
        };

        const out = await hooks.registry.emit(hookEvent, ctx);
        const allowByHook = out.decision === "allow";
        if (!allowByHook) {
          emitNotice(
            active?.writer,
            out.userMessage ?? out.reason ?? "hook_denied:agent:shell:before"
          );
        }

        await writeJsonLine(stdin, {
          id: req.id,
          result: { decision: { type: allowByHook ? "approved" : "denied" } },
        });
        return;
      }

      if (req.method === "applyPatchApproval") {
        const patch = parsePatchForApproval(params);
        const guessed = patch ? guessPatchPath(patch) : undefined;
        const hookEvent: AgentFileBeforeEvent = {
          type: "agent:file:before",
          filePath: guessed ?? "patch",
          operation: "write",
          content: patch || undefined,
        };

        const out = await hooks.registry.emit(hookEvent, ctx);
        const allowByHook = out.decision === "allow";
        if (!allowByHook) {
          emitNotice(
            active?.writer,
            out.userMessage ?? out.reason ?? "hook_denied:agent:file:before"
          );
        }

        await writeJsonLine(stdin, {
          id: req.id,
          result: { decision: { type: allowByHook ? "approved" : "denied" } },
        });
        return;
      }
    }

    if (
      req.method === "applyPatchApproval" ||
      req.method === "execCommandApproval"
    ) {
      await writeJsonLine(stdin, {
        id: req.id,
        result: { decision: { type: decision } },
      });
      return;
    }

    await writeJsonLine(stdin, {
      id: req.id,
      error: { message: "method_not_supported" },
    });
  };

  const stdoutLoop = (async () => {
    for await (const line of readLines(
      proc.stdout as ReadableStream<Uint8Array>
    )) {
      const msg = parseMessage(line);
      if (!msg) {
        continue;
      }
      if (
        "id" in msg &&
        typeof msg.id === "number" &&
        ("result" in msg || "error" in msg)
      ) {
        const entry = pending.get(msg.id);
        pending.delete(msg.id);
        if (!entry) {
          continue;
        }
        if (msg.error) {
          entry.reject(msg.error);
        } else {
          entry.resolve(msg.result);
        }
        continue;
      }
      if ("method" in msg && "id" in msg) {
        void handleServerRequest(msg as JsonRpcRequest).catch(() => {});
        continue;
      }
      if ("method" in msg && !("id" in msg)) {
        handleNotification(msg as JsonRpcNotification);
      }
    }
  })();

  const stderrLoop = (async () => {
    if (!proc.stderr || typeof proc.stderr === "number") {
      return;
    }
    const reader = (proc.stderr as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const text = decoder.decode(value, { stream: true });
        const active = activeTurnId ? turns.get(activeTurnId) : undefined;
        emit(active?.writer, { type: "stderr", text });
      }
    } catch {
      // ignore
    } finally {
      reader.releaseLock();
    }
  })();

  // Initialize handshake (required before any other request).
  await request("initialize", {
    clientInfo: { name: "alfred", title: "ALFRED", version: "0" },
  });
  await notify("initialized");

  return {
    get exited() {
      return exited;
    },
    stop: async () => {
      try {
        serverAbort.abort();
      } catch {
        // ignore
      }
      try {
        proc.kill();
      } catch {
        // ignore
      }
      await Promise.allSettled([stdoutLoop, stderrLoop, proc.exited]);
    },
    exec: async ({ input, writer, signal, containerCw: runCw }) =>
      lock(async () => {
        const sessionKey = input.sessionId?.trim() || "default";

        const hooksDir =
          typeof input.cw === "string" && input.cw.trim().length > 0
            ? input.cw
            : args.cwdHandle.path;

        currentHooks = await maybeCreateHooksRuntime({
          projectDir: hooksDir,
          sessionId: sessionKey,
          workflowId: isRecord(input.context)
            ? asString(
                (input.context as unknown as Record<string, unknown>).workflowId
              )
            : undefined,
          signal: serverAbort.signal,
        });

        try {
          let threadId = threads.get(sessionKey);
          if (!threadId) {
            const sandbox = mapAutoToCodex(input.auto);
            const startRes = (await request("thread/start", {
              model: input.model ?? null,
              modelProvider: null,
              cwd: runCw,
              approvalPolicy: sandbox.approval,
              sandbox: sandbox.sandbox,
              config: null,
              baseInstructions: null,
              developerInstructions: null,
              experimentalRawEvents: false,
            })) as unknown;

            const thread =
              isRecord(startRes) && isRecord(startRes.thread)
                ? startRes.thread
                : null;
            const id = thread ? asString(thread.id) : undefined;
            if (!id) {
              throw new Error("codex_server_thread_start_failed");
            }
            threadId = id;
            threads.set(sessionKey, threadId);
          }

          const artifacts: { path: string; kind: string }[] = [];

          const turnStartRes = (await request("turn/start", {
            threadId,
            input: [{ type: "text", text: input.prompt }],
            model: input.model ?? null,
          })) as unknown;

          const turn =
            isRecord(turnStartRes) && isRecord(turnStartRes.turn)
              ? turnStartRes.turn
              : null;
          const turnId = turn ? asString(turn.id) : undefined;
          if (!turnId) {
            throw new Error("codex_server_turn_start_failed");
          }

          const deferred = createDeferred();
          const turnState: TurnState = {
            threadId,
            turnId,
            auto: input.auto,
            writer,
            signal,
            hooks: currentHooks,
            text: "",
            artifacts,
            resolve: deferred.resolve,
            reject: deferred.reject,
            done: deferred.promise,
            status: "running",
          };
          turns.set(turnId, turnState);
          activeTurnId = turnId;

          const earlyText = pendingText.get(turnId);
          if (earlyText) {
            pendingText.delete(turnId);
            turnState.text += earlyText;
            emitOutput(writer, earlyText);
          }

          const earlyStatus = pendingStatus.get(turnId);
          if (earlyStatus) {
            pendingStatus.delete(turnId);
            turns.delete(turnId);
            if (activeTurnId === turnId) {
              activeTurnId = null;
            }
            if (earlyStatus === "interrupted") {
              turnState.status = "interrupted";
              turnState.reject(new DOMException("Aborted", "AbortError"));
            } else if (earlyStatus === "failed") {
              turnState.status = "failed";
              turnState.reject(new Error("codex_server_turn_failed"));
            } else {
              turnState.status = "completed";
              turnState.resolve();
            }
          }

          let didTimeout = false;
          const timeoutMs = (input.timeoutSec ?? 20 * 60) * 1000;
          const timer = setTimeout(() => {
            didTimeout = true;
            void request("turn/interrupt", { threadId, turnId }).catch(
              () => {}
            );
          }, timeoutMs);
          (timer as unknown as { unref?: () => void }).unref?.();

          const onAbort = () => {
            void request("turn/interrupt", { threadId, turnId }).catch(
              () => {}
            );
          };
          if (signal) {
            if (signal.aborted) {
              onAbort();
            } else {
              signal.addEventListener("abort", onAbort, { once: true });
            }
          }

          let finalText = "";
          try {
            await Promise.race([
              deferred.promise,
              new Promise<never>((_, reject) => {
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
              }),
            ]);
            finalText = turnState.text;
          } finally {
            clearTimeout(timer);
            if (signal) {
              signal.removeEventListener("abort", onAbort);
            }
            turns.delete(turnId);
            if (activeTurnId === turnId) {
              activeTurnId = null;
            }
          }

          if (didTimeout) {
            throw new Error("codex_server_turn_timeout");
          }

          return { result: finalText, artifacts };
        } finally {
          currentHooks = null;
        }
      }),
  };
}

export async function executeWithCodexServer(args: {
  input: CodexToolInput;
  writer: Writer;
  signal?: AbortSignal;
  cwdHandle: AllowedDirectoryHandle;
}): Promise<{
  result: string;
  artifacts: { path: string; kind: string }[];
}> {
  if (!args.input.containerName) {
    throw new Error("codex_server_requires_container");
  }
  const key = serverKey({
    containerName: args.input.containerName,
    executor: "codex",
    profile: "server",
  });
  const containerCw = normalizeContainerCw(args.input.containerCw);
  let server: CodexServer;
  try {
    server = (await ensureServer({
      key,
      start: () =>
        startServer({ input: args.input, cwdHandle: args.cwdHandle }),
      healthy: (handle) => {
        const s = handle as CodexServer;
        return !s.exited;
      },
    })) as CodexServer;
  } catch (error) {
    const err = new Error("codex_server_start_failed");
    (err as unknown as { cause?: unknown }).cause = error;
    throw err;
  }

  return server.exec({
    input: args.input,
    writer: args.writer,
    signal: args.signal,
    containerCw,
  });
}

export const __internals = {
  setSpawn: (fn: SpawnProc) => {
    spawnProc = fn;
  },
  resetSpawn: () => {
    spawnProc = spawnWithSecureCwd;
  },
};
