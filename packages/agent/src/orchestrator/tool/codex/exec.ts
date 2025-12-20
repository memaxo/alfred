import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  clearTimeout as clearNodeTimeout,
  setTimeout as setNodeTimeout,
} from "node:timers";
import { logger } from "@alfred/logger";
import { runStreamed } from "@alfred/codex";
import type { SpawnFn, ThreadItem } from "@alfred/codex";
import {
  persistCodexExecution,
} from "../../../../assistant/src/graphstore.js";
import {
  recordCodexWriterError,
  startCodexSessionValidationTimer,
} from "../../../metrics.js";
import type { CodexSessionState } from "../../codex-session.js";
import { spawnWithSecureCwd } from "../../../security/secure-spawn.js";
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
import { buildPoofArgs, getPoofBinary, POOF_PROFILES } from "../../../spawn/poof.js";
import {
  type AlfredCodexEvent,
  type CodexArtifactSummary,
  type CodexExecuteArgs,
  type CodexToolInput,
  DEFAULT_TIMEOUT_SEC,
  validateOutputSchema,
} from "./definition.js";
import { CodexRunRecorder } from "./record.js";
import {
  assertAllowedDirectory,
  mapAutoToCodex,
  pickEnvCodex,
  resolveExecutable,
} from "./policy.js";

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

function isWithinDir(base: string, target: string): boolean {
  const rel = path.relative(base, target);
  return rel === "" || !(rel.startsWith("..") || path.isAbsolute(rel));
}

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

export type CodexTurnOptions = {
  signal: AbortSignal;
  outputSchema?: unknown;
};

export function buildTurnOptions(
  input: CodexToolInput,
  signal: AbortSignal
): CodexTurnOptions {
  const options: CodexTurnOptions = { signal };

  if (input.outputSchema) {
    if (!validateOutputSchema(input.outputSchema)) {
      throw new Error("invalid_output_schema");
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
    path.resolve(process.cwd(), "vendor", "codex", "target", "release", "codex"),
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

  throw new Error("codex_binary_not_found");
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

export async function executeWithCodex({
  input,
  writer,
  signal,
}: CodexExecuteArgs) {
  const cwdHandle = assertAllowedDirectory(input.cw ?? process.cwd());
  try {
    return await runCodexWithCodex({ input, writer, signal, cwdHandle });
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
    throw new Error("codex_session_user_required");
  }

  const recorder = await CodexRunRecorder.start({
    userId: sessionOwnerId,
    sessionId,
    threadId: undefined,
    auto: input.auto,
    model: input.model,
    profile: input.profile,
    environmentKind: input.poofUpperDir
      ? "poof"
      : input.containerId
        ? "container"
        : "host",
    workingDirectory: resolvedCw,
    workspaceRoot: process.env.ORCH_WORKSPACE_ROOT,
    dockerContainerId: input.containerId,
    dockerImage: process.env.ORCH_DOCKER_IMAGE,
    poofUpperDir: input.poofUpperDir,
    poofProfile: input.poofProfile,
    outputSchema:
      input.outputSchema && validateOutputSchema(input.outputSchema)
        ? input.outputSchema
        : null,
  });
  recorder.recordWriterChunk({ type: "notice", message: "codex_run_started" });

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
      } catch {
        // ignore
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

  const codexBin = resolveCodexBin();
  const threadValidator = resolveThreadValidator();
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
        type: "notice",
        message: "codex_session_thread_reset",
        reason: resumeReason,
      },
      "codex_session_thread_reset"
    );
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
    try {
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
    } catch (error) {
      logger.debug("codex_learning_context_skipped", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const dockerBin = input.containerId ? resolveExecutable("docker") : undefined;
    const poofUpperDir = input.poofUpperDir?.trim();
    const poofMode = input.poofMode ?? "run";
    const poofProfile =
      input.poofProfile && input.poofProfile in POOF_PROFILES
        ? POOF_PROFILES[input.poofProfile]
        : POOF_PROFILES.standard;

    const poofBin = poofUpperDir ? getPoofBinary() : undefined;
    const poofUpperResolved = poofUpperDir ? path.resolve(poofUpperDir) : undefined;
    if (poofUpperResolved) {
      const tmpBase = path.resolve(os.tmpdir());
      if (!isWithinDir(tmpBase, poofUpperResolved)) {
        throw new Error("poof_upper_dir_invalid");
      }
    }

    const spawn: SpawnFn = ({ cmd, args, env: childEnv }) => {
      if (dockerBin && input.containerId) {
        const containerCw = input.containerCw?.trim();
        if (containerCw && !containerCw.startsWith("/workspace")) {
          throw new Error("codex_container_cwd_invalid");
        }
        const dockerWorkdir = containerCw && containerCw.length > 0 ? containerCw : "/workspace";
        const envKeys = Object.keys(childEnv ?? {}).filter((k) => k !== "PATH");
        const dockerArgs = [
          "exec",
          "--workdir",
          dockerWorkdir,
          ...envKeys.flatMap((k) => ["-e", k]),
          input.containerId,
          "codex",
          ...args,
        ];
        const proc = spawnWithSecureCwd({
          cwdHandle,
          cmd: dockerBin,
          args: dockerArgs,
          env: childEnv,
          stdout: "pipe",
          stderr: "pipe",
          stdin: "ignore",
        });

        return {
          stdout: typeof proc.stdout === "number" ? null : (proc.stdout ?? null),
          stderr: typeof proc.stderr === "number" ? null : (proc.stderr ?? null),
          exited: proc.exited,
          kill: (signal) => {
            if (typeof signal === "number") {
              proc.kill(signal);
              return;
            }
            if (typeof signal === "string") {
              proc.kill(signal as NodeJS.Signals);
              return;
            }
            proc.kill();
          },
        };
      }

      if (poofBin && poofUpperResolved) {
        const poofArgs = [
          ...buildPoofArgs({
            mode: poofMode,
            upperDir: poofUpperResolved,
            profile: poofProfile,
          }),
          "--",
          cmd,
          ...args,
        ];
        const proc = spawnWithSecureCwd({
          cwdHandle,
          cmd: poofBin,
          args: poofArgs,
          env: childEnv,
          stdout: "pipe",
          stderr: "pipe",
          stdin: "ignore",
        });

        return {
          stdout: typeof proc.stdout === "number" ? null : (proc.stdout ?? null),
          stderr: typeof proc.stderr === "number" ? null : (proc.stderr ?? null),
          exited: proc.exited,
          kill: (signal) => {
            if (typeof signal === "number") {
              proc.kill(signal);
              return;
            }
            if (typeof signal === "string") {
              proc.kill(signal as NodeJS.Signals);
              return;
            }
            proc.kill();
          },
        };
      }

      const proc = spawnWithSecureCwd({
        cwdHandle,
        cmd,
        args,
        env: childEnv,
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      });

      return {
        stdout: typeof proc.stdout === "number" ? null : (proc.stdout ?? null),
        stderr: typeof proc.stderr === "number" ? null : (proc.stderr ?? null),
        exited: proc.exited,
        kill: (signal) => {
          if (typeof signal === "number") {
            proc.kill(signal);
            return;
          }
          if (typeof signal === "string") {
            proc.kill(signal as NodeJS.Signals);
            return;
          }
          proc.kill();
        },
      };
    };

    for await (const event of runStreamed({
      cmd: codexBin,
      prompt: enrichedPrompt,
      env,
      spawn,
      model: input.model,
      profile: input.profile,
      sandbox: sandbox.sandbox,
      approval: sandbox.approval,
      outputSchema: turnOptions.outputSchema as unknown as
        | boolean
        | Record<string, unknown>
        | undefined,
      resumeThreadId,
      signal: turnOptions.signal,
      onStderr: (text) =>
        safeWriter({ type: "stderr", text }, "codex_stderr_chunk"),
    })) {
      recorder.recordThreadEvent(event);
      switch (event.type) {
        case "thread.started": {
          const id = event.thread_id;
          if (typeof id === "string" && id.length > 0) {
            threadIdFromEvents = id;
            recorder.setThreadId(id);
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
            threadId: threadIdFromEvents,
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
            threadId: threadIdFromEvents,
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
      await recorder.finalizeError({
        exitCode: 1,
        errorCode: "timeout",
        errorMessage: "codex_exec_timeout",
      });
      throw new Error("codex_exec_timeout");
    }
    if (timeoutController.signal.aborted && abortedByExternalSignal) {
      await recorder.finalizeError({
        exitCode: null,
        errorCode: "aborted",
        errorMessage: "codex_exec_aborted",
      });
      throw new Error("codex_exec_aborted");
    }
    if (!(runtimeFailure || timeoutController.signal.aborted)) {
      recordStage("spawn");
    }
    await recorder.finalizeError({
      exitCode: 1,
      errorCode: "execution_failed",
      errorMessage: error instanceof Error ? error.message : String(error),
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
      exitCode: 1,
      errorCode: "timeout",
      errorMessage: "codex_exec_timeout",
    });
    throw new Error("codex_exec_timeout");
  }

  if (runtimeFailure) {
    await recorder.finalizeError({
      exitCode: 1,
      errorCode: "execution_failed",
      errorMessage: runtimeFailure.message,
    });
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
  const threadId = threadIdFromEvents;
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
    try {
      await sessionManager.createSession(sessionId, threadId, resolvedCw, sessionOwnerId);
    } catch (error) {
      await recorder.finalizeError({
        exitCode: 1,
        errorCode: "session_persist_failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  await recorder.finalizeSuccess({
    resultText,
    artifacts: artifacts.length > 0 ? artifacts : [],
    structuredOutput: null,
    structuredOutputStatus: "skipped",
  });

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
