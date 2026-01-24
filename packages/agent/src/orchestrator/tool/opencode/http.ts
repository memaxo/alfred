import { logger } from "@alfred/logger";
import {
  type GlobalEvent,
  type Part,
  type SessionMessageResponse,
} from "@opencode-ai/sdk";
import { spawn } from "bun";

import { type ToolExecuteContext } from "../shared/context.js";
import { resolveExecProfile } from "../shared/server.js";
import {
  type OpenCodeToolInput,
  type OpenCodeToolOutput,
} from "./definition.js";
import {
  ensureOpenCodeHttpServer,
  type OpenCodeHttpServerHandle,
  startOpenCodeHttpServer,
} from "./server.js";

type Writer = ToolExecuteContext<OpenCodeToolInput>["writer"];

type SpawnProc = typeof spawn;
let spawnProc: SpawnProc = spawn;

let makeId: () => string = () => crypto.randomUUID();

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

function mapModel(
  raw: string | undefined
): { providerID: string; modelID: string } | undefined {
  const v = raw?.trim();
  if (!v) {
    return;
  }
  const idx = v.indexOf("/");
  if (idx <= 0 || idx >= v.length - 1) {
    return;
  }
  return { modelID: v.slice(idx + 1), providerID: v.slice(0, idx) };
}

async function* parseSseStream(args: {
  stream: ReadableStream<Uint8Array>;
  signal: AbortSignal;
}): AsyncGenerator<unknown> {
  const reader = args.stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const abortHandler = () => {
    try {
      reader.cancel();
    } catch {
      // ignore
    }
  };

  args.signal.addEventListener("abort", abortHandler);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes("\r\n")) {
        buffer = buffer.replaceAll(/\r\n/g, "\n");
      }

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const lines = chunk.split("\n");
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith("data:")) {
            dataLines.push(line.replace(/^data:\s*/, ""));
          }
        }
        if (dataLines.length === 0) {
          continue;
        }
        const raw = dataLines.join("\n");
        try {
          yield JSON.parse(raw);
        } catch {
          yield raw;
        }
      }
    }
  } finally {
    args.signal.removeEventListener("abort", abortHandler);
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

function toHeaderRecord(
  headers: Array<{ name: string; value: string }> | undefined
): Record<string, string> | undefined {
  if (!headers || headers.length === 0) {
    return;
  }
  const out: Record<string, string> = {};
  for (const h of headers) {
    const k = h.name.trim();
    if (!k) {
      continue;
    }
    out[k] = h.value;
  }
  return out;
}

async function ensureMcp(
  handle: OpenCodeHttpServerHandle,
  input: OpenCodeToolInput
) {
  const list = input.mcpServers ?? [];
  if (list.length === 0) {
    return;
  }

  for (const s of list) {
    const headers = toHeaderRecord(s.headers);
    const fingerprint = JSON.stringify({ headers, url: s.url });
    const prev = handle.mcpInstalled.get(s.name);
    if (prev === fingerprint) {
      continue;
    }

    await handle.client.mcp.add({
      body: {
        config: {
          type: "remote",
          url: s.url,
          headers,
        },
        name: s.name,
      },
    });
    handle.mcpInstalled.set(s.name, fingerprint);
  }
}

async function ensureSession(args: {
  handle: OpenCodeHttpServerHandle;
  sessionKey: string | undefined;
}): Promise<string> {
  const key = args.sessionKey?.trim();
  if (key) {
    const existing = args.handle.sessionByAlfred.get(key);
    if (existing) {
      return existing;
    }
    const created = await args.handle.client.session.create({
      body: {
        title: `alfred:${key}`,
      },
      throwOnError: true,
    });
    const { id } = created.data;
    args.handle.sessionByAlfred.set(key, id);
    return id;
  }

  const created = await args.handle.client.session.create({
    body: {
      title: `alfred:${crypto.randomUUID()}`,
    },
    throwOnError: true,
  });
  return created.data.id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function isGlobalEvent(value: unknown): value is GlobalEvent {
  if (!isRecord(value)) {
    return false;
  }

  const dir = (value as { directory?: unknown }).directory;
  const { payload } = value as { payload?: unknown };
  if (typeof dir !== "string" || !isRecord(payload)) {
    return false;
  }
  return typeof (payload as { type?: unknown }).type === "string";
}

async function runPrompt(args: {
  handle: OpenCodeHttpServerHandle;
  sessionId: string;
  input: OpenCodeToolInput;
  writer: Writer;
  signal: AbortSignal;
}): Promise<OpenCodeToolOutput> {
  const auto = args.input.auto ?? "read";
  const messageId = `alfred_${makeId().replaceAll(/-/g, "")}`;
  const model = mapModel(args.input.model);

  await ensureMcp(args.handle, args.input);

  const sseAbort = new AbortController();
  const abortHandler = () => sseAbort.abort();
  args.signal.addEventListener("abort", abortHandler);

  const artifacts: { path: string; kind: string }[] = [];
  const artifactSet = new Set<string>();
  let out = "";

  const authHeader =
    args.handle.username && args.handle.password
      ? `Basic ${Buffer.from(`${args.handle.username}:${args.handle.password}`, "utf8").toString("base64")}`
      : undefined;

  const sseProc = args.handle.containerName
    ? spawnProc(
        [
          "docker",
          "exec",
          "-i",
          args.handle.containerName,
          "curl",
          "-sS",
          "-N",
          "-H",
          "accept: text/event-stream",
          ...(authHeader ? ["-H", `authorization: ${authHeader}`] : []),
          `${args.handle.baseUrl}/event`,
        ],
        {
          env: process.env,
          stderr: "pipe",
          stdin: "ignore",
          stdout: "pipe",
        }
      )
    : null;

  if (!sseProc?.stdout || typeof sseProc.stdout === "number") {
    throw new Error("opencode_http_sse_unavailable");
  }

  const sseTask = (async () => {
    let sawIdle = false;
    for await (const evt of parseSseStream({
      signal: sseAbort.signal,
      stream: sseProc.stdout as ReadableStream<Uint8Array>,
    })) {
      if (!isGlobalEvent(evt)) {
        continue;
      }
      const { payload } = evt;

      if (payload.type === "session.idle") {
        const sid = payload.properties.sessionID;
        if (sid === args.sessionId) {
          sawIdle = true;
          break;
        }
      }

      if (payload.type === "session.error") {
        const sid = payload.properties.sessionID;
        if (!sid || sid === args.sessionId) {
          throw new Error("opencode_http_session_error");
        }
      }

      if (payload.type === "message.part.updated") {
        const props = payload.properties;
        const { part } = props;
        if (part.sessionID !== args.sessionId || part.messageID !== messageId) {
          continue;
        }
        const delta = props.delta ?? "";

        if (part.type === "text") {
          if (delta) {
            out += delta;
            emitText(args.writer, delta);
          }
        } else if (part.type === "reasoning") {
          if (delta) {
            emitThought(args.writer, delta);
          }
        } else if (part.type === "tool") {
          const title =
            part.state.status === "completed"
              ? part.state.title
              : part.state.status === "running"
                ? part.state.title
                : undefined;
          const tool = title ?? part.tool;
          const st = part.state.status;
          const mapped =
            st === "completed"
              ? "completed"
              : st === "error"
                ? "failed"
                : "running";
          emitCommand(args.writer, tool, mapped);
          if (st === "error") {
            void Promise.resolve(
              args.writer?.write?.({
                message: part.state.error,
                type: "stderr",
              })
            ).catch(() => {});
          }
        }
      }

      if (payload.type === "permission.updated") {
        const p = payload.properties;
        if (p.sessionID !== args.sessionId || p.messageID !== messageId) {
          continue;
        }
        const allow = auto === "medium" || auto === "high";
        emitCommand(args.writer, p.title || "permission", "running");
        await args.handle.client.postSessionIdPermissionsPermissionId({
          body: { response: allow ? "always" : "reject" },
          path: { id: args.sessionId, permissionID: p.id },
        });
      }

      if (payload.type === "todo.updated") {
        const sid = payload.properties.sessionID;
        if (sid !== args.sessionId) {
          continue;
        }
        void Promise.resolve(
          args.writer?.write?.({
            entries: payload.properties.todos,
            message: "opencode_plan",
            type: "notice",
          })
        ).catch(() => {});
      }

      if (payload.type === "file.edited") {
        const { file } = payload.properties;
        if (
          typeof file === "string" &&
          file.trim().length > 0 &&
          !artifactSet.has(file)
        ) {
          artifactSet.add(file);
          artifacts.push({ kind: "file", path: file });
          emitArtifact(args.writer, file, "file");
        }
      }

      if (payload.type === "session.diff") {
        const sid = payload.properties.sessionID;
        if (sid !== args.sessionId) {
          continue;
        }
        for (const d of payload.properties.diff) {
          const { file } = d;
          if (
            typeof file === "string" &&
            file.trim().length > 0 &&
            !artifactSet.has(file)
          ) {
            artifactSet.add(file);
            artifacts.push({ kind: "file", path: file });
            emitArtifact(args.writer, file, "file");
          }
        }
      }
    }

    return sawIdle;
  })();

  try {
    await args.handle.client.session.promptAsync({
      body: {
        messageID: messageId,
        ...(model ? { model } : {}),
        parts: [{ type: "text", text: args.input.prompt }],
      },
      path: { id: args.sessionId },
    });

    await Promise.race([sseTask, abortPromise(args.signal)]);

    // Best-effort fetch the final message for canonical result text.
    try {
      const msg = await args.handle.client.session.message({
        path: { id: args.sessionId, messageID: messageId },
        throwOnError: true,
      });

      const final = (msg.data as SessionMessageResponse).parts
        .filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
        .map((p) => p.text)
        .join("");
      if (final) {
        out = final;
      }
    } catch {
      // ignore
    }

    return {
      artifacts: artifacts.length > 0 ? artifacts : undefined,
      result: out,
      stopReason: undefined,
    };
  } catch (error) {
    if (args.signal.aborted) {
      try {
        await args.handle.client.session.abort({
          path: { id: args.sessionId },
        });
      } catch {
        // ignore
      }
    }
    throw error;
  } finally {
    args.signal.removeEventListener("abort", abortHandler);
    try {
      sseAbort.abort();
    } catch {
      // ignore
    }
    try {
      sseProc.kill();
    } catch {
      // ignore
    }
  }
}

export async function executeWithOpenCodeHttp({
  input,
  writer,
  signal,
}: ToolExecuteContext<OpenCodeToolInput>): Promise<OpenCodeToolOutput> {
  const profile = resolveExecProfile(input.execProfile, input.containerName);
  const { timeoutSec } = input;

  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);

  let timeout: ReturnType<typeof setTimeout> | undefined;
  if (typeof timeoutSec === "number" && Number.isFinite(timeoutSec)) {
    timeout = setTimeout(() => ctrl.abort(), Math.max(1, timeoutSec) * 1000);
  }

  try {
    const handle =
      profile === "server"
        ? await ensureOpenCodeHttpServer({ input, profile })
        : await startOpenCodeHttpServer({ input, profile });

    const sessionId = await ensureSession({
      handle,
      sessionKey: input.sessionId,
    });

    const out = await runPrompt({
      handle,
      input,
      sessionId,
      signal: ctrl.signal,
      writer,
    });

    if (profile === "default") {
      try {
        await handle.stop("default_profile_complete");
      } catch {
        // ignore
      }
    }

    return out;
  } catch (error) {
    if (profile === "server") {
      logger.warn("opencode_http_exec_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export const __internals = {
  resetIdFactory: () => {
    makeId = () => crypto.randomUUID();
  },
  resetSpawn: () => {
    spawnProc = spawn;
  },
  setIdFactory: (fn: () => string) => {
    makeId = fn;
  },
  setSpawn: (fn: SpawnProc) => {
    spawnProc = fn;
  },
};
