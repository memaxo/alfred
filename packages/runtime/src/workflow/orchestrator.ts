import { recordAudit } from "@alfred/agent/utils/audit";
import { ensureLinearTicket } from "@alfred/agent/workflow/linear";
import {
  workflowStreamDurationSeconds,
  workflowStreamEventsTotal,
} from "@alfred/agent/workflow/metrics";
import { ReviewGate } from "@alfred/agent/workflow/review-gate";
import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import {
  registerRunHandle,
  unregisterRunHandle,
} from "@alfred/agent/workflow/session-recovery";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type";
import { RuntimeContext } from "@alfred/type/runtime-context";
import type { UIMessage } from "@alfred/type/stream";
import type { ResumePayload } from "../types";
import {
  createRequirementMessage,
  createWorkflowExecutor,
  deriveWorkflowTitle,
  ensureWorkflowConversation,
  persistWorkflowMessages,
} from "./executor";
import { loadHistory } from "./history";
import { createLifecycle } from "./lifecycle";
import {
  bootstrapLinearSession,
  safeFinalizeLinearFailure,
  safeFinalizeLinearSuccess,
} from "./linear";
import { observeEvent } from "./observe";
import { persistStreamEvent } from "./persist";
import { type ReasonTrace, workflowProvenance } from "./provenance";
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

// biome-ignore lint/suspicious/useAwait: orchestrateWorkflowStream is called asynchronously and returns a cleanup function
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
    recordEvent(event._ === "progress" ? "progress" : "chunk");
    callbacks.emitNext(event);
  };

  const asyncTask = (async () => {
    let runId: string | null = null;
    const persistedMessageKeys = new Set<string>();
    let workflowConversationId: string | null = null;
    const reasonTraces: ReasonTrace[] = [];
    let linearIssueUrlFromCreation: string | null = null;
    const reviewGate = new ReviewGate();
    let linearFailureNotified = false;
    let executorRunId: string | null = null;
    const handoffs: Array<{ summary: string; [key: string]: unknown }> = [];

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

    const markCompleted = async (summary?: string) => {
      await lifecycle.markCompleted(runId, summary);
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

      let resolvedRunId: string;
      if (input.runId) {
        runId = input.runId;
        resolvedRunId = input.runId;
        outerRunId = runId;
        await workflowRepo.updateRun(resolvedRunId, { status: "running" });
      } else {
        // Explicitly cast to string to satisfy TS even if we know it's a string
        runId = String(executor.runId);
        resolvedRunId = runId;
        outerRunId = runId;

        const projectId = await (async () => {
          const url = process.env.DATABASE_URL;
          if (!url || url.startsWith("sqlite")) {
            return;
          }
          try {
            const { detectProject } = await import("@alfred/plan");
            const workspace =
              (typeof input.workspace === "string" && input.workspace.length > 0
                ? input.workspace
                : typeof input.cw === "string" && input.cw.length > 0
                  ? input.cw
                  : undefined) ?? process.cwd();
            const project = await detectProject(workspace, session.user.id);
            return project.id;
          } catch {
            return;
          }
        })();

        const storedInput: Record<string, unknown> = {
          ...input,
          executionId: runId,
          reasoningSince: Date.now(),
        };

        const runtimeContext = getRuntimeContextFromCallbacks(
          callbacks.context
        );
        if (runtimeContext && projectId && !runtimeContext.has("projectId")) {
          runtimeContext.set("projectId", projectId);
        }

        await workflowRepo.createRun({
          id: runId,
          userId: session.user.id,
          projectId,
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

      const projectIdForConversation = await (async () => {
        if (!process.env.DATABASE_URL) {
          return;
        }
        const id = resolvedRunId;
        if (!id) {
          return;
        }
        try {
          const run = await workflowRepo.getRun(id);
          return run?.projectId ?? undefined;
        } catch {
          return;
        }
      })();

      try {
        const { conversation, created } = await ensureWorkflowConversation({
          userId: session.user.id,
          workflowId: resolvedRunId,
          title: deriveWorkflowTitle(input.requirement),
          projectId: projectIdForConversation,
        });
        workflowConversationId = conversation.id;
        if (created) {
          const persisted = await persistWorkflowMessages({
            userId: session.user.id,
            conversationId: conversation.id,
            messages: [createRequirementMessage(input, resolvedRunId)],
            persistedKeys: persistedMessageKeys,
            runId: resolvedRunId,
            eventType: "workflow.requirement",
            eventId: resolvedRunId,
          });
          if (persisted > 0) {
            refreshPreferences("workflow_requirement");
          }
        }
      } catch (error) {
        logger.warn("workflow_conversation_init_failed", {
          runId: resolvedRunId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await registerRunHandle(resolvedRunId, {
        resume: async ({ resumeData }: { resumeData: ResumePayload }) => {
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
        projectId:
          (getRuntimeContextFromCallbacks(callbacks.context)?.get(
            "projectId"
          ) as string) ?? undefined,
        action: "workflow.stream",
        resource: { kind: "workflow", id: runId ?? executor.runId },
        decision: "allow",
        context: { auto: input.auto, mode: input.mode },
      });

      recordEvent("run");

      for await (const event of executor.stream) {
        observeEvent({ event, reviewGate, reasonTraces });

        // Collect handoffs for final learning summary
        if (event._ === "agent-handoff") {
          handoffs.push(
            event.data as { summary: string; [key: string]: unknown }
          );
        }

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

      // Generate final execution summary for learning
      let finalSummary: string | undefined;
      if (handoffs.length > 0) {
        finalSummary = handoffs.map((h) => h.summary).join(" ");
      }

      await markCompleted(finalSummary);
    } catch (error) {
      if (cancelled) {
        await markCancelled();
        return;
      }

      // Generate failure summary if possible
      let failureSummary: string | undefined;
      if (handoffs.length > 0) {
        failureSummary = handoffs.map((h) => h.summary).join(" ");
      }

      await lifecycle.markFailed({
        runId,
        error,
        input,
        notifyLinearFailure,
        emitError: callbacks.emitError,
        summary: failureSummary,
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
        error:
          emitError instanceof Error ? emitError.message : String(emitError),
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
