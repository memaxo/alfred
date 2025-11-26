import { randomUUID } from "node:crypto";

import {
  runRegistry,
  type ResumePayload,
} from "@alfred/agent/workflow/registry";
import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import { recordAudit } from "@alfred/agent/utils/audit";
import { logger } from "@alfred/logger";
import * as workflowRepo from "@alfred/db/repo/workflow";
import type {
  Obligation,
  ObligationResumeEvent,
} from "@alfred/type";
import { resolveObligationResumeEvents } from "@alfred/type";
import {
  workflowObligationDurationSeconds,
  workflowObligationSuspensionsTotal,
} from "../metrics";

const DEFAULT_TIMEOUT_MS = Number(
  process.env.WORKFLOW_OBLIGATION_TIMEOUT_MS ?? 10 * 60 * 1000
);

type SuspensionEventEmitter = (payload: {
  runId: string;
  obligations: Obligation[];
  resumeEvents: ResumePayload["event"][];
}) => void | Promise<void>;

type SuspensionOptions = {
  sessionUserId: string;
  workflowId?: string;
  input: WorkflowInputPayload;
  auditContext?: Record<string, unknown>;
  transport: string;
  timeoutMs?: number;
  emitObligation: SuspensionEventEmitter;
  policyCheck: () => Promise<Obligation[]>;
  startWorkflow: (options: {
    runId: string;
    obligations: Obligation[];
  }) => Promise<void>;
  onError: (error: unknown, info: { runId: string }) => void;
  resolveResumeEvents?: (
    obligations: Obligation[]
  ) => ResumePayload["event"][];
  onSuspended?: (runId: string, obligations: Obligation[]) => void | Promise<void>;
  onResumed?: (runId: string) => void | Promise<void>;
  onCancelled?: (runId: string) => void | Promise<void>;
};

type SuspensionState = {
  runId: string;
  abortController: AbortController;
  status: "suspended" | "resuming" | "completed";
  startedAt: number;
  primary: Obligation | null;
  resumeEvents: ResumePayload["event"][];
  timeoutHandle: ReturnType<typeof setTimeout> | null;
};

type SuspensionResult = "resumed" | "cancelled" | "timeout" | "error";

function computeResumeEvents(
  obligations: Obligation[],
  resolver?: (obligations: Obligation[]) => ResumePayload["event"][]
): ResumePayload["event"][] {
  if (resolver) {
    const resolved = resolver(obligations).filter(Boolean);
    if (resolved.length > 0) {
      return Array.from(new Set(resolved));
    }
  }
  const defaults = resolveObligationResumeEvents(obligations) as ResumePayload["event"][];
  return defaults.length > 0 ? defaults : ["human-authz"];
}

function recordSuspensionStart(
  transport: string,
  obligations: Obligation[]
) {
  for (const obligation of obligations) {
    workflowObligationSuspensionsTotal
      .labels(transport, "suspended", obligation.type ?? "unknown")
      .inc();
  }
}

function recordSuspensionOutcome(
  transport: string,
  result: SuspensionResult,
  startedAt: number,
  obligationType: string
) {
  const durationSeconds = Math.max(Date.now() - startedAt, 0) / 1000;
  workflowObligationDurationSeconds.labels(transport, result).observe(durationSeconds);
  workflowObligationSuspensionsTotal.labels(transport, result, obligationType).inc();
}

async function appendObligationEvent(runId: string, obligations: Obligation[]) {
  await workflowRepo.appendEvent({
    runId,
    eventType: "suspend",
    eventData: {
      reason: "policy_obligation",
      obligations,
    },
  });
}

async function updateCancelled(runId: string) {
  await workflowRepo.updateRun(runId, {
    status: "cancelled",
    completedAt: new Date(),
  });
}

async function updateResumed(runId: string) {
  await workflowRepo.updateRun(runId, {
    status: "running",
    suspendedAt: null,
    resumedAt: new Date(),
  });
}

export function createWorkflowSuspension(options: SuspensionOptions) {
  let current: SuspensionState | null = null;

  const workflowId = options.workflowId ?? "plan";
  const auditContext = options.auditContext ?? {};
  const timeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const clearTimer = (state: SuspensionState | null) => {
    if (state?.timeoutHandle) {
      clearTimeout(state.timeoutHandle);
      state.timeoutHandle = null;
    }
  };

  async function dispose() {
    const state = current;
    current = null;
    if (!state || state.status !== "suspended") {
      return;
    }
    clearTimer(state);
    await cancelSuspension(state, { fromDispose: true, result: "cancelled" });
  }

  async function cancelSuspension(
    state: SuspensionState,
    {
      fromDispose,
      result,
    }: { fromDispose: boolean; result: "cancelled" | "timeout" }
  ) {
    if (state.status !== "suspended") {
      return;
    }
    state.status = "completed";
    current = null;
    try {
      await runRegistry.unregister(state.runId);
    } catch (error) {
      logger.warn("workflow_suspension_unregister_failed", {
        runId: state.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    state.abortController.abort();

    await updateCancelled(state.runId);
    recordSuspensionOutcome(
      options.transport,
      result,
      state.startedAt,
      state.primary?.type ?? "unknown"
    );
    await options.onCancelled?.(state.runId);
  }

  async function suspend(initialObligations: Obligation[]) {
    if (initialObligations.length === 0) {
      return;
    }

    await dispose();

    const runId = randomUUID();

    const storedInput = {
      ...(options.input as Record<string, unknown>),
      executionId: runId,
      reasoningSince: Date.now(),
    };

    await workflowRepo.createRun({
      id: runId,
      userId: options.sessionUserId,
      workflowId,
      status: "suspended",
      inputData: storedInput,
    });
    await workflowRepo.updateRun(runId, { suspendedAt: new Date() });
    await appendObligationEvent(runId, initialObligations);

    await recordAudit({
      userId: options.sessionUserId,
      action: "workflow.stream.suspend",
      resource: { kind: "workflow", id: runId },
      decision: "allow",
      context: { ...auditContext, obligations: initialObligations },
    });

    await options.onSuspended?.(runId, initialObligations);

    const abortController = new AbortController();
    const resumeEvents = computeResumeEvents(
      initialObligations,
      options.resolveResumeEvents
    );
    current = {
      runId,
      abortController,
      status: "suspended",
      startedAt: Date.now(),
      primary: initialObligations[0] ?? null,
      resumeEvents,
      timeoutHandle: null,
    };

    recordSuspensionStart(options.transport, initialObligations);

    await options.emitObligation({
      runId,
      obligations: initialObligations,
      resumeEvents,
    });

    if (timeoutMs > 0) {
      current.timeoutHandle = setTimeout(() => {
        const state = current;
        if (!state || state.runId !== runId) {
          return;
        }
        clearTimer(state);
        void cancelSuspension(state, {
          fromDispose: false,
          result: "timeout",
        });
      }, timeoutMs);
    }

    await runRegistry.register(runId, {
      resume: async ({ resumeData }) => {
        if (!current || current.runId !== runId) {
          return;
        }
        if (!current.resumeEvents.includes(resumeData.event)) {
          options.onError(
            new Error("unsupported_resume_event"),
            { runId }
          );
          return;
        }
        try {
          const refreshed = await options.policyCheck();
          if (refreshed.length > 0) {
            await appendObligationEvent(runId, refreshed);
            const refreshedEvents = computeResumeEvents(
              refreshed,
              options.resolveResumeEvents
            );
            current.resumeEvents = refreshedEvents;
            current.primary = refreshed[0] ?? null;
            await options.emitObligation({
              runId,
              obligations: refreshed,
              resumeEvents: refreshedEvents,
            });
            return;
          }

          try {
            await runRegistry.unregister(runId);
          } catch (error) {
            logger.warn("workflow_suspension_unregister_failed", {
              runId,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          const state = current;
          current = null;
          if (state) {
            clearTimer(state);
            recordSuspensionOutcome(
              options.transport,
              "resumed",
              state.startedAt,
              state.primary?.type ?? "unknown"
            );
          }
          await updateResumed(runId);
          await recordAudit({
            userId: options.sessionUserId,
            action: "workflow.stream.resume",
            resource: { kind: "workflow", id: runId },
            decision: "allow",
            context: { event: resumeData.event },
          });
          await options.onResumed?.(runId);
          await options.startWorkflow({ runId, obligations: [] });
        } catch (error) {
          const state = current;
          if (state) {
            recordSuspensionOutcome(
              options.transport,
              "error",
              state.startedAt,
              state.primary?.type ?? "unknown"
            );
          }
          options.onError(error, { runId });
        }
      },
      cancel: async () => {
        const state = current;
        if (!state || state.runId !== runId) {
          return;
        }
        clearTimer(state);
        await cancelSuspension(state, {
          fromDispose: false,
          result: "cancelled",
        });
      },
      abortController,
    });
  }

  return {
    suspend,
    dispose,
  };
}
