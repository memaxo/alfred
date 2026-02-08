import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { logger } from "@alfred/logger";
import path from "node:path";
import { z } from "zod";

import { persistArtifact } from "../../artifact/persist.js";
import {
  appendOutput,
  appendReasoningTrace,
  createOutputAccumulator,
  createTimeout,
  DEFAULT_TIMEOUT_SEC,
  getAccumulatedOutput,
  isWithinBase,
  MAX_TIMEOUT_SEC,
  MIN_TIMEOUT_SEC,
  type OutputAccumulator,
  recordToolExecution,
  resolveExecutable,
  startToolTimer,
  streamStderr,
  type ToolExecuteContext,
  type ToolWriter,
} from "./shared/index.js";

// Regex for splitting lines - declared at module level for performance
const LINE_SPLIT_REGEX = /\r?\n/;
const DEFAULT_CONTAINER_CW = "/workspace";

function normalizeContainerCw(raw: string | undefined): string {
  const v = raw?.trim() || DEFAULT_CONTAINER_CW;
  const normalized = v.startsWith("/") ? v : `/${v}`;
  if (
    !normalized.startsWith("/workspace") ||
    (normalized !== "/workspace" && !normalized.startsWith("/workspace/"))
  ) {
    throw new Error("droid_container_cwd_invalid");
  }
  return normalized;
}

export const droidInputSchema = z.object({
  prompt: z.string().min(1),
  out: z.enum(["text", "json", "debug"]).default("text"),
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  cw: z.string().optional(),
  model: z.string().optional(),
  authz: z.string().optional(),
  command: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Optional droid binary/command override."),
  args: z
    .array(z.string().min(1))
    .optional()
    .describe("Optional args for droid execution."),
  timeoutSec: z
    .number()
    .int()
    .min(MIN_TIMEOUT_SEC)
    .max(MAX_TIMEOUT_SEC)
    .optional(),
  env: z.record(z.string(), z.string()).optional(),
  /** Docker container name to run droid inside (AgentFSWorkspace container) */
  containerName: z
    .string()
    .min(1)
    .max(255)
    .describe("AgentFS container name/id to run inside via docker exec."),
  /** Workdir inside the container (must be under /workspace) */
  containerCw: z
    .string()
    .min(1)
    .max(1024)
    .describe("Working directory inside the container (posix path)."),
  /** Ralph Wiggum loop configuration for iterative execution */
  ralph: z
    .object({
      /** Maximum iterations before forced termination */
      maxIterations: z.number().int().min(1).max(50).default(10),
      /** Text to detect in <promise>TEXT</promise> tag for completion */
      completionPromise: z.string().min(1).optional(),
      /** Current iteration number (managed internally) */
      iteration: z.number().int().min(0).optional(),
    })
    .optional(),
});

export type DroidToolInput = z.infer<typeof droidInputSchema>;

const toolOutputSchema = z.object({
  result: z.string(),
  artifacts: z
    .array(
      z.object({
        kind: z.string(),
        path: z.string(),
      })
    )
    .optional(),
  /** Ralph loop iteration state (present when ralph config was used) */
  iterationState: z
    .object({
      /** Current iteration number */
      iteration: z.number().int().min(0),
      /** Whether task completed via promise detection */
      completed: z.boolean(),
      /** The promise text detected if completion occurred */
      promiseDetected: z.string().optional(),
    })
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

  if (input.args) {
    for (const arg of input.args) {
      flags.push(arg);
    }
  }

  flags.push(input.prompt);

  return flags;
}

function pickEnv(custom: Record<string, string> | undefined) {
  const safeEnv: Record<string, string> = {
    FACTORY_API_KEY: process.env.FACTORY_API_KEY ?? "",
    PATH: process.env.PATH ?? "",
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
    if (key === "HOME") {
      safeEnv.HOME = value;
      continue;
    }
    if (key.startsWith("DROID_")) {
      safeEnv[key] = value;
    }
  }

  return safeEnv;
}

async function enforcePolicy(input: DroidToolInput) {
  const { claims } = await requireToolScopesAndPolicy(
    input.authz,
    ["droid.exec"],
    {
      action: "droid.exec",
      context: {
        auto: input.auto,
      },
      resource: {
        kind: "repo",
        id: input.cw ? path.resolve(input.cw) : undefined,
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
  accumulator: OutputAccumulator
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
                writer?.write?.({ chunk: parsed, type: "droid" })
              ).catch(() => {});
            } catch {
              void Promise.resolve(
                writer?.write?.({ text: line, type: "stdout" })
              ).catch(() => {});
            }
          }
        } else {
          void Promise.resolve(writer?.write?.({ text, type: "stdout" })).catch(
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
    const { text } = chunkObj;
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
  description:
    "Run the ALFRED droid exec CLI in a sandboxed, non-interactive mode.",
  execute: async ({ input, writer }: DroidExecuteArgs) => {
    await enforcePolicy(input);

    const containerCw = normalizeContainerCw(input.containerCw);
    const flags = buildFlags(input);
    const command =
      input.command?.trim() || process.env.DROID_BIN?.trim() || "droid";
    const dockerBin = resolveExecutable("docker", "droid");
    const env = pickEnv(input.env);
    const envKeys = Object.keys(env).filter((key) => key !== "PATH");
    const dockerArgs = [
      "exec",
      "-i",
      "--workdir",
      containerCw,
      ...envKeys.flatMap((k) => ["-e", k]),
      input.containerName,
      command,
      ...flags,
    ];

    const proc = Bun.spawn([dockerBin, ...dockerArgs], {
      env,
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
      timeoutCtx.clear();
      stopDurationTimer();
      throw error;
    } finally {
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

    const resultText = getAccumulatedOutput(accumulator);
    void persistArtifact({
      repoRoot: input.cw?.trim().length ? input.cw : ".",
      category: "droid",
      tool: "droid",
      format: "txt",
      content: resultText,
    }).catch((error) =>
      logger.debug("droid_persist_artifact_error", { error })
    );

    return {
      result: resultText,
      artifacts: [],
    };
  },
  inputSchema: droidInputSchema,
  name: "droid",
  outputSchema: toolOutputSchema,
};

export type ToolDroid = typeof toolDroid;

export const __internals = {
  appendReasoningTrace,
  assertAllowedDirectory: (candidate: string) =>
    normalizeContainerCw(candidate),
  extractDroidReasoning,
  isWithinBase,
  pickEnv,
  resolveExecutable: (cmd: string) => resolveExecutable(cmd, "droid"),
};
