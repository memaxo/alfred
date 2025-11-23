import { Buffer } from "node:buffer";
import {
  clearTimeout as clearNodeTimeout,
  setTimeout as setNodeTimeout,
} from "node:timers";
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
import {
  persistCodexExecution,
  persistReasoning,
} from "../../../../assistant/src/graphstore.js";
import {
  recordCodexError,
  recordCodexExecRun,
  startCodexExecTimer,
} from "../../../metrics.js";
import { sessionManager } from "../../codex-session.js";
import {
  type AlfredCodexEvent,
  type CodexArtifactSummary,
  type CodexErrorStage,
  type CodexExecuteArgs,
  type CodexToolInput,
  DEFAULT_TIMEOUT_SEC,
  OUTPUT_CAP_BYTES,
  type SandboxConfig,
  type ToolWriter,
} from "./definition.js";
import {
  assertAllowedDirectory,
  mapAutoToCodex,
  pickEnvCodex,
  resolveExecutable,
} from "./policy.js";

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

export async function executeWithSdk({ input, writer }: CodexExecuteArgs) {
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
