import { ensureMirrorNodes } from "@alfred/db/repo/graph/write";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type";
import { RuntimeContext } from "@alfred/type/runtime-context";
import type { UIMessage } from "@alfred/type/stream";
import { recordAudit } from "../utils/audit";
import { coerceNonEmptyString, coerceRecord } from "../utils/coerce";
import { unwrapEventEnvelope } from "../utils/envelope";
import { persistEventSafe } from "./event-persistence";
import { ensureLinearTicket } from "./linear";
import { LinearActivityService } from "./linear-activity";
import {
  workflowStreamDurationSeconds,
  workflowStreamEventsTotal,
} from "./metrics";
import { recordMultiAgentEvent } from "./metrics-recorder";
import { type ReasonTrace, workflowProvenance } from "./provenance";
import { ReviewGateManager } from "./review-gate-manager";
import {
  createRequirementMessage,
  createWorkflowExecutor,
  deriveWorkflowTitle,
  ensureWorkflowConversation,
  persistWorkflowMessages,
  type WorkflowInputPayload,
} from "./services";
import { registerRunHandle, unregisterRunHandle } from "./session-recovery";

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

const GLOBAL_TIMEOUT_MS = 30 * 60 * 1000;

function workflowUrlFor(
  externalUrlBase: string | null,
  id: string | null
): string | null {
  if (!(id && externalUrlBase)) {
    return null;
  }
  const normalized = externalUrlBase.endsWith("/")
    ? externalUrlBase.slice(0, -1)
    : externalUrlBase;
  return `${normalized}/workflow/${id}`;
}

export async function orchestrateWorkflowStream(
  input: WorkflowInputPayload,
  session: { user: { id: string } },
  callbacks: OrchestratorCallbacks
): Promise<() => void> {
  if (input.auto === "medium" || input.auto === "high") {
    try {
      callbacks.ensureObligations?.(callbacks.context);
    } catch (error) {
      callbacks.emitError(error);
      return () => {};
    }
  }

  const externalUrlBase =
    process.env.PUBLIC_URL ??
    process.env.VITE_APP_URL ??
    process.env.APP_URL ??
    null;

  const abortController = new AbortController();
  let cancelled = false;
  let suspended = false;
  let timerClosed = false;
  abortController.signal.addEventListener("abort", () => {
    cancelled = true;
  });

  const stopStreamTimer = workflowStreamDurationSeconds.startTimer();
  const closeTimer = (status: "ok" | "error" | "cancel") => {
    if (timerClosed) {
      return;
    }
    stopStreamTimer({ status });
    timerClosed = true;
  };

  const recordEvent = (
    event: "run" | "chunk" | "progress" | "error" | "complete" | "cancel"
  ) => {
    workflowStreamEventsTotal.inc({ event });
  };

  const push = (event: WorkflowEvent) => {
    if (cancelled) {
      return;
    }
    recordEvent(event._ === "progress" ? "progress" : "chunk");
    callbacks.emitNext(event);
  };

  let outerRunId: string | null = null;
  const globalTimeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      cancelled = true;
      abortController.abort();
      reject(new Error("workflow_global_timeout"));
    }, GLOBAL_TIMEOUT_MS);
  });

  const asyncTask = (async () => {
    let runId: string | null = null;
    const persistedMessageKeys = new Set<string>();
    let workflowConversationId: string | null = null;
    const reasonTraces: ReasonTrace[] = [];
    const reviewGateManager = new ReviewGateManager();
    let linearActivity: LinearActivityService | null = null;
    let linearIssueUrlFromCreation: string | null = null;

    // Restore state if resuming
    if (input.runId) {
      await reviewGateManager.restoreFromRun(input.runId);
    }

    if (input.linear?.sessionId) {
      reviewGateManager.requireAtLeast(1);
    }

    const refreshPreferences = (reason: string) =>
      callbacks.triggerPreferenceRefresh(session.user.id, { reason });

    const markCancelled = async () => {
      if (!runId) {
        return;
      }
      try {
        await workflowRepo.updateRun(runId, {
          status: "cancelled",
          completedAt: new Date(),
        });
        await recordAudit({
          userId: session.user.id,
          action: "workflow.stream.cancel",
          resource: { kind: "workflow", id: runId },
          decision: "allow",
        });
        refreshPreferences("workflow_stream_cancelled");
      } catch (error) {
        logger.warn("workflow_cancellation_update_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await linearActivity?.completeFailure("workflow_cancelled");
      if (!timerClosed) {
        recordEvent("cancel");
        closeTimer("cancel");
      }
      callbacks.emitComplete();
    };

    const markSuspended = async () => {
      if (!runId) {
        return;
      }
      await reviewGateManager.persistState(runId);
      try {
        await workflowRepo.updateRun(runId, {
          status: "suspended",
          completedAt: undefined,
        });
        await recordAudit({
          userId: session.user.id,
          action: "workflow.stream.suspend",
          resource: { kind: "workflow", id: runId },
          decision: "allow",
        });
        refreshPreferences("workflow_stream_suspended");
      } catch (error) {
        logger.warn("workflow_suspension_update_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (!timerClosed) {
        recordEvent("complete");
        closeTimer("ok");
      }
      callbacks.emitComplete();
    };

    const markCompleted = async () => {
      if (!runId) {
        return;
      }
      try {
        await workflowRepo.updateRun(runId, {
          status: "completed",
          completedAt: new Date(),
        });
        await recordAudit({
          userId: session.user.id,
          action: "workflow.stream.complete",
          resource: { kind: "workflow", id: runId },
          decision: "allow",
        });
        refreshPreferences("workflow_stream_complete");
      } catch (error) {
        logger.warn("workflow_completion_update_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      recordEvent("complete");
      closeTimer("ok");
      callbacks.emitComplete();
    };

    const addReasoning = (event: WorkflowEvent) => {
      if (event._ !== "reasoning") {
        return;
      }
      const payload = coerceRecord(event);
      const text =
        coerceNonEmptyString(payload.text) ??
        coerceNonEmptyString(payload.reasoning);
      if (!text) {
        return;
      }
      reasonTraces.push({ text, timestamp: Date.now() });
    };

    try {
      // Ensure Linear ticket if not resuming
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

      // Load history for resume
      let history: WorkflowEvent[] | undefined;
      if (input.runId) {
        const events = await workflowRepo.listEvents(input.runId);
        history = events
          .reverse()
          .filter((e) => e.eventType !== "ui-message")
          .map((e) => {
            const unwrapped = unwrapEventEnvelope(e.eventData);
            const payload =
              unwrapped.data && typeof unwrapped.data === "object"
                ? (unwrapped.data as Record<string, unknown>)
                : {};
            return { ...payload, _: e.eventType } as WorkflowEvent;
          });
      }

      // Create executor
      const contextRecord = coerceRecord(callbacks.context);
      const runtimeContext =
        contextRecord.runtimeContext instanceof RuntimeContext
          ? (contextRecord.runtimeContext as RuntimeContext<
              Record<string, unknown>
            >)
          : undefined;

      const executor = await createWorkflowExecutor(
        input,
        abortController,
        history,
        runtimeContext
      );

      // Initialize or resume run
      if (input.runId) {
        runId = input.runId;
        outerRunId = runId;
        await workflowRepo.updateRun(input.runId, { status: "running" });
      } else {
        runId = executor.runId;
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

        void ensureMirrorNodes("user", [
          {
            kind: "workflow_run",
            id: runId,
            label: deriveWorkflowTitle(input.requirement),
            properties: {
              entity: { kind: "workflow_run", id: runId },
              workflowId: "plan",
              status: "running",
              linearIssueId:
                input.linear?.issueId ?? input.linear?.sessionId ?? undefined,
              linearIssueUrl:
                linearIssueUrlFromCreation ??
                input.linear?.issueUrl ??
                undefined,
            },
          },
        ]).catch((error) => {
          logger.warn("workflow_run_mirror_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

        // Initialize Linear activity service
        if (input.linear?.sessionId && input.authzLinear) {
          linearActivity = new LinearActivityService(
            input.linear,
            input.authzLinear,
            runId
          );
          await linearActivity.bootstrap({
            requirement: input.requirement,
            workflowUrl: workflowUrlFor(externalUrlBase, runId),
          });
        }
      }

      // After this point runId is guaranteed to be set
      const activeRunId = runId;
      if (!activeRunId) {
        throw new Error("workflow_run_id_not_found");
      }

      // Setup conversation
      try {
        const { conversation, created } = await ensureWorkflowConversation({
          userId: session.user.id,
          workflowId: activeRunId,
          title: deriveWorkflowTitle(input.requirement),
        });
        workflowConversationId = conversation.id;
        if (created) {
          const persisted = await persistWorkflowMessages({
            userId: session.user.id,
            conversationId: conversation.id,
            messages: [createRequirementMessage(input, activeRunId)],
            persistedKeys: persistedMessageKeys,
            runId: activeRunId,
            eventType: "workflow.requirement",
            eventId: activeRunId,
          });
          if (persisted > 0) {
            refreshPreferences("workflow_requirement");
          }
        }
      } catch (error) {
        logger.warn("workflow_conversation_init_failed", {
          runId: activeRunId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Register run handle for resume/cancel
      await registerRunHandle(activeRunId, {
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
        resource: { kind: "workflow", id: activeRunId },
        decision: "allow",
        context: { auto: input.auto, mode: input.mode },
      });

      recordEvent("run");

      // Stream event loop
      for await (const event of executor.stream) {
        // Multi-agent metrics
        try {
          const kind = coerceNonEmptyString(coerceRecord(event).kind);
          if (kind === "review-plan") {
            recordMultiAgentEvent(event);
            reviewGateManager.applyPlan(coerceRecord(event).data);
          } else if (kind === "review-check") {
            reviewGateManager.recordCheck(coerceRecord(event).data);
          } else if (kind === "review-escalated") {
            const result = reviewGateManager.recordEscalation(
              coerceRecord(event).data
            );
            if (result) {
              const { multiAgentErrorsTotal } = await import("./metrics");
              multiAgentErrorsTotal.inc({ kind: result.metricKind });
            }
          } else {
            recordMultiAgentEvent(event);
          }
        } catch {
          // Metrics must never break streaming
        }

        try {
          addReasoning(event);
        } catch {
          // Reasoning capture must never break streaming
        }

        // Persist event
        const persistResult = await persistEventSafe(activeRunId, event);
        if (persistResult) {
          const { eventId, eventType, uiMessages } = persistResult;

          if (workflowConversationId && uiMessages && uiMessages.length > 0) {
            const persisted = await persistWorkflowMessages({
              userId: session.user.id,
              conversationId: workflowConversationId,
              messages: uiMessages,
              persistedKeys: persistedMessageKeys,
              runId: activeRunId,
              baseId: eventId,
              eventType: event._,
              eventId,
            });
            if (persisted > 0) {
              refreshPreferences("workflow_messages_persisted");
            }
          }

          if (uiMessages && uiMessages.length > 0) {
            callbacks.emitUiMessages?.(uiMessages, {
              runId: activeRunId,
              eventId,
              eventType,
              originalEvent: event,
            });
          }

          push({ ...event, eventId } as WorkflowEvent);

          // Check for suspension notice
          if (
            event._ === "notice" &&
            coerceNonEmptyString(coerceRecord(event).message) ===
              "workflow_suspended"
          ) {
            suspended = true;
          }

          // Emit Linear error activity
          if (linearActivity && event._ === "error") {
            const message =
              coerceNonEmptyString(coerceRecord(event).message) ??
              "Workflow error occurred";
            linearActivity.emitError(message).catch(() => {});
          }
        }
      }

      // Post-stream: provenance
      if (!cancelled && runId && reasonTraces.length > 0) {
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

      // Validate review gate
      if (!reviewGateManager.isSatisfied()) {
        const escalationReason = reviewGateManager.getEscalationReason();
        const reason = escalationReason
          ? `review_escalation_required:${escalationReason}`
          : "review_checklist_incomplete";
        throw new Error(reason);
      }

      // Finalize Linear success
      if (linearActivity) {
        await linearActivity.completeSuccess({
          finalMessage: "Workflow completed successfully.",
          reviewChecks: reviewGateManager.summary(),
          workflowUrl: workflowUrlFor(externalUrlBase, runId ?? executor.runId),
        });
      }

      await markCompleted();
    } catch (error) {
      if (cancelled) {
        await markCancelled();
        return;
      }
      await linearActivity?.completeFailure(
        error instanceof Error ? error.message : String(error)
      );
      recordEvent("error");
      closeTimer("error");
      if (runId) {
        try {
          await workflowRepo.updateRun(runId, {
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : String(error),
          });
        } catch (updateError) {
          logger.warn("workflow_error_status_update_failed", {
            runId,
            error:
              updateError instanceof Error
                ? updateError.message
                : String(updateError),
          });
        }
      }
      callbacks.emitError(error);
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
    }
  })();

  Promise.race([asyncTask, globalTimeoutPromise]).catch((error) => {
    if (error instanceof Error && error.message === "workflow_global_timeout") {
      logger.error("workflow_global_timeout", {
        runId: outerRunId ?? "unknown",
      });
      recordEvent("error");
      closeTimer("error");
      const resolvedRunId = outerRunId;
      if (resolvedRunId) {
        workflowRepo
          .updateRun(resolvedRunId, {
            status: "failed",
            errorMessage: "workflow_global_timeout",
          })
          .catch((updateError) => {
            logger.warn("workflow_timeout_update_failed", {
              runId: resolvedRunId,
              error:
                updateError instanceof Error
                  ? updateError.message
                  : String(updateError),
            });
          });
      }
      callbacks.emitError(error);
    } else {
      callbacks.emitError(error);
    }
  });

  return () => {
    cancelled = true;
    abortController.abort();
    if (!timerClosed) {
      recordEvent("cancel");
      closeTimer("cancel");
    }
  };
}
