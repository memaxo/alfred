import { accessSync, constants as fsConstants, statSync } from "node:fs";
import path from "node:path";
import {
  clearTimeout as clearNodeTimeout,
  setTimeout as setNodeTimeout,
} from "node:timers";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import {
  type ApprovalMode,
  Codex,
  type SandboxMode,
  type Thread,
  type ThreadEvent,
  type ThreadItem,
  type ThreadOptions,
  type TurnOptions,
} from "@openai/codex-sdk";
import { z } from "zod";
import {
  persistCodexExecution,
  persistReasoning,
} from "../../../assistant/src/graphstore.js";
import {
  recordCodexError,
  recordCodexExecRun,
  startCodexExecTimer,
} from "../../metrics.js";
import {
  DEFAULT_ALLOW_PREFIXES,
  isWithinBase,
  safeRealpath,
} from "../../security/filesystem.js";
import { sessionManager } from "../codex-session.js";

const OUTPUT_CAP_BYTES = 5 * 1024 * 1024; // 5 MiB
const DEFAULT_TIMEOUT_SEC = 30 * 60;
const MIN_TIMEOUT_SEC = 30;
const MAX_TIMEOUT_SEC = 2 * 60 * 60;

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

function assertAllowedDirectory(candidate: string) {
  const resolved = safeRealpath(candidate);
  if (!resolved) {
    throw new Error("codex_invalid_cwd");
  }
  for (const prefix of DEFAULT_ALLOW_PREFIXES) {
    if (isWithinBase(prefix, resolved)) {
      const stats = statSync(resolved);
      if (!stats.isDirectory()) {
        throw new Error("codex_invalid_cwd_not_directory");
      }
      return resolved;
    }
  }
  throw new Error("codex_invalid_cwd");
}

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
  containerId: z.string().optional(), // Phase 11: Docker support
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  context: z
    .object({
      linearIssueId: z.string().optional(),
      linearSessionId: z.string().optional(),
      linearSpace: z.string().optional(),
      linearAuthz: z.string().optional(),
      relevantFiles: z.array(z.string()).optional(),
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

export type AlfredCodexEvent =
  | {
      type: "thought";
      content: string;
      timestamp: number;
    }
  | {
      type: "command";
      command: string;
      status: "running" | "completed" | "failed";
    }
  | {
      type: "output";
      content: string;
    }
  | {
      type: "artifact";
      path: string;
      kind: "file" | "image";
    };

type CodexArtifactSummary = {
  path: string;
  kind: string;
};

function emitAlfredEvents(
  writer: ToolWriter,
  events: AlfredCodexEvent[]
): void {
  if (!writer || events.length === 0) {
    return;
  }
  for (const event of events) {
    void Promise.resolve(writer.write?.({ type: "codex_event", event })).catch(
      () => {}
    );
  }
}

type ToolWriter =
  | { write: (chunk: unknown) => Promise<void> | void }
  | undefined;

export type CodexExecuteArgs = {
  input: CodexToolInput;
  writer?: ToolWriter;
};

type SandboxConfig = {
  sandbox: "read-only" | "workspace-write";
  approval: "on-request";
};

type CodexBackend = "cli" | "sdk";

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

function resolveBackend(): CodexBackend {
  const raw = process.env.ORCH_CODEX_BACKEND;
  if (!raw) {
    return "cli";
  }
  const normalised = raw.trim().toLowerCase();
  return normalised === "sdk" ? "sdk" : "cli";
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
      // continue searching
    }
  }

  throw new Error("codex_binary_not_found");
}

function buildThreadOptions(
  input: CodexToolInput,
  resolvedCw: string,
  sandbox: SandboxConfig
): ThreadOptions {
  const options: ThreadOptions = {
    sandboxMode: sandbox.sandbox as SandboxMode,
    workingDirectory: resolvedCw,
    approvalPolicy: sandbox.approval as ApprovalMode,
  };

  if (input.model) {
    options.model = input.model;
  }

  return options;
}

function buildTurnOptions(
  input: CodexToolInput,
  signal: AbortSignal
): TurnOptions {
  const options: TurnOptions = {
    signal,
  };

  if (input.outputSchema) {
    options.outputSchema = input.outputSchema;
  }

  return options;
}

function createCodexClient(env: Record<string, string>): Codex {
  const options: {
    env: Record<string, string>;
    codexPathOverride?: string;
  } = {
    env,
  };

  const codexBin = process.env.CODEX_BIN?.trim();
  if (codexBin && codexBin.length > 0) {
    const resolved = resolveExecutable(codexBin);
    options.codexPathOverride = resolved;
  }

  return new Codex(options);
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

type CodexErrorStage = "spawn" | "timeout" | "parse" | "runtime";

function createStageRecorder() {
  const recorded = new Set<CodexErrorStage>();
  return (stage: CodexErrorStage) => {
    if (!recorded.has(stage)) {
      recorded.add(stage);
      recordCodexError(stage);
    }
  };
}

type FinalAccumulator = {
  chunks: string[];
  storedBytes: number;
  truncated: boolean;
};

type ReasoningAccumulator = {
  traces: Array<{ text: string; timestamp: number }>;
  storedBytes: number;
  truncated: boolean;
};

function appendFinal(acc: FinalAccumulator, chunk: string) {
  if (!chunk) {
    return;
  }
  const buffer = Buffer.from(chunk);
  if (acc.truncated) {
    acc.storedBytes += buffer.byteLength;
    return;
  }
  const remaining = OUTPUT_CAP_BYTES - acc.storedBytes;
  if (remaining <= 0) {
    acc.truncated = true;
    return;
  }
  if (buffer.byteLength <= remaining) {
    acc.chunks.push(chunk);
    acc.storedBytes += buffer.byteLength;
    return;
  }
  acc.chunks.push(buffer.subarray(0, remaining).toString());
  acc.storedBytes += remaining;
  acc.truncated = true;
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

function extractReasoning(item: unknown): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const candidate = item as { text?: unknown; content?: unknown };

  if (typeof candidate.text === "string") {
    return candidate.text.trim();
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
      return parts.join("\n").trim();
    }
  }

  return null;
}

async function executeWithSdk({ input, writer }: CodexExecuteArgs) {
  const resolvedCw = input.cw
    ? assertAllowedDirectory(input.cw)
    : process.cwd();
  const sandbox = mapAutoToCodex(input.auto);
  const env = pickEnvCodex(input.env);

  const stopTimer = startCodexExecTimer(input.auto);
  const recordStage = createStageRecorder();

  const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
  const abortController = new AbortController();
  let didTimeout = false;
  const timer = setNodeTimeout(() => {
    didTimeout = true;
    recordStage("timeout");
    abortController.abort();
    void Promise.resolve(
      writer?.write?.({
        type: "notice",
        message: "codex_exec_timeout",
      })
    ).catch(() => {});
  }, timeoutSec * 1000);

  const finalAccumulator: FinalAccumulator = {
    chunks: [],
    storedBytes: 0,
    truncated: false,
  };
  const reasoningAccumulator: ReasoningAccumulator = {
    traces: [],
    storedBytes: 0,
    truncated: false,
  };

  let runtimeFailure: Error | null = null;
  let threadIdFromEvents: string | undefined;
  const artifacts: CodexArtifactSummary[] = [];

  const codex = createCodexClient(env);
  const threadOptions = buildThreadOptions(input, resolvedCw, sandbox);

  const sessionId = input.sessionId?.trim();
  const existingSession = sessionId
    ? await sessionManager.getSession(sessionId)
    : undefined;

  let thread: Thread;
  if (existingSession?.threadId) {
    thread = codex.resumeThread(existingSession.threadId, threadOptions);
  } else {
    thread = codex.startThread(threadOptions);
  }

  try {
    const turnOptions = buildTurnOptions(input, abortController.signal);

    // Inject Linear context if provided
    let enrichedPrompt = input.prompt;
    if (input.context?.linearIssueId) {
      const { injectLinearContext } = await import("./codex-linear");
      enrichedPrompt = injectLinearContext(input.prompt, input.context);
    }

    // Inject learning context from similar past executions
    if (process.env.CODEX_LEARNING_ENABLED === "true") {
      const { buildCodexLearningContext } = await import(
        "@alfred/db/repo/codex-learning"
      );
      const learningContext = await buildCodexLearningContext(
        resolvedCw,
        input.prompt,
        2000
      );
      if (learningContext) {
        enrichedPrompt = `${learningContext}\n\n${enrichedPrompt}`;
      }
    }

    const streamed = await thread.runStreamed(enrichedPrompt, turnOptions);

    for await (const event of streamed.events as AsyncGenerator<ThreadEvent>) {
      switch (event.type) {
        case "thread.started": {
          const id = event.thread_id;
          if (typeof id === "string" && id.length > 0) {
            threadIdFromEvents = id;
          }
          break;
        }
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
          const usage = event.usage;
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
            const detail = event.error?.message ?? "codex_turn_failed";
            runtimeFailure = new Error(`codex_exec_failed:${detail}`);
            recordStage("runtime");
          }
          const errorText = event.error?.message ?? "Codex turn failed.";
          void Promise.resolve(
            writer?.write?.({ type: "stderr", text: errorText })
          ).catch(() => {});
          break;
        }
        case "error": {
          if (!runtimeFailure) {
            const message = event.message ?? "codex_stream_error";
            runtimeFailure = new Error(message);
            recordStage("runtime");
          }
          const message = event.message ?? "Codex reported an error.";
          void Promise.resolve(
            writer?.write?.({ type: "stderr", text: message })
          ).catch(() => {});
          break;
        }
        case "item.completed": {
          const item: ThreadItem = event.item;
          const alfredEvents: AlfredCodexEvent[] = [];

          if (item.type === "reasoning") {
            const reasoningText = item.text.trim();
            if (reasoningText) {
              const byteLength = Buffer.from(reasoningText).byteLength;

              if (reasoningAccumulator.truncated) {
                reasoningAccumulator.storedBytes += byteLength;
              } else {
                const remaining =
                  OUTPUT_CAP_BYTES - reasoningAccumulator.storedBytes;
                if (remaining > 0) {
                  reasoningAccumulator.traces.push({
                    text:
                      byteLength <= remaining
                        ? reasoningText
                        : reasoningText.substring(0, remaining),
                    timestamp: Date.now(),
                  });
                  reasoningAccumulator.storedBytes += Math.min(
                    byteLength,
                    remaining
                  );
                  if (byteLength > remaining) {
                    reasoningAccumulator.truncated = true;
                  }
                } else {
                  reasoningAccumulator.truncated = true;
                }
              }

              if (input.out === "debug") {
                void Promise.resolve(
                  writer?.write?.({
                    type: "reasoning",
                    text: reasoningText,
                  })
                ).catch(() => {});
              }

              alfredEvents.push({
                type: "thought",
                content: reasoningText,
                timestamp: Date.now(),
              });
            }
          } else if (item.type === "command_execution") {
            const output = item.aggregated_output;
            const status: "running" | "completed" | "failed" =
              item.status === "in_progress"
                ? "running"
                : item.status === "failed"
                  ? "failed"
                  : "completed";

            alfredEvents.push({
              type: "command",
              command: item.command,
              status,
            });

            if (output) {
              void Promise.resolve(
                writer?.write?.({ type: "stdout", text: output })
              ).catch(() => {});
              alfredEvents.push({
                type: "output",
                content: output,
              });
            }
          } else if (item.type === "agent_message") {
            const text = item.text;
            if (text) {
              appendFinal(finalAccumulator, text);
              void Promise.resolve(
                writer?.write?.({ type: "stdout", text })
              ).catch(() => {});
              alfredEvents.push({
                type: "output",
                content: text,
              });
            }
          } else if (item.type === "file_change") {
            const changes = item.changes;
            for (const change of changes) {
              if (!change?.path) {
                continue;
              }
              artifacts.push({
                path: change.path,
                kind: change.kind,
              });
              alfredEvents.push({
                type: "artifact",
                path: change.path,
                kind: "file",
              });
            }
          }

          emitAlfredEvents(writer, alfredEvents);

          // Emit to Linear if context available
          if (input.context && alfredEvents.length > 0) {
            const { mapCodexEventToLinearActivity } = await import(
              "./codex-linear"
            );
            for (const alfredEvent of alfredEvents) {
              void mapCodexEventToLinearActivity(alfredEvent, input.context);
            }
          }
          break;
        }
        default: {
          // ignore other event types
          break;
        }
      }
    }
  } catch (error) {
    clearNodeTimeout(timer);
    stopTimer();
    if (didTimeout) {
      throw new Error("codex_exec_timeout");
    }
    if (!runtimeFailure) {
      recordStage("spawn");
    }
    throw error;
  } finally {
    clearNodeTimeout(timer);
    stopTimer();
  }

  const hasFailure = Boolean(runtimeFailure) || didTimeout;
  const exitCode = hasFailure ? 1 : 0;
  recordCodexExecRun(input.auto, exitCode);

  if (didTimeout) {
    throw new Error("codex_exec_timeout");
  }

  if (runtimeFailure) {
    throw runtimeFailure;
  }

  if (finalAccumulator.truncated) {
    void Promise.resolve(
      writer?.write?.({ type: "notice", message: "output_truncated" })
    ).catch(() => {});
  }

  const resource = resolvedCw;
  const threadId = thread.id ?? threadIdFromEvents;
  if (reasoningAccumulator.traces.length > 0) {
    const executionId = input.sessionId ?? threadId ?? resource;
    persistReasoning(resource, reasoningAccumulator.traces, {
      threadId,
      executionId,
      auto: input.auto,
    }).catch((_err) => {});
  }

  const resultText = finalAccumulator.chunks.join("\n").trim();

  persistCodexExecution(resource, {
    sessionId,
    threadId,
    auto: input.auto,
    result: resultText,
    artifacts,
  }).catch((_err) => {});

  if (sessionId && threadId && !existingSession) {
    await sessionManager.createSession(sessionId, threadId);
  }

  return {
    result: resultText,
    artifacts: [],
    reasoning:
      reasoningAccumulator.traces.length > 0
        ? reasoningAccumulator.traces
        : undefined,
  };
}

export const toolCodex = {
  name: "codex",
  description: "Run the OpenAI Codex CLI in sandboxed, non-interactive mode.",
  inputSchema: codexInputSchema,
  outputSchema: toolOutputSchema,
  execute: async ({ input, writer }: CodexExecuteArgs) => {
    await enforcePolicy(input);

    const backend = resolveBackend();
    if (backend === "sdk") {
      return executeWithSdk({ input, writer });
    }

    const resolvedCw = input.cw
      ? assertAllowedDirectory(input.cw)
      : process.cwd();
    const sandbox = mapAutoToCodex(input.auto);

    // Determine execution command
    let cmdArgs: string[] = [];
    const spawnOptions: any = {
      env: pickEnvCodex(input.env),
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    };

    if (input.containerId) {
      // Run via docker exec
      const containerId = input.containerId;
      const codexBin = process.env.DOCKER_CODEX_BIN || "codex"; // Path to codex inside container

      cmdArgs = [
        "docker",
        "exec",
        "-i",
        // "-u", "node", // User?
        "-w",
        "/workspace", // Assume workspace mount point
      ];

      // Propagate environment variables to container
      // spawnOptions.env contains the filtered envs (API keys, etc.)
      if (spawnOptions.env) {
        for (const [key, val] of Object.entries(spawnOptions.env)) {
          if (val !== undefined) {
            cmdArgs.push("-e", `${key}=${val}`);
          }
        }
      }

      cmdArgs.push(containerId, codexBin);

      // When using docker exec, cwd is handled by -w, but Bun.spawn cwd applies to the docker client.
      // We can keep Bun.spawn cwd as process.cwd() or resolvedCw (host side).
      spawnOptions.cwd = process.cwd();
    } else {
      // Local execution
      const command = process.env.CODEX_BIN?.trim() || "codex";
      let executable: string;
      try {
        executable = resolveExecutable(command);
      } catch (error) {
        recordCodexError("spawn");
        throw error;
      }
      cmdArgs = [executable];
      spawnOptions.cwd = resolvedCw;
    }

    const flags: string[] = [
      "exec",
      "--json",
      "--sandbox",
      sandbox.sandbox,
      "--ask-for-approval",
      sandbox.approval,
      // For local, we use --cd. For docker, we used -w in exec args, but codex might need --cd too?
      // If we used -w /workspace, codex starts there.
      // But if codex receives absolute paths in prompt/context that match host paths, that's an issue.
      // We rely on the environment setup (bind mount) to map host path to container path if possible,
      // OR we assume the agent works with relative paths.
      // `resolvedCw` is a host path.
      // If running in docker, we probably shouldn't pass host path to --cd unless it matches.
      // Let's skip --cd for docker and rely on -w /workspace
    ];

    if (!input.containerId) {
      flags.push("--cd", resolvedCw);
    }

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

    const proc = Bun.spawn([...cmdArgs, ...flags], spawnOptions);

    const stopTimer = startCodexExecTimer(input.auto);
    const recordStage = createStageRecorder();

    const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
    let didTimeout = false;
    const timer = setNodeTimeout(() => {
      didTimeout = true;
      recordStage("timeout");
      try {
        proc.kill("SIGKILL");
      } catch {
        // ignore errors when killing the process
      }
      void Promise.resolve(
        writer?.write?.({
          type: "notice",
          message: "codex_exec_timeout",
        })
      ).catch(() => {});
    }, timeoutSec * 1000);

    const finalAccumulator: FinalAccumulator = {
      chunks: [],
      storedBytes: 0,
      truncated: false,
    };
    const reasoningAccumulator: ReasoningAccumulator = {
      traces: [],
      storedBytes: 0,
      truncated: false,
    };
    let parseFailure: Error | null = null;
    let runtimeFailure: Error | null = null;
    let threadIdFromEvents: string | undefined;
    const artifacts: CodexArtifactSummary[] = [];

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
                  case "thread.started": {
                    const id = (event as { thread_id?: string }).thread_id;
                    if (typeof id === "string" && id.length > 0) {
                      threadIdFromEvents = id;
                    }
                    break;
                  }
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
                    const alfredEvents: AlfredCodexEvent[] = [];

                    if (itemType === "reasoning") {
                      const reasoningText = extractReasoning(item);
                      if (reasoningText) {
                        const byteLength =
                          Buffer.from(reasoningText).byteLength;

                        if (reasoningAccumulator.truncated) {
                          reasoningAccumulator.storedBytes += byteLength;
                        } else {
                          const remaining =
                            OUTPUT_CAP_BYTES - reasoningAccumulator.storedBytes;
                          if (remaining > 0) {
                            reasoningAccumulator.traces.push({
                              text:
                                byteLength <= remaining
                                  ? reasoningText
                                  : reasoningText.substring(0, remaining),
                              timestamp: Date.now(),
                            });
                            reasoningAccumulator.storedBytes += Math.min(
                              byteLength,
                              remaining
                            );
                            if (byteLength > remaining) {
                              reasoningAccumulator.truncated = true;
                            }
                          } else {
                            reasoningAccumulator.truncated = true;
                          }
                        }

                        if (input.out === "debug") {
                          void Promise.resolve(
                            writer?.write?.({
                              type: "reasoning",
                              text: reasoningText,
                            })
                          ).catch(() => {});
                        }

                        alfredEvents.push({
                          type: "thought",
                          content: reasoningText,
                          timestamp: Date.now(),
                        });
                      }
                    } else if (itemType === "command_execution") {
                      const output = extractAggregatedOutput(item);
                      const command = (
                        item as {
                          command?: string;
                          status?: string;
                        }
                      ).command;
                      const statusRaw = (
                        item as {
                          status?: string;
                        }
                      ).status;
                      const status: "running" | "completed" | "failed" =
                        statusRaw === "in_progress"
                          ? "running"
                          : statusRaw === "failed"
                            ? "failed"
                            : "completed";

                      if (command) {
                        alfredEvents.push({
                          type: "command",
                          command,
                          status,
                        });
                      }

                      if (output) {
                        void Promise.resolve(
                          writer?.write?.({ type: "stdout", text: output })
                        ).catch(() => {});
                        alfredEvents.push({
                          type: "output",
                          content: output,
                        });
                      }
                    } else if (itemType === "agent_message") {
                      const text = extractAgentMessage(item);
                      if (text) {
                        appendFinal(finalAccumulator, text);
                        void Promise.resolve(
                          writer?.write?.({ type: "stdout", text })
                        ).catch(() => {});
                        alfredEvents.push({
                          type: "output",
                          content: text,
                        });
                      }
                    } else if (itemType === "file_change") {
                      const changes = (
                        item as {
                          changes?: Array<{ path?: string; kind?: string }>;
                        }
                      ).changes;
                      if (Array.isArray(changes)) {
                        for (const change of changes) {
                          if (!change || typeof change.path !== "string") {
                            continue;
                          }
                          artifacts.push({
                            path: change.path,
                            kind: change.kind ?? "file",
                          });
                          alfredEvents.push({
                            type: "artifact",
                            path: change.path,
                            kind: "file",
                          });
                        }
                      }
                    }

                    emitAlfredEvents(writer, alfredEvents);

                    // Emit to Linear if context available
                    if (input.context && alfredEvents.length > 0) {
                      const { mapCodexEventToLinearActivity } = await import(
                        "./codex-linear"
                      );
                      for (const alfredEvent of alfredEvents) {
                        void mapCodexEventToLinearActivity(
                          alfredEvent,
                          input.context
                        );
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

    // Handle stderr stream
    if (proc.stderr && typeof proc.stderr !== "number") {
      const reader = (proc.stderr as ReadableStream).getReader();
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

    // Handle exit and errors
    let exitCode = 0;
    try {
      exitCode = await proc.exited;
    } catch (error) {
      recordStage("spawn");
      clearNodeTimeout(timer);
      stopTimer();
      throw error;
    } finally {
      clearNodeTimeout(timer);
      stopTimer();
    }

    recordCodexExecRun(input.auto, exitCode);

    if (didTimeout) {
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
      const executionId = input.sessionId ?? threadIdFromEvents ?? resource;
      persistReasoning(resource, reasoningAccumulator.traces, {
        threadId: threadIdFromEvents,
        executionId,
        auto: input.auto,
      }).catch((_err) => {});
    }

    const resultText = finalAccumulator.chunks.join("\n").trim();

    persistCodexExecution(resolvedCw, {
      sessionId: input.sessionId,
      threadId: threadIdFromEvents,
      auto: input.auto,
      result: resultText,
      artifacts,
    }).catch((_err) => {});

    return {
      result: resultText,
      artifacts,
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
  resolveExecutable,
  mapAutoToCodex,
};
