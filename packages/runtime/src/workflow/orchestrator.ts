import { recordAudit } from "@alfred/agent/utils/audit";
import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import { ensureLinearTicket } from "@alfred/agent/workflow/linear";
import {
  workflowStreamDurationSeconds,
  workflowStreamEventsTotal,
} from "@alfred/agent/workflow/metrics";
import { ReviewGate } from "@alfred/agent/workflow/review-gate";
import {
  registerRunHandle,
  unregisterRunHandle,
} from "@alfred/agent/workflow/session-recovery";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type";
import { RuntimeContext } from "@alfred/type/runtime-context";
import type { UIMessage } from "@alfred/type/stream";
import {
  createRequirementMessage,
  createWorkflowExecutor,
  deriveWorkflowTitle,
  ensureWorkflowConversation,
  persistWorkflowMessages,
  shouldUseWorkflowRuntime,
} from "./executor";
import {
  bootstrapLinearSession,
  safeFinalizeLinearFailure,
  safeFinalizeLinearSuccess,
} from "./linear";
import { createLifecycle } from "./lifecycle";
import { type ReasonTrace, workflowProvenance } from "./provenance";
import { loadHistory } from "./history";
import { observeEvent } from "./observe";
import { persistStreamEvent } from "./persist";
import { startTimeout } from "./timeout";

function coerceRecord(val: unknown): Record<string, unknown> {
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

function getRuntimeContextFromCallbacks(
  candidate: unknown
): RuntimeContext<Record<string, unknown>> | undefined {
  const ctx = coerceRecord(candidate).runtimeContext;
  return ctx instanceof RuntimeContext
    ? (ctx as RuntimeContext<Record<string, unknown>>)
    : undefined;
}

export type OrchestratorCallbacks = {
  triggerPreferenceRefresh: (
    userId: string,
    payload: { reason: string }
  ) => void;
  ensureObligations?: (ctx: unknown) => void;
  context?: unknown;
  emitError: (error: unknown) => void;
  emitNext: (event: WorkflowEvent) => void;
  emitComplete: () => void;
  emitUiMessages?: (
    messages: UIMessage[],
    meta: {
      runId: string;
      eventId: string;
      eventType: string;
      originalEvent: WorkflowEvent;
    }
  ) => void;
};

export async function orchestrateWorkflowStream(
  input: WorkflowInputPayload,
  session: { user: { id: string } },
  callbacks: OrchestratorCallbacks
): Promise<() => void> {
  // Enforce obligations for medium/high autonomy workflows
  if (input.auto === "medium" || input.auto === "high") {
    try {
      callbacks.ensureObligations?.(callbacks.context);
    } catch (error) {
      callbacks.emitError(error);
      return () => {};
    }
  }

  // Linear integration lives in `./linear`.

  const abortController = new AbortController();
  let cancelled = false;
  let suspended = false;
  const GLOBAL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  let outerRunId: string | null = null;
  abortController.signal.addEventListener("abort", () => {
    cancelled = true;
  });

  const stopStreamTimer = workflowStreamDurationSeconds.startTimer();

  const recordEvent = (
    event: "run" | "chunk" | "progress" | "error" | "complete" | "cancel"
  ) => {
    workflowStreamEventsTotal.inc({ event });
  };

  const lifecycle = createLifecycle({
    userId: session.user.id,
    stopStreamTimer,
    recordEvent,
    triggerPreferenceRefresh: callbacks.triggerPreferenceRefresh,
    emitComplete: callbacks.emitComplete,
  });

  const timeout = startTimeout({
    ms: GLOBAL_TIMEOUT_MS,
    lifecycle,
    recordEvent,
    abortController,
    markCancelled: () => {
      cancelled = true;
    },
    getRunId: () => outerRunId,
    emitError: callbacks.emitError,
  });

  const push = (event: WorkflowEvent) => {
    if (cancelled) {
      return;
    }
    recordEvent(event.type === "progress" ? "progress" : "chunk");
    callbacks.emitNext(event);
  };

  const asyncTask = (async () => {
    let runId: string | null = null;
    const persistedMessageKeys = new Set<string>();
    let workflowConversationId: string | null = null;
    const useRuntime = shouldUseWorkflowRuntime();
    const reasonTraces: ReasonTrace[] = [];
    let linearIssueUrlFromCreation: string | null = null;
    const reviewGate = new ReviewGate();
    let linearFailureNotified = false;
    let executorRunId: string | null = null;

    if (input.linear?.sessionId) {
      reviewGate.requireAtLeast(1);
    }

    const notifyLinearFailure = async (reason: string) => {
      if (linearFailureNotified) {
        return;
      }
      if (!(input.linear?.sessionId && input.authzLinear)) {
        return;
      }
      linearFailureNotified = true;
      const resolvedRunId =
        runId ?? executorRunId ?? input.runId ?? "unassigned";
      try {
        await safeFinalizeLinearFailure({
          runId: resolvedRunId,
          reason,
          linear: input.linear,
          authz: input.authzLinear,
        });
      } catch (error) {
        logger.warn("linear_failure_notification_failed", {
          runId: resolvedRunId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    const refreshPreferences = (reason: string) =>
      callbacks.triggerPreferenceRefresh(session.user.id, { reason });

    const markCancelled = async () => {
      await notifyLinearFailure("workflow_cancelled");
      await lifecycle.markCancelled(runId);
    };

    const markSuspended = async () => {
      await lifecycle.markSuspended(runId);
    };

    const markCompleted = async () => {
      await lifecycle.markCompleted(runId);
    };

    try {
      if (!input.runId) {
        const prepared = await ensureLinearTicket({
          linear: input.linear,
          authzLinear: input.authzLinear,
          requirement: input.requirement,
        });
        if (prepared.linear) {
          input.linear = prepared.linear;
        }
        linearIssueUrlFromCreation = prepared.ticket?.issueUrl ?? null;
      }

      let history: WorkflowEvent[] | undefined;
      if (input.runId) {
        history = await loadHistory(input.runId);
      }

      const executor = createWorkflowExecutor(
        input,
        abortController,
        history,
        getRuntimeContextFromCallbacks(callbacks.context)
      );
      executorRunId = executor.runId;

      if (input.runId) {
        runId = input.runId;
        outerRunId = runId;
        await workflowRepo.updateRun(runId, { status: "running" });
      } else {
        // Explicitly cast to string to satisfy TS even if we know it's a string
        runId = String(executor.runId);
        outerRunId = runId;
        const storedInput: Record<string, unknown> = {
          ...input,
          executionId: runId,
          reasoningSince: Date.now(),
        };
        await workflowRepo.createRun({
          id: runId,
          userId: session.user.id,
          workflowId: "plan",
          status: "running",
          inputData: storedInput,
          linearSessionId: input.linear?.sessionId,
          linearSpace: input.linear?.space,
          linearIssueId:
            input.linear?.issueId ?? input.linear?.sessionId ?? undefined,
          linearIssueUrl:
            linearIssueUrlFromCreation ?? input.linear?.issueUrl ?? undefined,
        });

        if (input.linear?.sessionId && input.authzLinear) {
          await bootstrapLinearSession({
            runId,
            requirement: input.requirement,
            linear: input.linear,
            authz: input.authzLinear,
          });
        }
      }

      try {
        const { conversation, created } = await ensureWorkflowConversation({
          userId: session.user.id,
          workflowId: runId,
          title: deriveWorkflowTitle(input.requirement),
        });
        workflowConversationId = conversation.id;
        if (created) {
          const persisted = await persistWorkflowMessages({
            userId: session.user.id,
            conversationId: conversation.id,
            messages: [createRequirementMessage(input, runId)],
            persistedKeys: persistedMessageKeys,
            runId,
            eventType: "workflow.requirement",
            eventId: runId,
          });
          if (persisted > 0) {
            refreshPreferences("workflow_requirement");
          }
        }
      } catch (error) {
        logger.warn("workflow_conversation_init_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await registerRunHandle(runId, {
        resume: async ({ resumeData }) => {
          if (cancelled) {
            return;
          }
          await executor.resume(resumeData);
        },
        cancel: async () => {
          cancelled = true;
          abortController.abort();
          await executor.cancel();
        },
        abortController,
      });

      await recordAudit({
        userId: session.user.id,
        action: "workflow.stream",
        resource: { kind: "workflow", id: runId ?? executor.runId },
        decision: "allow",
        context: { auto: input.auto, mode: input.mode },
      });

      recordEvent("run");

      for await (const event of executor.stream) {
        observeEvent({ event, reviewGate, useRuntime, reasonTraces });

        const persisted = await persistStreamEvent({
          event,
          runId: runId ?? executor.runId,
          userId: session.user.id,
          workflowConversationId,
          persistedMessageKeys,
          emitUiMessages: callbacks.emitUiMessages,
          triggerPreferenceRefresh: callbacks.triggerPreferenceRefresh,
          linear: input.linear,
          authzLinear: input.authzLinear,
        });
        if (persisted) {
          push({ ...event, eventId: persisted.eventId });
        }
        if (persisted?.suspended) {
          suspended = true;
        }
      }

      if (!cancelled && useRuntime && runId && reasonTraces.length > 0) {
        try {
          const resource =
            typeof input.cw === "string" && input.cw.length > 0
              ? input.cw
              : typeof input.workspace === "string" &&
                  input.workspace.length > 0
                ? input.workspace
                : process.cwd();

          await workflowProvenance({
            resource,
            executionId: runId,
            auto: input.auto,
            threadId: runId,
            traces: reasonTraces,
            context: undefined,
          });
        } catch (error) {
          logger.warn("workflow_provenance_stream_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (cancelled) {
        await markCancelled();
        return;
      }

      if (suspended) {
        await markSuspended();
        return;
      }

      if (!reviewGate.isSatisfied()) {
        throw new Error("review_checklist_incomplete");
      }
      if (input.linear?.sessionId && input.authzLinear) {
        await safeFinalizeLinearSuccess({
          runId: runId ?? executor.runId,
          finalMessage: "Workflow completed successfully.",
          reviewChecks: reviewGate.summary(),
          linear: input.linear,
          authz: input.authzLinear,
        });
      }

      await markCompleted();
    } catch (error) {
      if (cancelled) {
        await markCancelled();
        return;
      }
      await lifecycle.markFailed({
        runId,
        error,
        input,
        notifyLinearFailure,
        emitError: callbacks.emitError,
      });
    } finally {
      try {
        if (runId) {
          await unregisterRunHandle(runId);
        }
      } catch (error) {
        logger.warn("workflow_unregister_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      timeout.stop();
    }
  })();

  void asyncTask.catch((error) => {
    logger.error("workflow_stream_task_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      callbacks.emitError(error);
    } catch (emitError) {
      logger.error("workflow_stream_emit_error_failed", {
        error: emitError instanceof Error ? emitError.message : String(emitError),
      });
    }
  });

  return () => {
    cancelled = true;
    abortController.abort();
    lifecycle.closeTimer("cancel");
    timeout.stop();
  };
}
