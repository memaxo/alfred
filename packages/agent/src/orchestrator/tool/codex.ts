import path from "node:path";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { z } from "zod";
import {
  appendOutput,
  appendReasoningTrace,
  assertAllowedDirectory,
  createOutputAccumulator,
  createReasoningAccumulator,
  createStageRecorder,
  createTimeout,
  DEFAULT_ALLOW_PREFIXES,
  DEFAULT_TIMEOUT_SEC,
  extractReasoningText,
  isWithinBase,
  MAX_TIMEOUT_SEC,
  MIN_TIMEOUT_SEC,
  OUTPUT_CAP_BYTES,
  type OutputAccumulator,
  persistReasoning,
  type ReasoningAccumulator,
  recordToolExecution,
  resolveExecutable,
  startToolTimer,
  streamStderr,
  type ToolWriter,
} from "./shared";
import type { CodexExecuteArgs } from "./codex/definition.js";

const MCP_ENV_ALLOWLIST = new Set([
  "CONTEXT7_API_KEY",
  "CONTEXT7_BASE_URL",
  "GITHUB_PAT",
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "GITHUB_TOKEN",
  "GITHUB_HOST",
  "GITHUB_TOOLSETS",
  "GITHUB_DYNAMIC_TOOLSETS",
  "GITHUB_READ_ONLY",
  "PLAYWRIGHT_BROWSERS_PATH",
  "PLAYWRIGHT_SERVICE_ACCESS_TOKEN",
  "PLAYWRIGHT_WS_ENDPOINT",
  "PLAYWRIGHT_HEADLESS",
  "MCP_AUTH_TOKEN",
]);

const codexInputSchema = z.object({
  action: z.literal("exec"),
  prompt: z.string().min(1),
  out: z.enum(["text", "json", "debug"]).default("text"),
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  cw: z.string().optional(),
  model: z.string().optional(),
  profile: z.string().optional(),
  authz: z.string().optional(),
  timeoutSec: z
    .number()
    .int()
    .min(MIN_TIMEOUT_SEC)
    .max(MAX_TIMEOUT_SEC)
    .optional(),
  env: z.record(z.string(), z.string()).optional(),
  sessionId: z.string().min(1).max(255).optional(),
  userId: z.string().optional(),
  containerId: z.string().optional(),
  context: z
    .object({
      linearIssueId: z.string().optional(),
      linearSessionId: z.string().optional(),
      linearSpace: z.string().optional(),
      linearAuthz: z.string().optional(),
      relevantFiles: z.array(z.string()).optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

export type CodexToolInput = z.infer<typeof codexInputSchema>;

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

type SandboxConfig = {
  sandbox: "read-only" | "workspace-write";
  approval: "on-request";
};

const DEFAULT_SANDBOX: SandboxConfig = {
  sandbox: "read-only",
  approval: "on-request",
};
const WRITE_SANDBOX: SandboxConfig = {
  sandbox: "workspace-write",
  approval: "on-request",
};

function mapAutoToCodex(auto: CodexToolInput["auto"]): SandboxConfig {
  return auto === "read" ? DEFAULT_SANDBOX : WRITE_SANDBOX;
}

function pickEnvCodex(custom: Record<string, string> | undefined) {
  const allowOpenAI = (process.env.ORCH_CODEX_ALLOW_OPENAI_KEY ?? "1") !== "0";
  const safeEnv: Record<string, string> = {
    PATH: process.env.PATH ?? "",
  };

  if (process.env.CODEX_API_KEY) {
    safeEnv.CODEX_API_KEY = process.env.CODEX_API_KEY;
  }

  for (const name of MCP_ENV_ALLOWLIST) {
    const value = process.env[name];
    if (value) {
      safeEnv[name] = value;
    }
  }

  if (!safeEnv.CODEX_API_KEY && allowOpenAI && process.env.OPENAI_API_KEY) {
    safeEnv.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  }

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
    if (key.startsWith("CODEX_")) {
      safeEnv[key] = value;
      continue;
    }
    if (MCP_ENV_ALLOWLIST.has(key)) {
      safeEnv[key] = value;
      continue;
    }
    if (allowOpenAI && key === "OPENAI_API_KEY") {
      safeEnv.OPENAI_API_KEY = value;
    }
  }

  return safeEnv;
}

async function enforcePolicy(input: CodexToolInput) {
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

function normaliseEvent(
  payload: unknown
): { type?: string; [key: string]: unknown } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const maybeEvent = (payload as { event?: unknown }).event;
  if (maybeEvent && typeof maybeEvent === "object") {
    return maybeEvent as { type?: string };
  }
  return payload as { type?: string };
}

function extractAgentMessage(item: unknown): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const candidate = item as {
    text?: unknown;
    content?: unknown;
    output?: unknown;
  };

  if (typeof candidate.text === "string") {
    return candidate.text;
  }

  if (Array.isArray(candidate.content)) {
    const parts = candidate.content
      .flatMap((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        if (!entry || typeof entry !== "object") {
          return [];
        }
        const text = (entry as { text?: unknown }).text;
        return typeof text === "string" ? text : [];
      })
      .filter((part): part is string => typeof part === "string");
    if (parts.length > 0) {
      return parts.join("\n");
    }
  }

  if (candidate.output && typeof candidate.output === "object") {
    const maybeText = (candidate.output as { text?: unknown }).text;
    if (typeof maybeText === "string") {
      return maybeText;
    }
  }

  return null;
}

function extractAggregatedOutput(item: unknown): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const value = (item as { aggregated_output?: unknown }).aggregated_output;
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((part): part is string => typeof part === "string")
      .join("\n");
  }
  return null;
}

export const toolCodex = {
  name: "codex",
  description: "Run the OpenAI Codex CLI in sandboxed, non-interactive mode.",
  inputSchema: codexInputSchema,
  outputSchema: toolOutputSchema,
  execute: async ({ input, writer }: CodexExecuteArgs) => {
    await enforcePolicy(input);

    const resolvedCw = input.cw
      ? assertAllowedDirectory(input.cw, "codex")
      : process.cwd();
    const sandbox = mapAutoToCodex(input.auto);

    const command = process.env.CODEX_BIN?.trim() || "codex";
    let executable: string;
    const recordStage = createStageRecorder("codex");
    try {
      executable = resolveExecutable(command, "codex");
    } catch (error) {
      recordStage("spawn");
      throw error;
    }

    const flags: string[] = [
      "exec",
      "--json",
      "--sandbox",
      sandbox.sandbox,
      "--ask-for-approval",
      sandbox.approval,
      "--cd",
      resolvedCw,
    ];

    if (input.model) {
      flags.push("-m", input.model);
    }

    const profileFromEnv = process.env.CODEX_PROFILE?.trim();
    const profile =
      input.profile ??
      (profileFromEnv && profileFromEnv.length > 0
        ? profileFromEnv
        : undefined);
    if (profile) {
      flags.push("--profile", profile);
    }

    flags.push(input.prompt);

    const proc = Bun.spawn([executable, ...flags], {
      cwd: resolvedCw,
      env: pickEnvCodex(input.env),
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    const stopTimer = startToolTimer("codex", input.auto);
    const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
    const timeoutCtx = createTimeout(
      proc,
      timeoutSec,
      writer,
      "codex_exec_timeout"
    );

    const finalAccumulator: OutputAccumulator = createOutputAccumulator();
    const reasoningAccumulator: ReasoningAccumulator =
      createReasoningAccumulator();
    let parseFailure: Error | null = null;
    let runtimeFailure: Error | null = null;

    let stdoutBuffer = "";

    // Handle stdout stream (Bun uses ReadableStream)
    if (proc.stdout && typeof proc.stdout !== "number") {
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            stdoutBuffer += decoder.decode(value, { stream: true });

            let newlineIndex = stdoutBuffer.indexOf("\n");
            while (newlineIndex !== -1) {
              const line = stdoutBuffer.slice(0, newlineIndex).trim();
              stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
              if (line.length > 0) {
                let parsed: unknown;
                try {
                  parsed = JSON.parse(line);
                } catch {
                  if (!parseFailure) {
                    parseFailure = new Error("codex_parse_failed");
                    recordStage("parse");
                  }
                  void Promise.resolve(
                    writer?.write?.({ type: "stderr", text: line })
                  ).catch(() => {});
                  newlineIndex = stdoutBuffer.indexOf("\n");
                  continue;
                }

                if (input.out === "debug") {
                  void Promise.resolve(
                    writer?.write?.({ type: "codex", chunk: parsed })
                  ).catch(() => {});
                }

                const event = normaliseEvent(parsed);
                const eventType = event?.type;

                if (!eventType) {
                  newlineIndex = stdoutBuffer.indexOf("\n");
                  continue;
                }

                switch (eventType) {
                  case "turn.started": {
                    void Promise.resolve(
                      writer?.write?.({
                        type: "notice",
                        message: "codex_turn_started",
                      })
                    ).catch(() => {});
                    break;
                  }
                  case "turn.completed": {
                    const usage = (event as { usage?: unknown }).usage;
                    void Promise.resolve(
                      writer?.write?.({
                        type: "notice",
                        message: "codex_turn_completed",
                        usage,
                      })
                    ).catch(() => {});
                    break;
                  }
                  case "turn.failed": {
                    if (!runtimeFailure) {
                      const errorPayload = (
                        event as { error?: { message?: string; code?: string } }
                      ).error;
                      const detail =
                        errorPayload?.message ??
                        errorPayload?.code ??
                        "codex_turn_failed";
                      runtimeFailure = new Error(`codex_exec_failed:${detail}`);
                      recordStage("runtime");
                    }
                    const errorText =
                      (event as { error?: { message?: string } }).error
                        ?.message ?? "Codex turn failed.";
                    void Promise.resolve(
                      writer?.write?.({ type: "stderr", text: errorText })
                    ).catch(() => {});
                    break;
                  }
                  case "error": {
                    if (!runtimeFailure) {
                      const message =
                        (event as { message?: string }).message ??
                        "codex_stream_error";
                      runtimeFailure = new Error(message);
                      recordStage("runtime");
                    }
                    const message =
                      (event as { message?: string }).message ??
                      "Codex reported an error.";
                    void Promise.resolve(
                      writer?.write?.({ type: "stderr", text: message })
                    ).catch(() => {});
                    break;
                  }
                  case "item.completed": {
                    const item = (event as { item?: unknown }).item;
                    const itemType = (item as { type?: string } | undefined)
                      ?.type;
                    if (itemType === "reasoning") {
                      const reasoningText = extractReasoningText(item);
                      if (reasoningText) {
                        appendReasoningTrace(
                          reasoningAccumulator,
                          reasoningText,
                          Date.now(),
                          OUTPUT_CAP_BYTES
                        );

                        if (input.out === "debug") {
                          void Promise.resolve(
                            writer?.write?.({
                              type: "reasoning",
                              text: reasoningText,
                            })
                          ).catch(() => {});
                        }
                      }
                    } else if (itemType === "command_execution") {
                      const output = extractAggregatedOutput(item);
                      if (output) {
                        void Promise.resolve(
                          writer?.write?.({ type: "stdout", text: output })
                        ).catch(() => {});
                      }
                    } else if (itemType === "agent_message") {
                      const text = extractAgentMessage(item);
                      if (text) {
                        appendOutput(finalAccumulator, text);
                        void Promise.resolve(
                          writer?.write?.({ type: "stdout", text })
                        ).catch(() => {});
                      }
                    }
                    break;
                  }
                  default: {
                    // ignore other event types unless debug mode requested (already emitted above)
                    break;
                  }
                }
              }

              newlineIndex = stdoutBuffer.indexOf("\n");
            }
          }
        } catch (_error) {
          if (!parseFailure) {
            parseFailure = new Error("codex_stream_read_failed");
            recordStage("parse");
          }
        }
      })();
    }

    // Handle stderr stream using shared utility
    streamStderr(proc, writer);

    // Handle exit and errors
    let exitCode = 0;
    try {
      exitCode = await proc.exited;
    } catch (error) {
      recordStage("spawn");
      timeoutCtx.clear();
      stopTimer();
      throw error;
    } finally {
      timeoutCtx.clear();
      stopTimer();
    }

    recordToolExecution("codex", input.auto, exitCode);

    if (timeoutCtx.didTimeout) {
      recordStage("timeout");
      throw new Error("codex_exec_timeout");
    }

    if (parseFailure) {
      throw parseFailure;
    }

    if (runtimeFailure) {
      throw runtimeFailure;
    }

    if (exitCode !== 0) {
      recordStage("runtime");
      throw new Error(`codex_exec_failed:${exitCode}`);
    }

    if (finalAccumulator.truncated) {
      void Promise.resolve(
        writer?.write?.({ type: "notice", message: "output_truncated" })
      ).catch(() => {});
    }

    if (reasoningAccumulator.traces.length > 0) {
      const resource = resolvedCw;
      persistReasoning(resource, reasoningAccumulator.traces, {
        auto: input.auto,
      }).catch((_err) => {});
    }

    return {
      result: finalAccumulator.chunks.join("\n").trim(),
      artifacts: [],
      reasoning:
        reasoningAccumulator.traces.length > 0
          ? reasoningAccumulator.traces
          : undefined,
    };
  },
};

export type ToolCodex = typeof toolCodex;

export const __internals = {
  DEFAULT_ALLOW_PREFIXES,
  isWithinBase,
  pickEnvCodex,
  resolveExecutable: (cmd: string) => resolveExecutable(cmd, "codex"),
  mapAutoToCodex,
};
