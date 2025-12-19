import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  clearTimeout as clearNodeTimeout,
  setTimeout as setNodeTimeout,
} from "node:timers";
import { logger } from "@alfred/logger";
import type {
  ApprovalMode,
  Codex as CodexInstance,
  SandboxMode,
  Thread,
  ThreadEvent,
  ThreadItem,
  ThreadOptions,
  TurnOptions,
} from "@openai/codex-sdk";
import {
  persistCodexExecution,
} from "../../../../assistant/src/graphstore.js";
import {
  recordCodexWriterError,
  startCodexSessionValidationTimer,
} from "../../../metrics.js";
import type { CodexSessionState } from "../../codex-session.js";
import {
  appendOutput,
  appendReasoningTrace,
  createOutputAccumulator,
  createReasoningAccumulator,
  createStageRecorder,
  extractReasoningText,
  getAccumulatedOutput,
  persistReasoning,
  recordToolExecution,
  startToolTimer,
  type ToolWriter,
} from "../shared/index.js";
import {
  assessSessionResumeEligibility,
  sessionManager,
} from "../../codex-session.js";
import {
  type AlfredCodexEvent,
  type CodexArtifactSummary,
  type CodexExecuteArgs,
  type CodexToolInput,
  DEFAULT_TIMEOUT_SEC,
  type SandboxConfig,
  validateOutputSchema,
} from "./definition.js";
import {
  assertAllowedDirectory,
  mapAutoToCodex,
  pickEnvCodex,
  resolveExecutable,
} from "./policy.js";
import { loadCodexSdk } from "./sdk.js";

type WriterPayload = { [key: string]: unknown };
type SafeWriter = (payload: WriterPayload, context: string) => Promise<void>;

const WRITER_FAILURE_WARN_THRESHOLD = 10;
const WRITER_CONSECUTIVE_FAILURE_ABORT_THRESHOLD = 5;
const WRITER_WARNING_INTERVAL_MS = 5000;
const THREAD_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const DISCONNECT_ERROR_NAMES = new Set(["AbortError", "DOMException"]);
const DISCONNECT_ERROR_CODES = new Set([
  "ECONNRESET",
  "EPIPE",
  "ERR_STREAM_DESTROYED",
]);
const DISCONNECT_ERROR_PATTERNS = [
  "client disconnected",
  "connection reset",
  "socket hang up",
  "stream is closed",
  "websocket is not open",
  "cannot write to closed stream",
];

function isDisconnectError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (error instanceof Error) {
    if (DISCONNECT_ERROR_NAMES.has(error.name)) {
      return true;
    }
    const message = error.message?.toLowerCase?.() ?? "";
    if (message) {
      return DISCONNECT_ERROR_PATTERNS.some((pattern) =>
        message.includes(pattern)
      );
    }
  }

  const code = (error as { code?: string }).code;
  if (code && DISCONNECT_ERROR_CODES.has(code)) {
    return true;
  }

  const cause = (error as { cause?: unknown }).cause;
  if (cause) {
    return isDisconnectError(cause);
  }

  return false;
}

function createSafeWriter(
  writer: ToolWriter,
  abortExecution: () => void
): SafeWriter {
  let totalFailures = 0;
  let consecutiveFailures = 0;
  let writerHealthy = true;
  let warnedAboutDisconnect = false;
  let lastDisconnectWarnAt = Number.NEGATIVE_INFINITY;
  let lastWriteWarnAt = Number.NEGATIVE_INFINITY;

  return async (payload, context) => {
    if (!(writerHealthy && writer?.write)) {
      return;
    }

    try {
      await Promise.resolve(writer.write(payload));
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      totalFailures += 1;
      const isDisconnect = isDisconnectError(error);
      const errorType = isDisconnect ? "disconnect" : "write_failure";
      recordCodexWriterError(errorType);

      const logContext = {
        context,
        totalFailures,
        consecutiveFailures,
      };

      const now = Date.now();
      const shouldLog =
        now - (isDisconnect ? lastDisconnectWarnAt : lastWriteWarnAt) >=
        WRITER_WARNING_INTERVAL_MS;

      if (isDisconnect && shouldLog) {
        lastDisconnectWarnAt = now;
        logger.debug("Codex writer disconnect", { ...logContext, err: error });
      } else if (!isDisconnect && shouldLog) {
        lastWriteWarnAt = now;
        logger.warn("Codex writer write error", { ...logContext, err: error });
      }

      if (
        totalFailures > WRITER_FAILURE_WARN_THRESHOLD &&
        !warnedAboutDisconnect
      ) {
        warnedAboutDisconnect = true;
        logger.warn(
          "Codex writer failures exceed threshold; client may be disconnected",
          { totalFailures }
        );
      }

      if (
        consecutiveFailures >= WRITER_CONSECUTIVE_FAILURE_ABORT_THRESHOLD &&
        writerHealthy
      ) {
        writerHealthy = false;
        logger.warn("Codex writer unhealthy; aborting Codex execution", {
          consecutiveFailures,
        });
        abortExecution();
      }
    }
  };
}

function linkExternalAbortSignal(
  controller: AbortController,
  external?: AbortSignal,
  onExternalAbort?: () => void
): () => void {
  if (!external) {
    return () => {};
  }

  const handleAbort = () => {
    onExternalAbort?.();
    controller.abort();
  };

  if (external.aborted) {
    handleAbort();
    return () => {};
  }

  external.addEventListener("abort", handleAbort, { once: true });
  return () => {
    external.removeEventListener("abort", handleAbort);
  };
}

function formatArtifactReasoning(
  artifactSummaries: CodexArtifactSummary[]
): string {
  const details = artifactSummaries
    .map((artifact) => {
      const kind = artifact.kind || "file";
      const path = artifact.path || "(unknown)";
      return `- ${kind} ${path}`;
    })
    .join("\n");
  return `artifacts_collected (${artifactSummaries.length}):\n${details}`;
}

function emitAlfredEvents(
  writeFn: SafeWriter,
  events: AlfredCodexEvent[]
): void {
  if (events.length === 0) {
    return;
  }
  for (const event of events) {
    void writeFn({ type: "codex_event", event }, "codex_event");
  }
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

export function buildTurnOptions(
  input: CodexToolInput,
  signal: AbortSignal
): TurnOptions {
  const options: TurnOptions = {
    signal,
  };

  if (input.outputSchema) {
    if (!validateOutputSchema(input.outputSchema)) {
      throw new Error("invalid_output_schema");
    }
    options.outputSchema = input.outputSchema;
  }

  return options;
}

async function createCodexClient(
  env: Record<string, string>
): Promise<CodexInstance> {
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

  const { Codex } = await loadCodexSdk();
  return new Codex(options);
}

type ThreadValidator = (threadId: string) => Promise<boolean>;

function resolveThreadValidator(
  codex: CodexInstance
): ThreadValidator | undefined {
  const maybeValidate = (
    codex as CodexInstance & {
      validateThread?: (id: string) => Promise<boolean> | boolean;
    }
  ).validateThread;

  if (typeof maybeValidate === "function") {
    return async (threadId: string) => {
      try {
        const result = await maybeValidate.call(codex, threadId);
        return result !== false;
      } catch (error) {
        logger.warn("codex_thread_validation_failed", {
          threadId,
          err: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    };
  }

  return createFilesystemThreadValidator();
}

function resolveCodexSessionsDir(): string | null {
  const explicit = process.env.CODEX_HOME?.trim();
  if (explicit) {
    return path.join(path.resolve(explicit), "sessions");
  }
  const home = os.homedir();
  if (!home) {
    return null;
  }
  return path.join(home, ".codex", "sessions");
}

function createFilesystemThreadValidator(
  codexHomeOverride?: string
): ThreadValidator | undefined {
  const sessionsDir = codexHomeOverride
    ? path.join(path.resolve(codexHomeOverride), "sessions")
    : resolveCodexSessionsDir();

  if (!sessionsDir) {
    return;
  }

  return async (threadId: string) => {
    if (!THREAD_ID_PATTERN.test(threadId)) {
      return false;
    }

    const filePath = path.join(sessionsDir, `${threadId}.json`);
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        return false;
      }
      logger.warn("codex_thread_validation_fs_error", {
        threadId,
        path: filePath,
        err: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };
}

type AllowedDirectoryHandle = ReturnType<typeof assertAllowedDirectory>;

function ensureDirectoryHandle(
  handle: AllowedDirectoryHandle | string
): AllowedDirectoryHandle {
  if (
    handle &&
    typeof handle === "object" &&
    typeof (handle as AllowedDirectoryHandle).path === "string" &&
    typeof (handle as AllowedDirectoryHandle).close === "function"
  ) {
    return handle as AllowedDirectoryHandle;
  }

  const derivedPath =
    typeof handle === "string" ? handle : (handle as { path?: unknown })?.path;

  return {
    fd: -1,
    path: typeof derivedPath === "string" ? derivedPath : process.cwd(),
    close: () => {},
  } as AllowedDirectoryHandle;
}

export async function executeWithSdk({
  input,
  writer,
  signal,
}: CodexExecuteArgs) {
  const rawHandle = assertAllowedDirectory(input.cw ?? process.cwd());
  const cwdHandle = ensureDirectoryHandle(rawHandle);
  try {
    return await runCodexWithSdk({ input, writer, signal, cwdHandle });
  } finally {
    cwdHandle.close();
  }
}

async function runCodexWithSdk({
  input,
  writer,
  signal,
  cwdHandle,
}: CodexExecuteArgs & { cwdHandle: AllowedDirectoryHandle }) {
  const resolvedCw = cwdHandle.path;
  const sandbox = mapAutoToCodex(input.auto);
  const env = pickEnvCodex(input.env);

  const stopTimer = startToolTimer("codex", input.auto);
  const recordStage = createStageRecorder("codex");

  const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
  const timeoutController = new AbortController();
  let abortedByExternalSignal = false;
  const unlinkExternalAbort = linkExternalAbortSignal(
    timeoutController,
    signal,
    () => {
      abortedByExternalSignal = true;
    }
  );
  const safeWriter = createSafeWriter(writer, () => timeoutController.abort());
  let didTimeout = false;
  const timer = setNodeTimeout(() => {
    didTimeout = true;
    recordStage("timeout");
    timeoutController.abort();
    void safeWriter(
      {
        type: "notice",
        message: "codex_exec_timeout",
      },
      "codex_exec_timeout_notice"
    );
  }, timeoutSec * 1000);

  const finalAccumulator = createOutputAccumulator();
  const reasoningAccumulator = createReasoningAccumulator();

  let runtimeFailure: Error | null = null;
  let threadIdFromEvents: string | undefined;
  const artifacts: CodexArtifactSummary[] = [];

  const codex = await createCodexClient(env);
  const threadOptions = buildThreadOptions(input, resolvedCw, sandbox);
  const threadValidator = resolveThreadValidator(codex);

  const sessionId = input.sessionId?.trim();
  const sessionOwnerId = input.userId?.trim();
  let existingSession: CodexSessionState | undefined;
  if (sessionId) {
    if (!sessionOwnerId) {
      throw new Error("codex_session_user_required");
    }
    existingSession = await sessionManager.getSession(
      sessionId,
      sessionOwnerId
    );
  } else {
    existingSession = undefined;
  }

  let thread: Thread;
  const stopSessionValidationTimer = startCodexSessionValidationTimer();

  const SESSION_VALIDATION_TIMEOUT_MS = 5000;
  const validationPromise = assessSessionResumeEligibility({
    session: existingSession,
    workingDirectory: resolvedCw,
    validateThread: threadValidator,
  });

  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<{
    canResume: false;
    reason: "timeout";
  }>((resolve) => {
    timeoutHandle = setNodeTimeout(() => {
      resolve({ canResume: false, reason: "timeout" });
    }, SESSION_VALIDATION_TIMEOUT_MS);
  });

  let resumeAssessment:
    | Awaited<typeof validationPromise>
    | {
        canResume: false;
        reason: "timeout";
      };

  try {
    resumeAssessment = await Promise.race([validationPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearNodeTimeout(timeoutHandle);
    }
  }

  if (!resumeAssessment.canResume && resumeAssessment.reason === "timeout") {
    logger.warn("codex_session_validation_timeout", {
      sessionId: existingSession?.sessionId,
      workingDirectory: resolvedCw,
    });
    try {
      const { codexSessionValidationTimeoutTotal } = await import(
        "@alfred/metrics/shared"
      );
      codexSessionValidationTimeoutTotal.inc();
    } catch {
      // Metrics not available
    }
  }

  stopSessionValidationTimer({
    outcome: resumeAssessment.canResume
      ? "resume"
      : (resumeAssessment.reason ?? "unknown"),
  });

  if (resumeAssessment.canResume) {
    thread = codex.resumeThread(
      resumeAssessment.session.threadId,
      threadOptions
    );
  } else {
    if (existingSession?.threadId) {
      void safeWriter(
        {
          type: "notice",
          message: "codex_session_thread_reset",
          reason: resumeAssessment.reason,
        },
        "codex_session_thread_reset"
      );
    }
    thread = codex.startThread(threadOptions);
  }

  try {
    if (timeoutController.signal.aborted && abortedByExternalSignal) {
      throw new Error("codex_exec_aborted");
    }

    const turnOptions = buildTurnOptions(input, timeoutController.signal);

    // Inject Linear context if provided
    let enrichedPrompt = input.prompt;
    if (input.context?.linearIssueId) {
      // const { injectLinearContext } = await import("../codex-linear.js");
      // enrichedPrompt = injectLinearContext(input.prompt, input.context);
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
          void safeWriter(
            {
              type: "notice",
              message: "codex_turn_started",
            },
            "codex_turn_started_notice"
          );
          break;
        }
        case "turn.completed": {
          const usage = event.usage;
          void safeWriter(
            {
              type: "notice",
              message: "codex_turn_completed",
              usage,
            },
            "codex_turn_completed_notice"
          );
          break;
        }
        case "turn.failed": {
          const detail = event.error?.message ?? "codex_turn_failed";
          if (!runtimeFailure) {
            runtimeFailure = new Error(`codex_exec_failed:${detail}`);
            recordStage("runtime");
          }
          logger.error("codex_turn_failed", {
            detail,
            threadId: thread.id ?? threadIdFromEvents,
            stage: "turn.failed",
          });
          void safeWriter(
            { type: "stderr", text: "Codex turn failed." },
            "codex_turn_failed"
          );
          break;
        }
        case "error": {
          const detail = event.message ?? "codex_stream_error";
          if (!runtimeFailure) {
            runtimeFailure = new Error(`codex_exec_failed:${detail}`);
            recordStage("runtime");
          }
          logger.error("codex_stream_error", {
            detail,
            threadId: thread.id ?? threadIdFromEvents,
            stage: "stream.error",
          });
          void safeWriter(
            { type: "stderr", text: "Codex reported an error." },
            "codex_stream_error"
          );
          break;
        }
        case "item.completed": {
          const item: ThreadItem = event.item;
          const alfredEvents: AlfredCodexEvent[] = [];

          if (item.type === "reasoning") {
            const reasoningText = extractReasoningText(item);
            if (reasoningText) {
              const timestamp = Date.now();
              appendReasoningTrace(
                reasoningAccumulator,
                reasoningText,
                timestamp
              );

              if (input.out === "debug") {
                void safeWriter(
                  {
                    type: "reasoning",
                    text: reasoningText,
                  },
                  "codex_reasoning"
                );
              }

              alfredEvents.push({
                type: "thought",
                content: reasoningText,
                timestamp,
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
              void safeWriter(
                { type: "stdout", text: output },
                "codex_command_output"
              );
              alfredEvents.push({
                type: "output",
                content: output,
              });
            }
          } else if (item.type === "agent_message") {
            const text = item.text;
            if (text) {
              appendOutput(finalAccumulator, text);
              void safeWriter({ type: "stdout", text }, "codex_agent_message");
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

          emitAlfredEvents(safeWriter, alfredEvents);

          // Emit to Linear if context available
          if (input.context && alfredEvents.length > 0) {
            const { mapCodexEventToLinearActivity } = await import(
              "../codex-linear.js"
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
    if (didTimeout) {
      throw new Error("codex_exec_timeout");
    }
    if (timeoutController.signal.aborted && abortedByExternalSignal) {
      throw new Error("codex_exec_aborted");
    }
    if (!(runtimeFailure || timeoutController.signal.aborted)) {
      recordStage("spawn");
    }
    throw error;
  } finally {
    unlinkExternalAbort();
    clearNodeTimeout(timer);
    stopTimer();
  }

  const hasFailure = Boolean(runtimeFailure) || didTimeout;
  const exitCode = hasFailure ? 1 : 0;
  recordToolExecution("codex", input.auto, exitCode);

  if (didTimeout) {
    throw new Error("codex_exec_timeout");
  }

  if (runtimeFailure) {
    throw runtimeFailure;
  }

  if (finalAccumulator.truncated) {
    void safeWriter(
      { type: "notice", message: "output_truncated" },
      "codex_output_truncated"
    );
  }

  if (artifacts.length > 0) {
    appendReasoningTrace(
      reasoningAccumulator,
      formatArtifactReasoning(artifacts)
    );
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

  const resultText = getAccumulatedOutput(finalAccumulator);

  persistCodexExecution(resource, {
    sessionId,
    threadId,
    auto: input.auto,
    result: resultText,
    artifacts,
  }).catch((_err) => {});

  if (sessionId && threadId && !existingSession) {
    if (!sessionOwnerId) {
      throw new Error("codex_session_user_required");
    }
    await sessionManager.createSession(
      sessionId,
      threadId,
      resolvedCw,
      sessionOwnerId
    );
  }

  return {
    result: resultText,
    artifacts: artifacts.length > 0 ? artifacts : undefined,
    reasoning:
      reasoningAccumulator.traces.length > 0
        ? reasoningAccumulator.traces
        : undefined,
  };
}

export const __internals = {
  resolveThreadValidator,
  createFilesystemThreadValidatorForTests: (codexHome: string) =>
    createFilesystemThreadValidator(codexHome),
};
