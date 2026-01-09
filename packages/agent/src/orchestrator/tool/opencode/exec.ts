import { spawn } from "bun";
import {
  type Client,
  ClientSideConnection,
  PROTOCOL_VERSION,
  ndJsonStream,
} from "@alfred/protocol/acp";
import { mapAutonomyToAcpMode } from "@alfred/protocol/acp";
import { logger } from "@alfred/logger";
import type { ToolExecuteContext } from "../shared/context.js";
import type { OpenCodeToolInput, OpenCodeToolOutput } from "./definition.js";

type AgentCmd = { cmd: string; args: string[] };

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

function emitText(
  writer: ToolExecuteContext<OpenCodeToolInput>["writer"],
  text: string
) {
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
  writer: ToolExecuteContext<OpenCodeToolInput>["writer"],
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

function createClient(args: {
  writer: ToolExecuteContext<OpenCodeToolInput>["writer"];
  auto: OpenCodeToolInput["auto"];
  append: (text: string) => void;
}): Client {
  return {
    async requestPermission(params) {
      const options = Array.isArray(params.options) ? params.options : [];
      const preferredKinds =
        args.auto === "read" || args.auto === "low"
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

      emitCommand(args.writer, params.toolCall.title, "running");
      return {
        outcome: {
          outcome: "selected",
          optionId: pick(),
        },
      };
    },

    async sessionUpdate(params) {
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
          args.append(content.text);
          emitText(args.writer, content.text);
        }
        return;
      }

      if (kind === "tool_call") {
        const title = (update as { title?: unknown }).title;
        const status = (update as { status?: unknown }).status;
        const titleStr = typeof title === "string" ? title : "tool_call";
        const statusStr = status === "failed" ? "failed" : "running";
        emitCommand(args.writer, titleStr, statusStr);
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
        emitCommand(args.writer, titleStr, mapped);
      }
    },

    async readTextFile() {
      return { content: "" };
    },
    async writeTextFile() {
      return {};
    },
  };
}

export async function executeWithOpenCode({
  input,
  writer,
  signal,
}: ToolExecuteContext<OpenCodeToolInput>): Promise<OpenCodeToolOutput> {
  const timeoutMs = (input.timeoutSec ?? 20 * 60) * 1000;
  const cmd = resolveAgentCmd(input);

  const args = (() => {
    if (input.containerName) {
      const out: string[] = ["exec", "-i"];
      if (input.containerCw) {
        out.push("-w", input.containerCw);
      }
      out.push(input.containerName, cmd.cmd, ...cmd.args);
      return ["docker", out] as const;
    }
    return [cmd.cmd, cmd.args] as const;
  })();

  const proc =
    args[0] === "docker"
      ? spawn([args[0], ...(args[1] as string[])], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
          env: process.env,
        })
      : spawn([args[0], ...(args[1] as string[])], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
          cwd: input.cw ? pathResolveSafe(input.cw) : undefined,
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

  const stream = ndJsonStream(proc.stdin, proc.stdout);
  let text = "";
  const append = (delta: string) => {
    text += delta;
  };

  const clientFactory = () =>
    createClient({
      writer,
      auto: input.auto,
      append,
    });

  const connection = new ClientSideConnection(clientFactory, stream);

  const timer = setTimeout(() => {
    proc.kill();
  }, timeoutMs);

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
        void Promise.resolve(writer?.write?.({ type: "stderr", text: chunk })).catch(
          () => {}
        );
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
          cwd: input.cw ?? process.cwd(),
          mcpServers: [],
          ...(input.sessionId ? { sessionId: input.sessionId } : {}),
          ...(input.model ? { model: input.model } : {}),
          mode: mapAutonomyToAcpMode(input.auto),
        } as any);

        const promptResult = await connection.prompt({
          sessionId: session.sessionId,
          prompt: [{ type: "text", text: input.prompt }],
        });

        return promptResult;
      })(),
      abortPromise(signal),
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

function pathResolveSafe(cw: string): string {
  try {
    return cw.trim().length > 0 ? cw : process.cwd();
  } catch {
    return process.cwd();
  }
}

