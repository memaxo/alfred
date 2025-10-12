import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { spawn } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { constants as fsConstants } from "node:fs";
import { accessSync } from "node:fs";
import path from "node:path";
import { setTimeout as setNodeTimeout, clearTimeout as clearNodeTimeout } from "node:timers";
import { z } from "zod";
import { recordDroidExecRun, startDroidExecTimer } from "../../metrics";

const OUTPUT_CAP_BYTES = 5 * 1024 * 1024; // 5 MiB
const DEFAULT_TIMEOUT_SEC = 30 * 60;
const MIN_TIMEOUT_SEC = 30;
const MAX_TIMEOUT_SEC = 2 * 60 * 60;

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
      // Ignore invalid entries so that a bad env var does not break execution.
    }
  }

  return Array.from(prefixes);
})();

function safeRealpath(p: string) {
  try {
    return realpathSync(p);
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
    throw new Error("droid_invalid_cwd");
  }
  for (const prefix of DEFAULT_ALLOW_PREFIXES) {
    if (isWithinBase(prefix, real)) {
      const stats = statSync(real);
      if (!stats.isDirectory()) {
        throw new Error("droid_invalid_cwd_not_directory");
      }
      return real;
    }
  }
  throw new Error("droid_invalid_cwd");
}

const droidInputSchema = z.object({
  prompt: z.string().min(1),
  out: z.enum(["text", "json", "debug"]).default("text"),
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  cw: z.string().optional(),
  model: z.string().optional(),
  authz: z.string().optional(),
  timeoutSec: z.number().int().min(MIN_TIMEOUT_SEC).max(MAX_TIMEOUT_SEC).optional(),
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
      }),
    )
    .optional(),
});

type ToolWriter = { write: (chunk: unknown) => Promise<void> | void } | undefined;

export interface DroidExecuteArgs {
  input: DroidToolInput;
  writer?: ToolWriter;
}

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
    if (!key || typeof value !== "string") continue;
    if (key === "PATH") continue;
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

  throw new Error("droid_binary_not_found");
}

async function enforcePolicy(input: DroidToolInput) {
  const { claims } = await requireToolScopesAndPolicy(input.authz, ["droid.exec"], {
    action: "droid.exec",
    resource: {
      kind: "repo",
      id: input.cw ? path.resolve(input.cw) : undefined,
    },
    context: {
      auto: input.auto,
    },
  });

  if (
    (input.auto === "medium" || input.auto === "high") &&
    (!claims.elevated || claims.mfa !== "passkey")
  ) {
    throw new Error("biometric_required");
  }
}

function streamStdout(
  child: ReturnType<typeof spawn>,
  input: DroidToolInput,
  writer: ToolWriter,
  accumulator: { stdout: string; capturedBytes: number; truncated: boolean },
) {
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

    if (input.out === "debug") {
      const lines = text.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          void Promise.resolve(writer?.write?.({ type: "droid", chunk: parsed })).catch(() => {});
        } catch {
          void Promise.resolve(writer?.write?.({ type: "stdout", text: line })).catch(() => {});
        }
      }
    } else {
      void Promise.resolve(writer?.write?.({ type: "stdout", text })).catch(() => {});
    }
  });
}

function streamStderr(child: ReturnType<typeof spawn>, writer: ToolWriter) {
  child.stderr?.on("data", chunk => {
    void Promise.resolve(writer?.write?.({ type: "stderr", text: chunk.toString() })).catch(() => {});
  });
}

export const toolDroid = {
  name: "droid",
  description: "Run the ALFRED droid exec CLI in a sandboxed, non-interactive mode.",
  inputSchema: droidInputSchema,
  outputSchema: toolOutputSchema,
  execute: async ({ input, writer }: DroidExecuteArgs) => {
    await enforcePolicy(input);

    const cwd = input.cw ? assertAllowedDirectory(input.cw) : process.cwd();
    const flags = buildFlags(input);
    const command = process.env.DROID_BIN?.trim() || "droid";
    const executable = resolveExecutable(command);

    const child = spawn(executable, flags, {
      cwd,
      env: pickEnv(input.env),
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stopDurationTimer = startDroidExecTimer(input.auto);

    const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
    const timer = setNodeTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // noop
      }
      void Promise.resolve(
        writer?.write?.({
          type: "notice",
          message: "droid_exec_timeout",
        }),
      ).catch(() => {});
    }, timeoutSec * 1000);

    const accumulator = {
      stdout: "",
      capturedBytes: 0,
      truncated: false,
    };

    streamStdout(child, input, writer, accumulator);
    streamStderr(child, writer);

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on("error", err => {
        clearNodeTimeout(timer);
        reject(err);
      });
      child.on("close", code => resolve(code ?? 0));
    }).finally(() => {
      clearNodeTimeout(timer);
      stopDurationTimer();
    });

    recordDroidExecRun(input.auto, exitCode);

    if (exitCode !== 0) {
      throw new Error(`droid_exec_failed:${exitCode}`);
    }

    if (accumulator.truncated) {
      void Promise.resolve(writer?.write?.({ type: "notice", message: "output_truncated" })).catch(
        () => {},
      );
    }

    return {
      result: accumulator.stdout.trim(),
      artifacts: [],
    };
  },
};

export type ToolDroid = typeof toolDroid;

export const __internals = {
  DEFAULT_ALLOW_PREFIXES,
  isWithinBase,
  pickEnv,
  resolveExecutable,
};
