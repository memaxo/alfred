import { Buffer } from "node:buffer";
import { accessSync, constants as fsConstants } from "node:fs";
import path from "node:path";
import {
  clearTimeout as clearNodeTimeout,
  setTimeout as setNodeTimeout,
} from "node:timers";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { z } from "zod";
import { persistReasoning } from "../../../assistant/src/graphstore.js";
import { recordDroidExecRun, startDroidExecTimer } from "../../metrics";
import type { DirectoryHandle } from "../../security/filesystem.js";
import {
  DEFAULT_ALLOW_PREFIXES,
  DirectoryAccessError,
  isWithinBase,
  openDirectorySecure,
} from "../../security/filesystem.js";
import { spawnWithSecureCwd } from "../../security/secure-spawn.js";
import { truncateToBytes } from "../tool/codex/truncate.js";

const OUTPUT_CAP_BYTES = 5 * 1024 * 1024; // 5 MiB
const DEFAULT_TIMEOUT_SEC = 30 * 60;
const MIN_TIMEOUT_SEC = 30;
const MAX_TIMEOUT_SEC = 2 * 60 * 60;

type ReasoningAccumulator = {
  traces: Array<{ text: string; timestamp: number }>;
  storedBytes: number;
  truncated: boolean;
};

function appendReasoningTrace(
  acc: ReasoningAccumulator,
  text: string,
  timestamp: number = Date.now()
) {
  const reasoningText = text?.trim();
  if (!reasoningText) {
    return;
  }

  const byteLength = Buffer.byteLength(reasoningText);
  if (acc.truncated) {
    acc.storedBytes += byteLength;
    return;
  }

  const remaining = OUTPUT_CAP_BYTES - acc.storedBytes;
  if (remaining <= 0) {
    acc.truncated = true;
    return;
  }

  const storedText =
    byteLength <= remaining
      ? reasoningText
      : truncateToBytes(reasoningText, remaining);
  const storedBytes =
    byteLength <= remaining ? byteLength : Buffer.byteLength(storedText);

  if (storedText) {
    acc.traces.push({
      text: storedText,
      timestamp,
    });
  }

  if (storedBytes > 0) {
    acc.storedBytes += storedBytes;
  }

  if (byteLength > remaining) {
    acc.truncated = true;
  }
}

function extractDroidReasoning(chunk: unknown): string | null {
  if (!chunk || typeof chunk !== "object") {
    return null;
  }

  const event = chunk as {
    type?: unknown;
    role?: unknown;
    text?: unknown;
    finalText?: unknown;
  };

  // Check for message type with assistant role
  if (event.type === "message" && event.role === "assistant") {
    const text = event.text;
    if (typeof text === "string" && text.trim()) {
      // Heuristic: detect reasoning patterns in assistant messages
      const normalized = text.toLowerCase();
      const reasoningMarkers = [
        "i'll",
        "let me",
        "first,",
        "planning to",
        "i need to",
        "i should",
        "analyzing",
        "checking",
        "considering",
        "thinking",
      ];

      // Extract reasoning if message contains planning/analysis language
      // or appears before tool calls (indicates planning)
      const hasReasoningMarker = reasoningMarkers.some((marker) =>
        normalized.includes(marker)
      );

      if (hasReasoningMarker) {
        return text.trim();
      }
    }
  }

  // Check for completion event finalText (summary reasoning)
  if (event.type === "completion" && typeof event.finalText === "string") {
    const finalText = event.finalText.trim();
    if (finalText.length > 0) {
      // Include completion summary as reasoning trace
      return finalText;
    }
  }

  return null;
}

function assertAllowedDirectory(candidate: string) {
  let handle;
  try {
    handle = openDirectorySecure(candidate, {
      allowedPrefixes: DEFAULT_ALLOW_PREFIXES,
    });
    return handle.path;
  } catch (error) {
    if (
      error instanceof DirectoryAccessError &&
      error.code === "not_directory"
    ) {
      throw new Error("droid_invalid_cwd_not_directory");
    }
    throw new Error("droid_invalid_cwd");
  } finally {
    handle?.close();
  }
}

function acquireWorkingDirectoryHandle(candidate?: string): DirectoryHandle {
  try {
    return openDirectorySecure(candidate ?? process.cwd(), {
      allowedPrefixes: DEFAULT_ALLOW_PREFIXES,
    });
  } catch (error) {
    if (
      error instanceof DirectoryAccessError &&
      error.code === "not_directory"
    ) {
      throw new Error("droid_invalid_cwd_not_directory");
    }
    throw new Error("droid_invalid_cwd");
  }
}

const droidInputSchema = z.object({
  prompt: z.string().min(1),
  out: z.enum(["text", "json", "debug"]).default("text"),
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  cw: z.string().optional(),
  model: z.string().optional(),
  authz: z.string().optional(),
  timeoutSec: z
    .number()
    .int()
    .min(MIN_TIMEOUT_SEC)
    .max(MAX_TIMEOUT_SEC)
    .optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export type DroidToolInput = z.infer<typeof droidInputSchema>;

const toolOutputSchema = z.object({
  result: z.string(),
  artifacts: z
    .array(
      z.object({
        path: z.string(),
        kind: z.string(),
      })
    )
    .optional(),
  reasoning: z
    .array(
      z.object({
        text: z.string(),
        timestamp: z.number(),
      })
    )
    .optional(),
});

type ToolWriter =
  | { write: (chunk: unknown) => Promise<void> | void }
  | undefined;

export type DroidExecuteArgs = {
  input: DroidToolInput;
  writer?: ToolWriter;
};

function buildFlags(input: DroidToolInput) {
  const flags = ["exec", "-o", input.out];

  if (input.model) {
    flags.push("-m", input.model);
  }

  if (input.auto !== "read") {
    flags.push("--auto", input.auto);
  }

  flags.push(input.prompt);

  return flags;
}

function pickEnv(custom: Record<string, string> | undefined) {
  const safeEnv: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    FACTORY_API_KEY: process.env.FACTORY_API_KEY ?? "",
  };

  if (!custom) {
    return safeEnv;
  }

  for (const [key, value] of Object.entries(custom)) {
    if (!key || typeof value !== "string") {
      continue;
    }
    if (key === "PATH") {
      continue;
    }
    if (key.startsWith("DROID_")) {
      safeEnv[key] = value;
    }
  }

  return safeEnv;
}

function resolveExecutable(command: string) {
  if (path.isAbsolute(command)) {
    accessSync(command, fsConstants.X_OK);
    return command;
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, command);
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // continue
    }
  }

  throw new Error("droid_binary_not_found");
}

async function enforcePolicy(input: DroidToolInput) {
  const { claims } = await requireToolScopesAndPolicy(
    input.authz,
    ["droid.exec"],
    {
      action: "droid.exec",
      resource: {
        kind: "repo",
        id: input.cw ? path.resolve(input.cw) : undefined,
      },
      context: {
        auto: input.auto,
      },
    }
  );

  if (
    (input.auto === "medium" || input.auto === "high") &&
    (!claims.elevated || claims.mfa !== "passkey")
  ) {
    throw new Error("biometric_required");
  }
}

function streamStdout(
  proc: ReturnType<typeof Bun.spawn>,
  input: DroidToolInput,
  writer: ToolWriter,
  accumulator: { stdout: string; capturedBytes: number; truncated: boolean },
  onActivity: () => void,
  reasoningAccumulator: ReasoningAccumulator
) {
  if (!proc.stdout || typeof proc.stdout === "number") {
    return;
  }

  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        onActivity(); // Signal activity

        const text = decoder.decode(value);
        accumulator.capturedBytes += Buffer.byteLength(text);

        if (!accumulator.truncated) {
          if (accumulator.capturedBytes <= OUTPUT_CAP_BYTES) {
            accumulator.stdout += text;
          } else {
            accumulator.truncated = true;
          }
        }

        if (input.out === "debug") {
          const lines = text.split(/\r?\n/).filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              
              // Extract reasoning from message chunks
              const reasoningText = extractDroidReasoning(parsed);
              if (reasoningText) {
                const timestamp = Date.now();
                appendReasoningTrace(reasoningAccumulator, reasoningText, timestamp);
                
                // Emit thought event for streaming
                void Promise.resolve(
                  writer?.write?.({
                    type: "thought",
                    content: reasoningText,
                    timestamp,
                  })
                ).catch(() => {});
              }
              
              void Promise.resolve(
                writer?.write?.({ type: "droid", chunk: parsed })
              ).catch(() => {});
            } catch {
              void Promise.resolve(
                writer?.write?.({ type: "stdout", text: line })
              ).catch(() => {});
            }
          }
        } else {
          void Promise.resolve(writer?.write?.({ type: "stdout", text })).catch(
            () => {}
          );
        }
      }
    } catch {
      // Ignore stream read errors
    }
  })();
}

function streamStderr(proc: ReturnType<typeof Bun.spawn>, writer: ToolWriter) {
  if (!proc.stderr || typeof proc.stderr === "number") {
    return;
  }

  const reader = proc.stderr.getReader();
  const decoder = new TextDecoder();

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        void Promise.resolve(
          writer?.write?.({ type: "stderr", text: decoder.decode(value) })
        ).catch(() => {});
      }
    } catch {
      // Ignore stderr read errors
    }
  })();
}

export const toolDroid = {
  name: "droid",
  description:
    "Run the ALFRED droid exec CLI in a sandboxed, non-interactive mode.",
  inputSchema: droidInputSchema,
  outputSchema: toolOutputSchema,
  execute: async ({ input, writer }: DroidExecuteArgs) => {
    await enforcePolicy(input);

    const cwdHandle = acquireWorkingDirectoryHandle(input.cw);
    try {
      const flags = buildFlags(input);
      const command = process.env.DROID_BIN?.trim() || "droid";
      const executable = resolveExecutable(command);

      const proc = spawnWithSecureCwd({
        cwdHandle,
        cmd: executable,
        args: flags,
        env: pickEnv(input.env),
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      });

      const stopDurationTimer = startDroidExecTimer(input.auto);

      // Heartbeat State
      let lastActivity = Date.now();
      const HEARTBEAT_TIMEOUT_MS = 60_000;
      let heartbeatKilled = false;

      const onActivity = () => {
        lastActivity = Date.now();
      };

      const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;

      // Combined Timer Loop (Timeout + Heartbeat)
      const timer = setInterval(() => {
        const now = Date.now();

        // Check Hard Timeout
        // Note: We use a separate setNodeTimeout for the hard limit usually, but we can do it here or keep the original.
        // The original used setNodeTimeout. Let's keep the original structure for hard timeout if possible,
        // but implementing a periodic check is cleaner for heartbeat.

        // Check Heartbeat
        if (now - lastActivity > HEARTBEAT_TIMEOUT_MS) {
          heartbeatKilled = true;
          try {
            proc.kill("SIGKILL");
          } catch {
            // noop
          }
        }
      }, 1000);

      // Original Hard Timeout
      const hardTimeoutTimer = setNodeTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
          // noop
        }
        void Promise.resolve(
          writer?.write?.({
            type: "notice",
            message: "droid_exec_timeout",
          })
        ).catch(() => {});
      }, timeoutSec * 1000);

      const accumulator = {
        stdout: "",
        capturedBytes: 0,
        truncated: false,
      };

      const reasoningAccumulator: ReasoningAccumulator = {
        traces: [],
        storedBytes: 0,
        truncated: false,
      };

      streamStdout(proc, input, writer, accumulator, onActivity, reasoningAccumulator);
      streamStderr(proc, writer);

      let exitCode = 0;
      try {
        exitCode = await proc.exited;
      } catch (error) {
        clearNodeTimeout(hardTimeoutTimer);
        clearInterval(timer);
        stopDurationTimer();
        throw error;
      } finally {
        clearNodeTimeout(hardTimeoutTimer);
        clearInterval(timer);
        stopDurationTimer();
      }

      if (heartbeatKilled) {
        throw new Error("droid_exec_heartbeat_timeout");
      }

      recordDroidExecRun(input.auto, exitCode);

      if (exitCode !== 0) {
        throw new Error(`droid_exec_failed:${exitCode}`);
      }

      if (accumulator.truncated) {
        void Promise.resolve(
          writer?.write?.({ type: "notice", message: "output_truncated" })
        ).catch(() => {});
      }

      // Persist reasoning traces to knowledge graph
      const resource = input.cw ? path.resolve(input.cw) : process.cwd();
      const executionId = resource;
      if (reasoningAccumulator.traces.length > 0) {
        persistReasoning(resource, reasoningAccumulator.traces, {
          executionId,
          auto: input.auto,
        }).catch((_err) => {
          // Non-fatal: reasoning persistence failure shouldn't break execution
        });
      }

      return {
        result: accumulator.stdout.trim(),
        artifacts: [],
        reasoning:
          reasoningAccumulator.traces.length > 0
            ? reasoningAccumulator.traces
            : undefined,
      };
    } finally {
      cwdHandle.close();
    }
  },
};

export type ToolDroid = typeof toolDroid;

export const __internals = {
  DEFAULT_ALLOW_PREFIXES,
  assertAllowedDirectory,
  isWithinBase,
  pickEnv,
  resolveExecutable,
  appendReasoningTrace,
  extractDroidReasoning,
};
