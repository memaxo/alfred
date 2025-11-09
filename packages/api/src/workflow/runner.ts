import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import type { WorkflowEvent } from "@alfred/type";

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
    yield createNoticeEvent(`Planning started for ${input.requirement}`);
    yield createProgressEvent(5, "initializing");

    // Simulate context preparation if enabled
    if (input.context?.enable !== false) {
      if (cancelled) return;
      if (Date.now() - workflowStartTime > workflowTimeoutMs) {
        yield createErrorEvent("workflow_timeout");
        return;
      }

      const stepStart = Date.now();
      yield createProgressEvent(10, "analyzing requirement");
      await delay(50);
      if (cancelled) return;
      if (Date.now() - stepStart > stepTimeoutMs) {
        yield createErrorEvent("step_timeout");
        return;
      }
      if (Date.now() - workflowStartTime > workflowTimeoutMs) {
        yield createErrorEvent("workflow_timeout");
        return;
      }
      yield createContextEvent(
        "scan",
        "Scanning repository and web context (placeholder)"
      );
      yield createProgressEvent(45, "context prepared");
    }

    // If medium/high autonomy, request elevated scopes
    if (input.auto === "medium" || input.auto === "high") {
      if (Date.now() - workflowStartTime > workflowTimeoutMs) {
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
    yield createProgressEvent(80, "validating plan");
    await delay(50);
    if (cancelled) return;
    if (Date.now() - workflowStartTime > workflowTimeoutMs) {
      yield createErrorEvent("workflow_timeout");
      return;
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
