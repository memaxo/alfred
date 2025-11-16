import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import {
  emitLinearActivity,
  extractIssueIdFromSession,
  setLinearDelegate,
  setLinearSessionExternalUrl,
  setLinearStarted,
} from "@alfred/agent/orchestrator/linear";
import type { WorkflowEvent } from "@alfred/type";
import { logger } from "@alfred/metrics";
// Lazy metrics loader to avoid heavy deps during unit tests
type RunnerCounters = {
  runnerStepsTotal: { inc: (labels: { phase: string; outcome: string }) => void };
  runnerErrorsTotal: { inc: (labels: { phase: string; reason: string }) => void };
};
let metricsRef: RunnerCounters | null = null;
async function metrics(): Promise<RunnerCounters> {
  if (metricsRef) return metricsRef;
  try {
    const m = await import("@alfred/api/metrics");
    metricsRef = {
      runnerStepsTotal: m.runnerStepsTotal,
      runnerErrorsTotal: m.runnerErrorsTotal,
    };
  } catch {
    metricsRef = {
      runnerStepsTotal: { inc: () => {} },
      runnerErrorsTotal: { inc: () => {} },
    };
  }
  return metricsRef;
}

export type RunPlanInput = {
  requirement: string;
  auto: "read" | "low" | "medium" | "high";
  workspace?: string;
  repoBase?: string;
  mode?: "sequential" | "parallel";
  linear?: {
    sessionId: string;
    space: string;
    authz: string;
  };
  context?: {
    enable?: boolean;
    web?: boolean;
    topK?: number;
    maxTokens?: number;
    exts?: string[];
    ignore?: string[];
    seeds?: string[];
  };
};

const lastActivityTime = new Map<string, number>();

const stringify = (value: unknown): string | undefined => {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
};

export type ResumePayload = {
  event: "deploy-authz" | "linear-authz" | "bio-authz";
  authz: string;
};

export type RunPlanV6 = {
  runId: string;
  summary: string;
  stream: AsyncGenerator<WorkflowEvent, void, void>;
  resume(payload: ResumePayload): Promise<void>;
  cancel(): void;
};

const DEFAULT_STEP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_WORKFLOW_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const RESUME_TIMEOUT_MS = 10_000; // 10 seconds for resume

function createRunEvent(runId: string): WorkflowEvent {
  return { type: "run", id: runId } as WorkflowEvent;
}

function createErrorEvent(message: string): WorkflowEvent {
  return { type: "error", message } as WorkflowEvent;
}

function createNoticeEvent(message: string): WorkflowEvent {
  return { type: "notice", message } as WorkflowEvent;
}

function createProgressEvent(pct: number, message: string): WorkflowEvent {
  return { type: "progress", pct, message } as WorkflowEvent;
}

function createContextEvent(phase: string, message: string): WorkflowEvent {
  return { type: "context", phase, message } as WorkflowEvent;
}

function createRequireScopeEvent(
  scopes: string[],
  event: string
): WorkflowEvent {
  return { type: "require-scope", scopes, event } as WorkflowEvent;
}

type WorkflowPhase = "scan" | "plan" | "act" | "report";

type PhaseConfig = {
  name: WorkflowPhase;
  timeoutMs: number;
};

async function* executePhaseWithTimeout(
  phase: WorkflowPhase,
  timeoutMs: number,
  generator: () => AsyncGenerator<WorkflowEvent, void, void>
): AsyncGenerator<WorkflowEvent, void, void> {
  const start = Date.now();
  (await metrics()).runnerStepsTotal.inc({ phase, outcome: "start" });
  yield { type: "step-start", phase } as any;

  try {
    for await (const evt of generator()) {
      if (Date.now() - start > timeoutMs) {
        (await metrics()).runnerStepsTotal.inc({ phase, outcome: "timeout" });
        (await metrics()).runnerErrorsTotal.inc({ phase, reason: "timeout" });
        yield createErrorEvent("step_timeout");
        return;
      }
      yield evt;
    }
    (await metrics()).runnerStepsTotal.inc({ phase, outcome: "complete" });
    yield { type: "step-complete", phase } as any;
  } catch (error) {
    (await metrics()).runnerStepsTotal.inc({ phase, outcome: "error" });
    (await metrics()).runnerErrorsTotal.inc({ phase, reason: error instanceof Error ? error.name : "error" });
    yield createErrorEvent(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * @deprecated Use WorkflowRuntime from @alfred/runtime instead.
 * This runner will be removed in v2.0.0 after runtime integration is complete.
 * 
 * Migration guide:
 * ```typescript
 * // OLD:
 * import { runPlanV6 } from '../workflow/runner';
 * const runner = runPlanV6(input, { signal: abortController.signal });
 * 
 * // NEW:
 * import { createRuntime } from '@alfred/runtime';
 * import { openai } from '@ai-sdk/openai';
 * const runtime = createRuntime({
 *   input,
 *   model: openai('gpt-4o'),
 *   signal: abortController.signal,
 * });
 * 
 * // Stream consumption is identical:
 * for await (const event of runtime.stream) {
 *   // ... same handling logic
 * }
 * ```
 * 
 * Minimal, Mastra-free runner that emits WorkflowEvent chunks.
 *
 * This runner is intentionally simple: it models a planning phase with
 * context preparation and accepts resume events for authz acknowledgments.
 * The router owns persistence and run-registry wiring.
 */
export function runPlanV6(
  input: RunPlanInput,
  opts?: {
    signal?: AbortSignal;
    stepTimeoutMs?: number;
    workflowTimeoutMs?: number;
  }
): RunPlanV6 {
  const runId = randomUUID();
  const summary = `Plan initialized for ${input.requirement}`;
  const linear = input.linear ?? null;
  const issueId = linear ? extractIssueIdFromSession(linear.sessionId) : null;
  const externalUrlBase =
    process.env.PUBLIC_URL ??
    process.env.VITE_APP_URL ??
    process.env.APP_URL ??
    null;

  let cancelled = false;
  let resumeResolver: ((payload: ResumePayload | null) => void) | null = null;
  const resumeQueue: ResumePayload[] = [];
  let finalStatus: "completed" | "failed" | "cancelled" | null = null;
  let finalMessage: string | null = null;
  let reportSummary: string | null = null;

  const stepTimeoutMs = opts?.stepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
  const workflowTimeoutMs =
    opts?.workflowTimeoutMs ?? DEFAULT_WORKFLOW_TIMEOUT_MS;
  const workflowStartTime = Date.now();

  const signal = opts?.signal;
  if (signal) {
    if (signal.aborted) cancelled = true;
    signal.addEventListener("abort", () => {
      cancelled = true;
    });
  }

  async function* generator(): AsyncGenerator<WorkflowEvent, void, void> {
    const markCancelled = () => {
      finalStatus = "cancelled";
      finalMessage = null;
    };

    const checkCancelled = () => {
      if (cancelled) {
        markCancelled();
        return true;
      }
      return false;
    };

    try {
      finalStatus = null;
      finalMessage = null;
      reportSummary = null;

      yield createRunEvent(runId);

      if (linear) {
        const thoughtActivityPromise = emitLinearActivity("thought", {
          sessionId: linear.sessionId,
          space: linear.space,
          authz: linear.authz,
          body: `Starting workflow: ${input.requirement}`,
        }).catch((error) => {
          logger.warn("linear_thought_activity_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
          return { ok: false };
        });

        await Promise.race([
          thoughtActivityPromise,
          delay(9000).then(() => {
            logger.warn("linear_thought_activity_timeout", { runId });
            return { ok: false };
          }),
        ]);
      }

      if (linear && issueId) {
        setLinearDelegate({
          space: linear.space,
          issueId,
          authz: linear.authz,
        }).catch((error) => {
          logger.warn("linear_delegate_setup_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

        setLinearStarted({
          space: linear.space,
          issueId,
          authz: linear.authz,
        }).catch((error) => {
          logger.warn("linear_started_setup_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

        if (externalUrlBase) {
          const normalizedBase = externalUrlBase.endsWith("/")
            ? externalUrlBase.slice(0, -1)
            : externalUrlBase;
          const workflowUrl = `${normalizedBase}/workflow/${runId}`;
          setLinearSessionExternalUrl(
            linear.sessionId,
            linear.space,
            linear.authz,
            workflowUrl
          ).catch((error) => {
            logger.warn("linear_external_url_setup_failed", {
              runId,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        } else {
          logger.warn("linear_external_url_setup_missing_base", { runId });
        }
      }

      if (checkCancelled()) {
        return;
      }

      yield createNoticeEvent(`Planning started for ${input.requirement}`);
      yield createProgressEvent(5, "initializing");

      const scanPhase: PhaseConfig = { name: "scan", timeoutMs: stepTimeoutMs };
      if (input.context?.enable !== false) {
        yield* executePhaseWithTimeout(
          scanPhase.name,
          scanPhase.timeoutMs,
          async function* () {
            if (cancelled) {
              markCancelled();
              return;
            }
            yield createProgressEvent(10, "analyzing requirement");
            await delay(50);
            if (cancelled) {
              markCancelled();
              return;
            }
            yield createContextEvent(
              "scan",
              "Scanning repository and web context (placeholder)"
            );
            yield createProgressEvent(30, "scan_complete");
          }
        );
      } else {
        yield { type: "step-skip", phase: scanPhase.name } as any;
      }

      if (input.auto === "medium" || input.auto === "high") {
        if (Date.now() - workflowStartTime > workflowTimeoutMs) {
          finalStatus = "failed";
          finalMessage = "workflow_timeout";
          yield createErrorEvent("workflow_timeout");
          return;
        }
        yield createRequireScopeEvent(
          ["repo.write", "droid.exec"],
          "bio-authz"
        );

        const resumeDeadline = Date.now() + RESUME_TIMEOUT_MS;
        const workflowDeadline = workflowStartTime + workflowTimeoutMs;
        const deadline = Math.min(resumeDeadline, workflowDeadline);
        const timeoutMs = Math.max(0, deadline - Date.now());

        if (checkCancelled()) {
          return;
        }

        if (resumeQueue.length > 0) {
          const resume = resumeQueue.shift()!;
          yield createNoticeEvent(
            `Authorization '${resume.event}' acknowledged.`
          );
        } else if (timeoutMs > 0) {
          const resumePromise = new Promise<ResumePayload | null>((resolve) => {
            resumeResolver = resolve;
          });

          const resume = await Promise.race([
            resumePromise,
            delay(timeoutMs).then(() => null),
          ]);

          resumeResolver = null;

          if (checkCancelled()) {
            return;
          }
          if (resume) {
            yield createNoticeEvent(
              `Authorization '${resume.event}' acknowledged.`
            );
          }
        }
      }

      if (checkCancelled()) {
        return;
      }
      if (Date.now() - workflowStartTime > workflowTimeoutMs) {
        finalStatus = "failed";
        finalMessage = "workflow_timeout";
        yield createErrorEvent("workflow_timeout");
        return;
      }

      const planPhase: PhaseConfig = {
        name: "plan",
        timeoutMs: stepTimeoutMs,
      };
      yield* executePhaseWithTimeout(
        planPhase.name,
        planPhase.timeoutMs,
        async function* () {
          yield {
            type: "assistant",
            text: `Draft plan for: ${input.requirement}`,
          } as any;
          yield createProgressEvent(60, "plan_drafted");
        }
      );

      if (checkCancelled()) {
        return;
      }

      const actPhase: PhaseConfig = { name: "act", timeoutMs: stepTimeoutMs };
      yield* executePhaseWithTimeout(
        actPhase.name,
        actPhase.timeoutMs,
        async function* () {
          const tcId = randomUUID();
          const toolName = "echo";
          const args = { text: "hello" };
          yield {
            type: "tool-call",
            id: tcId,
            toolName,
            args,
          } as any;

          await delay(20);
          const result = { text: "hello" };
          yield {
            type: "tool-result",
            id: tcId,
            toolName,
            result,
          } as any;

          if (linear) {
            const now = Date.now();
            const last = lastActivityTime.get(runId) ?? 0;
            if (now - last > 30_000) {
              lastActivityTime.set(runId, now);
              emitLinearActivity("action", {
                sessionId: linear.sessionId,
                space: linear.space,
                authz: linear.authz,
                title: `Executed tool: ${toolName}`,
                body: "Tool execution completed",
                parameter: stringify(args),
                result: stringify(result),
                ephemeral: true,
              }).catch((error) => {
                logger.warn("linear_action_activity_failed", {
                  runId,
                  toolName,
                  error: error instanceof Error ? error.message : String(error),
                });
              });
            }
          }

          yield createProgressEvent(85, "act_complete");
        }
      );

      if (checkCancelled()) {
        return;
      }

      const reportPhase: PhaseConfig = {
        name: "report",
        timeoutMs: stepTimeoutMs,
      };
      yield* executePhaseWithTimeout(
        reportPhase.name,
        reportPhase.timeoutMs,
        async function* () {
          const reportText = "Report complete.";
          yield { type: "assistant", text: reportText } as any;
          reportSummary = reportText;
          yield createProgressEvent(95, "report_complete");
        }
      );

      if (checkCancelled()) {
        return;
      }
      if (Date.now() - workflowStartTime > workflowTimeoutMs) {
        finalStatus = "failed";
        finalMessage = "workflow_timeout";
        yield createErrorEvent("workflow_timeout");
        return;
      }

      finalStatus = "completed";
      let completionMessage: string | null = null;
      if (typeof reportSummary === "string") {
        const summaryText: string = reportSummary;
        const trimmed = summaryText.trim();
        if (trimmed.length > 0) {
          completionMessage = trimmed;
        }
      }
      finalMessage =
        completionMessage ?? "Workflow completed successfully.";
      yield createProgressEvent(100, "workflow_completed");
    } catch (error) {
      finalStatus = "failed";
      finalMessage =
        error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      if (linear) {
        if (finalStatus === "completed") {
          const completionResult =
            typeof finalMessage === "string" ? finalMessage : "";
          const body =
            completionResult.trim().length > 0
              ? `Workflow completed successfully. Results: ${completionResult}`
              : "Workflow completed successfully.";
          emitLinearActivity("response", {
            sessionId: linear.sessionId,
            space: linear.space,
            authz: linear.authz,
            body,
          }).catch((error) => {
            logger.warn("linear_response_activity_failed", {
              runId,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        } else if (finalStatus === "failed") {
          const failureMessage =
            typeof finalMessage === "string" ? finalMessage : "";
          const body =
            failureMessage.trim().length > 0
              ? `Workflow failed: ${failureMessage}`
              : "Workflow failed.";
          emitLinearActivity("error", {
            sessionId: linear.sessionId,
            space: linear.space,
            authz: linear.authz,
            body,
          }).catch((error) => {
            logger.warn("linear_error_activity_failed", {
              runId,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
        lastActivityTime.delete(runId);
      }
    }
  }

  return {
    runId,
    summary,
    stream: generator(),
    async resume(payload: ResumePayload) {
      if (resumeResolver) {
        resumeResolver(payload);
      } else {
        resumeQueue.push(payload);
      }
    },
    cancel() {
      cancelled = true;
      if (finalStatus === null) {
        finalStatus = "cancelled";
        finalMessage = null;
      }
      if (resumeResolver) {
        resumeResolver(null);
      }
    },
  };
}
