/**
 * Codex execution
 *
 * Async patterns:
 * - Fire-and-forget promises use: void safeWriter(...)
 * - Catch-ignored promises must log: .catch(err => logger.debug("...", { err }))
 * - OUTPUT_CAP_BYTES enforced incrementally via appendOutput()
 */

import { runStreamed } from "@alfred/codex";
import { logger } from "@alfred/logger";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  clearTimeout as clearNodeTimeout,
  setTimeout as setNodeTimeout,
} from "node:timers";

import type { CodexSessionState } from "../../codex-session.js";

import { persistCodexExecution } from "../../../../assistant/src/graphstore.js";
import { persistArtifact } from "../../../artifact/persist.js";
import {
  recordCodexWriterError,
  startCodexSessionValidationTimer,
} from "../../../metrics.js";
import {
  assessSessionResumeEligibility,
  sessionManager,
} from "../../codex-session.js";
import {
  appendOutput,
  appendReasoningTrace,
  createOutputAccumulator,
  createReasoningAccumulator,
  createStageRecorder,
  getAccumulatedOutput,
  isExecProfileStrict,
  persistReasoning,
  recordToolExecution,
  resolveExecProfile,
  startToolTimer,
  type ToolWriter,
} from "../shared/index.js";
import { executorServerFallbackTotal } from "../shared/metrics.js";
import {
  type AlfredCodexEvent,
  type CodexArtifactSummary,
  type CodexExecuteArgs,
  type CodexToolInput,
  DEFAULT_TIMEOUT_SEC,
  validateOutputSchema,
} from "./definition.js";
import { CodexError } from "./error.js";
import {
  type EventProcessorContext,
  formatArtifactReasoning,
  processThreadEvent,
} from "./event-processor.js";
import {
  assertAllowedDirectory,
  mapAutoToCodex,
  pickEnvCodex,
  resolveExecutable,
} from "./policy.js";
import { CodexRunRecorder } from "./record.js";
import { executeWithCodexServer } from "./server.js";
import { createCodexSpawn } from "./spawn-process.js";

type WriterPayload = Record<string, unknown>;
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

  const { code } = error as { code?: string };
  if (code && DISCONNECT_ERROR_CODES.has(code)) {
    return true;
  }

  const { cause } = error as { cause?: unknown };
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
        consecutiveFailures,
        context,
        totalFailures,
      };

      const now = Date.now();
      const shouldLog =
        now - (isDisconnect ? lastDisconnectWarnAt : lastWriteWarnAt) >=
        WRITER_WARNING_INTERVAL_MS;

      if (isDisconnect && shouldLog) {
        lastDisconnectWarnAt = now;
        logger.debug("codex_writer_disconnect", { ...logContext, err: error });
      } else if (!isDisconnect && shouldLog) {
        lastWriteWarnAt = now;
        logger.warn("codex_writer_error", { ...logContext, err: error });
      }

      if (
        totalFailures > WRITER_FAILURE_WARN_THRESHOLD &&
        !warnedAboutDisconnect
      ) {
        warnedAboutDisconnect = true;
        logger.warn("codex_writer_threshold_exceeded", { totalFailures });
      }

      if (
        consecutiveFailures >= WRITER_CONSECUTIVE_FAILURE_ABORT_THRESHOLD &&
        writerHealthy
      ) {
        writerHealthy = false;
        logger.warn("codex_writer_unhealthy_abort", { consecutiveFailures });
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

function emitAlfredEvents(
  writeFn: SafeWriter,
  events: AlfredCodexEvent[]
): void {
  for (const event of events) {
    void writeFn({ event, type: "codex_event" }, "codex_event");
  }
}

export interface CodexTurnOptions {
  signal: AbortSignal;
  outputSchema?: unknown;
}

export function buildTurnOptions(
  input: CodexToolInput,
  signal: AbortSignal
): CodexTurnOptions {
  const options: CodexTurnOptions = { signal };

  if (input.outputSchema) {
    if (!validateOutputSchema(input.outputSchema)) {
      throw CodexError.parse("invalid_output_schema");
    }
    options.outputSchema = input.outputSchema;
  }

  return options;
}

function resolveCodexBin(): string {
  const override = process.env.CODEX_BIN?.trim();
  if (override) {
    return resolveExecutable(override);
  }

  const candidates = [
    path.resolve(process.cwd(), ".cache", "codex", "bin", "codex"),
    path.resolve(
      process.cwd(),
      "vendor",
      "codex",
      "target",
      "release",
      "codex"
    ),
    path.resolve(process.cwd(), "vendor", "codex", "target", "debug", "codex"),
    "codex",
  ];

  for (const candidate of candidates) {
    try {
      return resolveExecutable(candidate);
    } catch {
      // continue
    }
  }

  throw CodexError.spawn("codex_binary_not_found");
}

async function resolveProjectId(args: {
  workingDirectory: string;
  userId: string | undefined;
  session: CodexSessionState | undefined;
}): Promise<string | undefined> {
  if (args.session?.projectId) {
    const { projectId } = args.session;
    if (process.env.DATABASE_URL) {
      import("@alfred/db/repo/project")
        .then((repo) => repo.updateProjectLastActive(projectId))
        .catch(() => {});
    }
    return projectId;
  }

  if (!(process.env.DATABASE_URL && args.userId)) {
    return;
  }

  try {
    const { detectProject } = await import("@alfred/plan");
    const project = await detectProject(args.workingDirectory, args.userId);
    return project.id;
  } catch {
    return;
  }
}

type ThreadValidator = (threadId: string) => Promise<boolean>;

function resolveThreadValidator(): ThreadValidator | undefined {
  return createFilesystemThreadValidator(process.env.CODEX_HOME);
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
      logger.warn("codex_thread_validation_error", {
        err: error instanceof Error ? error.message : String(error),
        path: filePath,
        threadId,
      });
      return false;
    }
  };
}

type AllowedDirectoryHandle = ReturnType<typeof assertAllowedDirectory>;

export async function executeWithCodex({
  input,
  writer,
  signal,
}: CodexExecuteArgs) {
  const cwdHandle = assertAllowedDirectory(input.cw ?? process.cwd());
  try {
    const profile = resolveExecProfile(input.execProfile, input.containerName);
    if (profile === "server") {
      try {
        const output = await executeWithCodexServer({
          cwdHandle,
          input,
          signal,
          writer,
        });
        return {
          artifacts: output.artifacts,
          result: output.result,
        };
      } catch (error) {
        if (
          !(isExecProfileStrict() || signal?.aborted) &&
          error instanceof Error &&
          error.message === "codex_server_start_failed"
        ) {
          executorServerFallbackTotal.inc({ executor: "codex" });
          void Promise.resolve(
            writer?.write?.({
              message: "executor_server_fallback_default",
              type: "notice",
            })
          ).catch(() => {});

          return await runCodexWithCodex({ cwdHandle, input, signal, writer });
        }
        throw error;
      }
    }
    return await runCodexWithCodex({ cwdHandle, input, signal, writer });
  } finally {
    cwdHandle.close();
  }
}

async function runCodexWithCodex({
  input,
  writer,
  signal,
  cwdHandle,
}: CodexExecuteArgs & { cwdHandle: AllowedDirectoryHandle }) {
  const resolvedCw = cwdHandle.path;
  const sandbox = mapAutoToCodex(input.auto);
  const env = pickEnvCodex(input.env);

  const sessionId = input.sessionId?.trim();
  const sessionOwnerId = input.userId?.trim();
  if (sessionId && !sessionOwnerId) {
    throw CodexError.session("codex_session_user_required");
  }

  let existingSession: CodexSessionState | undefined;
  if (sessionId) {
    if (!sessionOwnerId) {
      throw CodexError.session("codex_session_user_required");
    }
    existingSession = await sessionManager.getSession(
      sessionId,
      sessionOwnerId
    );
  } else {
    existingSession = undefined;
  }

  const projectId = await resolveProjectId({
    session: existingSession,
    userId: sessionOwnerId,
    workingDirectory: resolvedCw,
  });

  const recorder = await CodexRunRecorder.start({
    agentfsDbPath: input.agentfsDbPath,
    agentfsRunId: process.env.ORCH_RUN_ID,
    auto: input.auto,
    environmentKind: "agentfs",
    model: input.model,
    outputSchema:
      input.outputSchema && validateOutputSchema(input.outputSchema)
        ? input.outputSchema
        : null,
    profile: input.profile,
    projectId,
    sessionId,
    threadId: undefined,
    userId: sessionOwnerId,
    workingDirectory: resolvedCw,
    workspaceRoot: process.env.ORCH_WORKSPACE_ROOT,
  });
  recorder.recordWriterChunk({ message: "codex_run_started", type: "notice" });

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

  const writerWithRecording: ToolWriter = {
    write: (payload: unknown) => {
      try {
        recorder.recordWriterChunk(payload);
      } catch (error) {
        logger.debug("codex_recorder_error", { error });
      }
      return Promise.resolve(writer?.write?.(payload));
    },
  };
  const safeWriter = createSafeWriter(writerWithRecording, () =>
    timeoutController.abort()
  );

  let didTimeout = false;
  const timer = setNodeTimeout(() => {
    didTimeout = true;
    recordStage("timeout");
    timeoutController.abort();
    void safeWriter(
      { message: "codex_exec_timeout", type: "notice" },
      "codex_exec_timeout_notice"
    );
  }, timeoutSec * 1000);

  const finalAccumulator = createOutputAccumulator();
  const reasoningAccumulator = createReasoningAccumulator();

  let runtimeFailure: Error | null = null;
  let threadIdFromEvents: string | undefined;
  const artifacts: CodexArtifactSummary[] = [];

  let turnStartTime: number | undefined;
  let tokenUsage:
    | {
        inputTokens: number;
        outputTokens: number;
        cachedInputTokens?: number;
      }
    | undefined;

  // When running Codex inside a container (docker exec), the spawn wrapper ignores
  // the `cmd` we provide to runStreamed, so we must not require a host-installed
  // codex binary in that mode.
  const codexBin = input.containerName ? "codex" : resolveCodexBin();
  const threadValidator = resolveThreadValidator();

  const stopSessionValidationTimer = startCodexSessionValidationTimer();

  const SESSION_VALIDATION_TIMEOUT_MS = 5000;
  const validationPromise = assessSessionResumeEligibility({
    session: existingSession,
    validateThread: threadValidator,
    workingDirectory: resolvedCw,
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
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
    | { canResume: false; reason: "timeout" };

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
    import("@alfred/metrics/shared")
      .then((m) => m.codexSessionValidationTimeoutTotal.inc())
      .catch((error) => logger.debug("codex_metrics_import_error", { error }));
  }

  const resumeOutcome = resumeAssessment.canResume
    ? "resume"
    : resumeAssessment.reason;
  stopSessionValidationTimer({ outcome: resumeOutcome });

  const resumeThreadId = resumeAssessment.canResume
    ? resumeAssessment.session.threadId
    : undefined;

  const resumeReason = resumeAssessment.canResume
    ? undefined
    : resumeAssessment.reason;

  if (!resumeThreadId && existingSession?.threadId) {
    void safeWriter(
      {
        message: "codex_session_thread_reset",
        reason: resumeReason,
        type: "notice",
      },
      "codex_session_thread_reset"
    );
  }

  try {
    if (timeoutController.signal.aborted && abortedByExternalSignal) {
      throw CodexError.runtime("codex_exec_aborted");
    }

    const turnOptions = buildTurnOptions(input, timeoutController.signal);

    let enrichedPrompt = input.prompt;

    // Inject learning context from similar past executions
    try {
      const { buildCodexLearningContext } =
        await import("@alfred/db/repo/codex-learning");

      const learningResource = projectId
        ? `project:${projectId}:${resolvedCw}`
        : resolvedCw;
      const learningContext = await buildCodexLearningContext(
        learningResource,
        input.prompt,
        2000
      );
      if (learningContext) {
        enrichedPrompt = `${learningContext}\n\n${enrichedPrompt}`;
      }
    } catch (error) {
      logger.debug("codex_learning_context_skipped", {
        err: error instanceof Error ? error.message : String(error),
      });
    }

    // Inject heuristic context from past failures/corrections
    try {
      const { buildCodexHeuristicContext } =
        await import("@alfred/db/repo/codex-learning");
      const heuristicContext = await buildCodexHeuristicContext(
        input.prompt,
        1200
      );
      if (heuristicContext) {
        enrichedPrompt = `${heuristicContext}\n\n${enrichedPrompt}`;
      }
    } catch (error) {
      logger.debug("codex_heuristic_context_skipped", {
        err: error instanceof Error ? error.message : String(error),
      });
    }

    const spawn = await createCodexSpawn(input, cwdHandle);

    const eventContext: EventProcessorContext = {
      outputDebug: input.out === "debug",
      reasoningAccumulator,
    };

    for await (const event of runStreamed({
      approval: sandbox.approval,
      cmd: codexBin,
      env,
      model: input.model,
      onStderr: (text) =>
        void safeWriter({ type: "stderr", text }, "codex_stderr_chunk"),
      outputSchema: turnOptions.outputSchema as unknown as
        | boolean
        | Record<string, unknown>
        | undefined,
      profile: input.profile,
      prompt: enrichedPrompt,
      resumeThreadId,
      sandbox: sandbox.sandbox,
      signal: turnOptions.signal,
      spawn,
    })) {
      recorder.recordThreadEvent(event);

      const processed = processThreadEvent(event, eventContext);

      if (processed.threadId) {
        threadIdFromEvents = processed.threadId;
        recorder.setThreadId(processed.threadId);
      }

      if (processed.turnStarted) {
        turnStartTime = Date.now();
        void safeWriter(
          { message: "codex_turn_started", type: "notice" },
          "codex_turn_started_notice"
        );
      }

      if (processed.turnCompleted) {
        if (processed.tokenUsage) {
          ({ tokenUsage } = processed);
        }
        void safeWriter(
          {
            message: "codex_turn_completed",
            type: "notice",
            usage: processed.tokenUsage,
          },
          "codex_turn_completed_notice"
        );
      }

      if (processed.error) {
        if (!runtimeFailure) {
          runtimeFailure = CodexError.runtime(processed.error.message);
          recordStage("runtime");
        }
        logger.error("codex_event_error", {
          detail: processed.error.message,
          stage: processed.error.stage,
          threadId: threadIdFromEvents,
        });
        void safeWriter(
          { text: `Codex error: ${processed.error.message}`, type: "stderr" },
          "codex_error"
        );
      }

      if (processed.reasoning) {
        appendReasoningTrace(
          reasoningAccumulator,
          processed.reasoning,
          Date.now()
        );
        if (eventContext.outputDebug) {
          void safeWriter(
            { text: processed.reasoning, type: "reasoning" },
            "codex_reasoning"
          );
        }
      }

      if (processed.outputChunk) {
        appendOutput(finalAccumulator, processed.outputChunk);
        void safeWriter(
          { text: processed.outputChunk, type: "stdout" },
          "codex_output"
        );
      }

      if (processed.artifacts) {
        for (const artifact of processed.artifacts) {
          artifacts.push(artifact);
        }
      }

      emitAlfredEvents(safeWriter, processed.alfredEvents);

      const { context } = input;
      if (context && processed.alfredEvents.length > 0) {
        import("../codex-linear.js")
          .then(async ({ mapCodexEventToLinearActivity }) => {
            for (const alfredEvent of processed.alfredEvents) {
              await mapCodexEventToLinearActivity(alfredEvent, context);
            }
          })
          .catch((error) => logger.debug("codex_linear_emit_error", { error }));
      }
    }
  } catch (error) {
    if (didTimeout) {
      await recorder.finalizeError({
        errorCode: "timeout",
        errorMessage: "codex_exec_timeout",
        exitCode: 1,
      });
      throw CodexError.timeout();
    }
    if (timeoutController.signal.aborted && abortedByExternalSignal) {
      await recorder.finalizeError({
        errorCode: "aborted",
        errorMessage: "codex_exec_aborted",
        exitCode: null,
      });
      throw CodexError.runtime("codex_exec_aborted");
    }
    if (!(runtimeFailure || timeoutController.signal.aborted)) {
      recordStage("spawn");
    }
    await recorder.finalizeError({
      errorCode: "execution_failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      exitCode: 1,
    });
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
    await recorder.finalizeError({
      errorCode: "timeout",
      errorMessage: "codex_exec_timeout",
      exitCode: 1,
    });
    throw CodexError.timeout();
  }

  if (runtimeFailure) {
    await recorder.finalizeError({
      errorCode: "execution_failed",
      errorMessage: runtimeFailure.message,
      exitCode: 1,
    });
    throw runtimeFailure;
  }

  if (finalAccumulator.truncated) {
    void safeWriter(
      { message: "output_truncated", type: "notice" },
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
  const threadId = threadIdFromEvents;
  if (reasoningAccumulator.traces.length > 0) {
    const executionId = input.sessionId ?? threadId ?? resource;
    persistReasoning(resource, reasoningAccumulator.traces, {
      auto: input.auto,
      executionId,
      projectId,
      threadId,
    }).catch((error) =>
      logger.debug("codex_persist_reasoning_error", { error })
    );
  }

  const resultText = getAccumulatedOutput(finalAccumulator);

  persistCodexExecution(resource, {
    artifacts,
    auto: input.auto,
    projectId,
    result: resultText,
    sessionId,
    threadId,
  }).catch((error) => logger.debug("codex_persist_execution_error", { error }));

  if (sessionId && threadId && !existingSession) {
    if (!sessionOwnerId) {
      throw CodexError.session("codex_session_user_required");
    }
    try {
      if (projectId) {
        await sessionManager.createSession(
          sessionId,
          threadId,
          resolvedCw,
          sessionOwnerId,
          { projectId }
        );
      } else {
        await sessionManager.createSession(
          sessionId,
          threadId,
          resolvedCw,
          sessionOwnerId
        );
      }
    } catch (error) {
      await recorder.finalizeError({
        errorCode: "session_persist_failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      });
      throw error;
    }
  }

  await recorder.finalizeSuccess({
    artifacts: artifacts.length > 0 ? artifacts : [],
    resultText,
    structuredOutput: null,
    structuredOutputStatus: "skipped",
  });

  const turnDurationMs = turnStartTime ? Date.now() - turnStartTime : undefined;

  const metadata = {
    agentName: "codex" as const,
    autonomyLevel: input.auto,
    modelUsed: input.model,
    resumedFromThread: Boolean(resumeThreadId),
    sessionId,
    threadId,
    tokenUsage,
    turnDurationMs,
    workingDirectory: resolvedCw,
  };

  const sessionState = sessionId
    ? {
        canResume: Boolean(threadId),
        isResumed: Boolean(resumeThreadId),
        resumeReason: threadId ? undefined : "no_thread_id",
        sessionId,
        threadId: threadId ?? "",
      }
    : undefined;

  void persistArtifact({
    category: "codex",
    content: JSON.stringify(
      {
        sessionId,
        threadId,
        auto: input.auto,
        projectId,
        result: resultText,
        artifacts,
        metadata,
        sessionState,
      },
      null,
      2
    ),
    format: "json",
    repoRoot: resolvedCw,
    tool: "codex",
  }).catch((error) => logger.debug("codex_persist_artifact_error", { error }));

  return {
    artifacts: artifacts.length > 0 ? artifacts : undefined,
    metadata,
    reasoning:
      reasoningAccumulator.traces.length > 0
        ? reasoningAccumulator.traces
        : undefined,
    result: resultText,
    sessionState,
  };
}

export const __internals = {
  createFilesystemThreadValidatorForTests: (codexHome: string) =>
    createFilesystemThreadValidator(codexHome),
  resolveThreadValidator,
};
