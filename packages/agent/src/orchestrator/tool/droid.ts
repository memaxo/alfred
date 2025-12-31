import path from "node:path";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { z } from "zod";
import type { DirectoryHandle } from "../../security/filesystem.js";
import {
  DirectoryAccessError,
  openDirectorySecure,
} from "../../security/filesystem.js";
import { spawnWithSecureCwd } from "../../security/secure-spawn.js";
import {
  appendOutput,
  appendReasoningTrace,
  createOutputAccumulator,
  createTimeout,
  DEFAULT_ALLOW_PREFIXES,
  DEFAULT_TIMEOUT_SEC,
  getAccumulatedOutput,
  isWithinBase,
  MAX_TIMEOUT_SEC,
  MIN_TIMEOUT_SEC,
  recordToolExecution,
  resolveExecutable,
  startToolTimer,
  streamStderr,
  type ToolExecuteContext,
  type ToolWriter,
} from "./shared/index.js";

// Regex for splitting lines - declared at module level for performance
const LINE_SPLIT_REGEX = /\r?\n/;

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
});

export type DroidExecuteArgs = ToolExecuteContext<DroidToolInput>;

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

/**
 * Acquire a secure directory handle for the working directory.
 * Uses file descriptor pinning to prevent TOCTOU attacks via symlink swaps.
 */
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
  accumulator: string[]
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

        const text = decoder.decode(value);
        appendOutput(accumulator, text);

        if (input.out === "debug") {
          const lines = text.split(LINE_SPLIT_REGEX).filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
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

function extractDroidReasoning(chunk: unknown): string | null {
  if (!chunk || typeof chunk !== "object") {
    return null;
  }

  const chunkObj = chunk as Record<string, unknown>;
  if (
    chunkObj.type === "message" &&
    chunkObj.role === "assistant" &&
    typeof chunkObj.text === "string"
  ) {
    const text = chunkObj.text;
    const markers = ["I'll analyze", "Let me", "Analyzing"];
    if (markers.some((m) => text.includes(m))) {
      return text;
    }
  }

  if (
    chunkObj.type === "completion" &&
    typeof chunkObj.finalText === "string"
  ) {
    return chunkObj.finalText;
  }

  return null;
}

export const toolDroid = {
  name: "droid",
  description:
    "Run the ALFRED droid exec CLI in a sandboxed, non-interactive mode.",
  inputSchema: droidInputSchema,
  outputSchema: toolOutputSchema,
  execute: async ({ input, writer }: DroidExecuteArgs) => {
    await enforcePolicy(input);

    // Acquire secure directory handle to prevent TOCTOU symlink attacks
    const cwdHandle = acquireWorkingDirectoryHandle(input.cw);
    const flags = buildFlags(input);
    const command = process.env.DROID_BIN?.trim() || "droid";
    const executable = resolveExecutable(command, "droid");

    const proc = spawnWithSecureCwd({
      cwdHandle,
      cmd: executable,
      args: flags,
      env: pickEnv(input.env),
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    const stopDurationTimer = startToolTimer("droid", input.auto);
    const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
    const timeoutCtx = createTimeout(
      proc,
      timeoutSec,
      writer,
      "droid_exec_timeout"
    );

    const accumulator = createOutputAccumulator();

    streamStdout(proc, input, writer, accumulator);
    streamStderr(proc, writer);

    let exitCode = 0;
    try {
      exitCode = await proc.exited;
    } catch (error) {
      cwdHandle.close();
      timeoutCtx.clear();
      stopDurationTimer();
      throw error;
    } finally {
      cwdHandle.close();
      timeoutCtx.clear();
      stopDurationTimer();
    }

    recordToolExecution("droid", input.auto, exitCode);

    if (timeoutCtx.didTimeout) {
      throw new Error("droid_exec_timeout");
    }

    if (exitCode !== 0) {
      throw new Error(`droid_exec_failed:${exitCode}`);
    }

    if (accumulator.truncated) {
      void Promise.resolve(
        writer?.write?.({ type: "notice", message: "output_truncated" })
      ).catch(() => {});
    }

    return {
      result: getAccumulatedOutput(accumulator),
      artifacts: [],
    };
  },
};

export type ToolDroid = typeof toolDroid;

export const __internals = {
  DEFAULT_ALLOW_PREFIXES,
  isWithinBase,
  pickEnv,
  resolveExecutable: (cmd: string) => resolveExecutable(cmd, "droid"),
  assertAllowedDirectory: (candidate: string) =>
    acquireWorkingDirectoryHandle(candidate).path,
  appendReasoningTrace,
  extractDroidReasoning,
};
