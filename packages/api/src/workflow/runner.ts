import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import type { WorkflowEvent } from "@alfred/type";
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
  context?: {
    enable?: boolean;
    web?: boolean;
    topK?: number;
    maxTokens?: number;
    exts?: string[];
    ignore?: string[];
    seeds?: string[];
  };
  linear?: {
    sessionId: string;
    space: string;
    authz: string;
  };
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

  let cancelled = false;
  let resumeResolver: ((payload: ResumePayload | null) => void) | null = null;
  const resumeQueue: ResumePayload[] = [];

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
    yield createRunEvent(runId);

    // Emit Linear thought activity (acknowledgment < 10s)
    if (input.linear) {
      const thoughtActivityPromise = emitLinearActivity("thought", {
        sessionId: input.linear.sessionId,
        space: input.linear.space,
        authz: input.linear.authz,
        body: `Starting workflow: ${input.requirement}`,
      }).catch((error) => {
        logger.warn("linear_thought_activity_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
        return { ok: false };
      });

      // Ensure acknowledgment within 10 seconds (fire-and-forget after timeout)
      Promise.race([
        thoughtActivityPromise,
        delay(9000).then(() => {
          logger.warn("linear_thought_activity_timeout", { runId });
          return { ok: false };
        }),
      ]).catch(() => {
        // Ignore errors, already logged
      });
    }

    yield createNoticeEvent(`Planning started for ${input.requirement}`);
    yield createProgressEvent(5, "initializing");

    // Phase: scan
    const scanPhase: PhaseConfig = { name: "scan", timeoutMs: stepTimeoutMs };
    if (input.context?.enable !== false) {
      yield* executePhaseWithTimeout(scanPhase.name, scanPhase.timeoutMs, async function* () {
        if (cancelled) return;
        yield createProgressEvent(10, "analyzing requirement");
        await delay(50);
        if (cancelled) return;
        yield createContextEvent("scan", "Scanning repository and web context (placeholder)");
        yield createProgressEvent(30, "scan_complete");
      }, input.linear);
    } else {
      yield { type: "step-skip", phase: scanPhase.name } as any;
    }

    // If medium/high autonomy, request elevated scopes
    if (input.auto === "medium" || input.auto === "high") {
      if (Date.now() - workflowStartTime > workflowTimeoutMs) {
        if (input.linear) {
          emitLinearActivity("error", {
            sessionId: input.linear.sessionId,
            space: input.linear.space,
            authz: input.linear.authz,
            body: "Workflow timed out",
          }).catch((error) => {
            logger.warn("linear_error_activity_failed", {
              runId,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
        yield createErrorEvent("workflow_timeout");
        return;
      }
      yield createRequireScopeEvent(["repo.write", "droid.exec"], "bio-authz");

      // Wait for resume with independent timeout (10s) but respect workflow timeout
      const resumeDeadline = Date.now() + RESUME_TIMEOUT_MS;
      const workflowDeadline = workflowStartTime + workflowTimeoutMs;
      const deadline = Math.min(resumeDeadline, workflowDeadline);
      const timeoutMs = Math.max(0, deadline - Date.now());

      if (cancelled) return;

      // Check if resume was already called (before we reached this point)
      if (resumeQueue.length > 0) {
        const resume = resumeQueue.shift()!;
        yield createNoticeEvent(
          `Authorization '${resume.event}' acknowledged.`
        );
      } else if (timeoutMs > 0) {
        // Wait for resume with Promise-based mechanism
        const resumePromise = new Promise<ResumePayload | null>((resolve) => {
          resumeResolver = resolve;
        });

        const resume = await Promise.race([
          resumePromise,
          delay(timeoutMs).then(() => null),
        ]);

        resumeResolver = null;

        if (cancelled) return;
        if (resume) {
          yield createNoticeEvent(
            `Authorization '${resume.event}' acknowledged.`
          );
        }
      }
    }

    if (cancelled) return;
    if (Date.now() - workflowStartTime > workflowTimeoutMs) {
      yield createErrorEvent("workflow_timeout");
      return;
    }
    // Phase: plan
    const planPhase: PhaseConfig = { name: "plan", timeoutMs: stepTimeoutMs };
    yield* executePhaseWithTimeout(planPhase.name, planPhase.timeoutMs, async function* () {
      // Emit an assistant message with a draft plan (for UI replay normalization)
      yield { type: "assistant", text: `Draft plan for: ${input.requirement}` } as any;
      yield createProgressEvent(60, "plan_drafted");
    }, input.linear);

    if (cancelled) return;
    // Phase: act
    const actPhase: PhaseConfig = { name: "act", timeoutMs: stepTimeoutMs };
    yield* executePhaseWithTimeout(actPhase.name, actPhase.timeoutMs, async function* () {
      // Simulate one tool call and result; IDs allow UI correlation
      const tcId = randomUUID();
      yield { type: "tool-call", id: tcId, toolName: "echo", args: { text: "hello" } } as any;
      
      // TODO: When tool execution integrated, emit action activities here
      // Example:
      // if (input.linear) {
      //   await emitLinearActivity("action", {
      //     sessionId: input.linear.sessionId,
      //     space: input.linear.space,
      //     authz: input.linear.authz,
      //     title: `Execute ${toolCall.name}`,
      //     parameter: JSON.stringify(toolCall.input),
      //     result: JSON.stringify(toolCall.output),
      //     ephemeral: true, // Use ephemeral for intermediate tool calls
      //   }).catch((error) => {
      //     logger.warn("linear_action_activity_failed", { runId, error });
      //   });
      // }
      
      await delay(20);
      yield { type: "tool-result", id: tcId, toolName: "echo", result: { text: "hello" } } as any;
      yield createProgressEvent(85, "act_complete");
    }, input.linear);

    if (cancelled) return;
    // Phase: report
    const reportPhase: PhaseConfig = { name: "report", timeoutMs: stepTimeoutMs };
    yield* executePhaseWithTimeout(reportPhase.name, reportPhase.timeoutMs, async function* () {
      yield { type: "assistant", text: "Report complete." } as any;
      yield createProgressEvent(95, "report_complete");
    }, input.linear);

    if (cancelled) return;
    if (Date.now() - workflowStartTime > workflowTimeoutMs) {
      if (input.linear) {
        emitLinearActivity("error", {
          sessionId: input.linear.sessionId,
          space: input.linear.space,
          authz: input.linear.authz,
          body: "Workflow timed out",
        }).catch((error) => {
          logger.warn("linear_error_activity_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
      yield createErrorEvent("workflow_timeout");
      return;
    }

    // Emit Linear response activity on completion
    if (input.linear) {
      try {
        await emitLinearActivity("response", {
          sessionId: input.linear.sessionId,
          space: input.linear.space,
          authz: input.linear.authz,
          body: "Workflow completed successfully",
        });
      } catch (error) {
        logger.warn("linear_response_activity_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    yield createProgressEvent(100, "workflow_completed");
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
      if (resumeResolver) {
        resumeResolver(null);
      }
    },
  };
}
