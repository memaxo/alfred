import { setTimeout as delay } from "node:timers/promises";
import { ensureMirrorNodes } from "@alfred/db/repo/graph/write";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type";
import { RuntimeContext } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";
import {
  commentOnLinearIssue,
  emitLinearActivity,
  extractIssueIdFromSession,
  setLinearCancelled,
  setLinearCompleted,
  setLinearDelegate,
  setLinearSessionExternalUrl,
  setLinearStarted,
} from "../integrations/linear";
import { recordAudit } from "../utils/audit";
import { unwrapEventEnvelope, wrapEventEnvelope } from "../utils/envelope";
import { makeEventId } from "../utils/event-id";
import { eventToUiMessages } from "../utils/normalize";
import { redactEventData } from "../utils/redaction";
import { ensureLinearTicket } from "./linear";
import {
  multiAgentAgentDurationSeconds,
  multiAgentErrorsTotal,
  multiAgentTasksTotal,
  multiAgentWavesTotal,
  workflowStreamDurationSeconds,
  workflowStreamEventsTotal,
} from "./metrics";
import { type ReasonTrace, workflowProvenance } from "./provenance";
import { type ReviewCheckStatus, ReviewGate } from "./review-gate";
import {
  createRequirementMessage,
  createWorkflowExecutor,
  deriveWorkflowTitle,
  ensureWorkflowConversation,
  persistWorkflowMessages,
  shouldUseWorkflowRuntime,
  type WorkflowInputPayload,
} from "./services";
import { registerRunHandle, unregisterRunHandle } from "./session-recovery";

function coerceRecord(val: unknown): Record<string, unknown> {
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

function coerceNonEmptyString(val: unknown): string | null {
  return typeof val === "string" && val.length > 0 ? val : null;
}

type ReviewEscalationSummary = {
  reason?: string;
  attempts?: number;
  fixerAttempts?: number;
  plan?: string;
  failures?: Array<{
    command?: string;
    output?: string;
    error?: string;
    checkId?: string;
  }>;
  relevantFiles?: string[];
  summary?: string;
};

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

  const externalUrlBase =
    process.env.PUBLIC_URL ??
    process.env.VITE_APP_URL ??
    process.env.APP_URL ??
    null;

  const workflowUrlFor = (id: string | null): string | null => {
    if (!(id && externalUrlBase)) {
      return null;
    }
    const normalized = externalUrlBase.endsWith("/")
      ? externalUrlBase.slice(0, -1)
      : externalUrlBase;
    return `${normalized}/workflow/${id}`;
  };

  const resolveIssueId = (
    linear: NonNullable<WorkflowInputPayload["linear"]>
  ): string | null => {
    if (linear.issueId && linear.issueId.length > 0) {
      return linear.issueId;
    }
    if (linear.sessionId) {
      return extractIssueIdFromSession(linear.sessionId);
    }
    return null;
  };

  const bootstrapLinearSession = async (args: {
    runId: string;
    requirement: string;
    linear: NonNullable<WorkflowInputPayload["linear"]>;
    authz: string;
    workflowUrl: string | null;
  }): Promise<void> => {
    const { runId, requirement, linear, authz, workflowUrl } = args;
    try {
      const thoughtPromise = emitLinearActivity("thought", {
        sessionId: linear.sessionId as string,
        space: linear.space,
        authz,
        body: `Starting workflow: ${requirement}`,
      }).catch((error) => {
        logger.warn("linear_thought_activity_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
        return { ok: false };
      });

      await Promise.race([
        thoughtPromise,
        delay(9000).then(() => {
          logger.warn("linear_thought_activity_timeout", { runId });
          return { ok: false };
        }),
      ]);

      const issueId = resolveIssueId(linear);
      if (!issueId) {
        logger.warn("linear_issue_id_missing", { runId });
        return;
      }

      setLinearDelegate({
        space: linear.space,
        issueId,
        authz,
      }).catch((error) => {
        logger.warn("linear_delegate_setup_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      setLinearStarted({
        space: linear.space,
        issueId,
        authz,
      }).catch((error) => {
        logger.warn("linear_started_setup_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      if (workflowUrl) {
        setLinearSessionExternalUrl(
          linear.sessionId as string,
          linear.space,
          authz,
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
    } catch (error) {
      logger.warn("linear_bootstrap_failed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const finalizeLinearSuccess = async (args: {
    runId: string;
    finalMessage: string | null;
    reviewChecks: ReviewCheckStatus[];
    linear: NonNullable<WorkflowInputPayload["linear"]>;
    authz: string;
    workflowUrl: string | null;
  }): Promise<void> => {
    const { runId, finalMessage, reviewChecks, linear, authz, workflowUrl } =
      args;
    const issueId = resolveIssueId(linear);
    if (!issueId) {
      throw new Error("linear_issue_id_missing");
    }

    await setLinearCompleted({
      space: linear.space,
      issueId,
      authz,
    });

    const commentBody = buildLinearCompletionComment({
      runId,
      finalMessage,
      reviewChecks,
      workflowUrl,
    });

    await commentOnLinearIssue({
      space: linear.space,
      issueId,
      authz,
      body: commentBody,
    });
  };

  const finalizeLinearFailure = async (args: {
    runId: string;
    reason: string;
    linear: NonNullable<WorkflowInputPayload["linear"]>;
    authz: string;
    workflowUrl: string | null;
  }): Promise<void> => {
    const { runId, reason, linear, authz, workflowUrl } = args;
    const issueId = resolveIssueId(linear);
    if (!issueId) {
      throw new Error("linear_issue_id_missing");
    }

    await setLinearCancelled({
      space: linear.space,
      issueId,
      authz,
    });

    const commentBody = buildLinearFailureComment({
      runId,
      reason,
      workflowUrl,
    });

    await commentOnLinearIssue({
      space: linear.space,
      issueId,
      authz,
      body: commentBody,
    });
  };

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
    recordEvent(event.type === "progress" ? "progress" : "chunk");
    callbacks.emitNext(event);
  };

  const GLOBAL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  let outerRunId: string | null = null; // Track runId for timeout error logging
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
    const useRuntime = shouldUseWorkflowRuntime();
    const reasonTraces: ReasonTrace[] = [];
    const reviewGate = new ReviewGate();
    let reviewEscalation: ReviewEscalationSummary | null = null;

    // Restore ReviewGate state from workflow stateData if resuming
    if (input.runId) {
      try {
        const workflowRun = await workflowRepo.getRun(input.runId);
        if (
          workflowRun?.stateData &&
          typeof workflowRun.stateData === "object"
        ) {
          const stateData = workflowRun.stateData as Record<string, unknown>;
          if (
            stateData.reviewGate &&
            typeof stateData.reviewGate === "object"
          ) {
            reviewGate.restore(
              stateData.reviewGate as Parameters<typeof reviewGate.restore>[0]
            );
          }
          if (stateData.reviewEscalation) {
            reviewEscalation =
              stateData.reviewEscalation as ReviewEscalationSummary | null;
          }
        }
      } catch (error) {
        logger.warn("failed_to_restore_review_gate", {
          runId: input.runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    let reviewEscalationMetricRecorded = false;
    let linearIssueUrlFromCreation: string | null = null;
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
        await finalizeLinearFailure({
          runId: resolvedRunId,
          reason,
          linear: input.linear,
          authz: input.authzLinear,
          workflowUrl: workflowUrlFor(resolvedRunId),
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
      await notifyLinearFailure("workflow_cancelled");
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

      // Persist ReviewGate state before suspension
      try {
        const workflowRun = await workflowRepo.getRun(runId);
        const existingStateData =
          workflowRun?.stateData && typeof workflowRun.stateData === "object"
            ? (workflowRun.stateData as Record<string, unknown>)
            : {};
        await workflowRepo.updateRun(runId, {
          stateData: {
            ...existingStateData,
            reviewGate: reviewGate.serialize(),
            reviewEscalation,
          },
        });
      } catch (error) {
        logger.warn("failed_to_persist_review_gate", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with suspension even if persistence fails
      }
      try {
        await workflowRepo.updateRun(runId, {
          status: "suspended",
          completedAt: undefined, // Not complete yet
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
      if (!useRuntime) {
        return;
      }
      if (event.type !== "reasoning") {
        return;
      }
      const payload = coerceRecord(event);
      const text =
        coerceNonEmptyString(payload.text) ?? coerceNonEmptyString(payload.reasoning);
      if (!text) {
        return;
      }
      reasonTraces.push({ text, timestamp: Date.now() });
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
            return { ...payload, type: e.eventType } as WorkflowEvent;
          });
      }

      const contextRecord = coerceRecord(callbacks.context);
      const runtimeContext =
        contextRecord.runtimeContext instanceof RuntimeContext
          ? contextRecord.runtimeContext
          : undefined;

      const executor = await createWorkflowExecutor(
        input,
        abortController,
        history,
        runtimeContext
      );
      executorRunId = executor.runId;

      if (input.runId) {
        runId = input.runId;
        outerRunId = runId;
        await workflowRepo.updateRun(runId, { status: "running" });
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
                linearIssueUrlFromCreation ?? input.linear?.issueUrl ?? undefined,
            },
          },
        ]).catch((error) => {
          logger.warn("workflow_run_mirror_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

        if (input.linear?.sessionId && input.authzLinear) {
          await bootstrapLinearSession({
            runId,
            requirement: input.requirement,
            linear: input.linear,
            authz: input.authzLinear,
            workflowUrl: workflowUrlFor(runId),
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
      const VALID_EVENT_TYPES = [
        "run",
        "progress",
        "context",
        "require-scope",
        "notice",
        "error",
        "stdout",
        "stderr",
        "droid",
        "data-cache-handoff",
      ] as const;
      const getEventType = (event: WorkflowEvent): string => {
        const type = event.type;
        return (VALID_EVENT_TYPES as readonly string[]).includes(type)
          ? type
          : "event";
      };

      const maybeUiMessages = (event: WorkflowEvent): UIMessage[] | null => {
        const msgs = eventToUiMessages(event);
        return Array.isArray(msgs) && msgs.length > 0 ? msgs : null;
      };

      for await (const event of executor.stream) {
        try {
          // Multi-agent observability hooks
          const evt = coerceRecord(event);
          const kind = coerceNonEmptyString(evt.kind);
          if (kind === "data-subtasks" && Array.isArray(evt.data)) {
            multiAgentTasksTotal.inc(
              { status: "created" },
              evt.data.length || 1
            );
          } else if (kind === "data-wave-plan") {
            multiAgentWavesTotal.inc({ status: "started" });
          } else if (kind === "wave-result") {
            const data = coerceRecord(evt.data);
            const status =
              coerceNonEmptyString(data.status) ?? "completed";
            multiAgentWavesTotal.inc({ status });

            const agents: Array<{
              role?: string;
              status?: string;
              stuck?: boolean;
              durationSeconds?: number;
            }> = Array.isArray(data.agents)
              ? (data.agents as Array<Record<string, unknown>>).map(coerceRecord)
              : [];

            for (const agent of agents) {
              const role =
                coerceNonEmptyString(agent.role) ?? "worker";
              const rawStatus = coerceNonEmptyString(agent.status);
              const outcome: "ok" | "error" | "stuck" =
                rawStatus === "stuck" || agent.stuck
                  ? "stuck"
                  : rawStatus === "failed"
                    ? "error"
                    : "ok";

              const dur = agent.durationSeconds;
              if (typeof dur === "number" && Number.isFinite(dur) && dur >= 0) {
                multiAgentAgentDurationSeconds.observe({ role, outcome }, dur);
              }

              if (outcome !== "ok") {
                multiAgentErrorsTotal.inc({ kind: "stuck_agent" });
              }
            }
          } else if (kind === "wave-aborted") {
            multiAgentErrorsTotal.inc({ kind: "wave_aborted" });
          } else if (kind === "merge-conflict") {
            multiAgentErrorsTotal.inc({ kind: "merge_conflict" });
          } else if (kind === "merge-plan") {
            multiAgentTasksTotal.inc({ status: "merged" });
          } else if (kind === "review-plan") {
            multiAgentTasksTotal.inc({ status: "review" });
            reviewGate.applyPlan(coerceRecord(evt.data));
          } else if (kind === "review-check") {
            const check = coerceRecord(evt.data);
            const evidenceRaw = check.output ?? check.error ?? check.evidence;
            let evidence: string | undefined;
            if (typeof evidenceRaw === "string") {
              evidence = evidenceRaw;
            } else if (evidenceRaw !== undefined && evidenceRaw !== null) {
              try {
                evidence = JSON.stringify(evidenceRaw);
              } catch {
                evidence = String(evidenceRaw);
              }
            }

            reviewGate.recordCheck({
              id: coerceNonEmptyString(check.id) ?? undefined,
              type: coerceNonEmptyString(check.type) ?? undefined,
              status: coerceNonEmptyString(check.status) ?? undefined,
              attempt:
                typeof check.attempt === "number" && Number.isFinite(check.attempt)
                  ? check.attempt
                  : undefined,
              evidence,
            });
          } else if (
            kind === "merge-agent-result" ||
            kind === "review-agent-result" ||
            kind === "conflict-agent-result" ||
            kind === "conflict-resolution-result" ||
            kind === "review-exec-result"
          ) {
            const data = coerceRecord(evt.data);
            const role =
              coerceNonEmptyString(data.role) ?? "worker";
            const rawStatus = coerceNonEmptyString(data.status);
            const outcome: "ok" | "error" | "stuck" =
              rawStatus === "stuck"
                ? "stuck"
                : rawStatus === "failed"
                  ? "error"
                  : "ok";
            const dur = data.durationSeconds;
            if (typeof dur === "number" && Number.isFinite(dur) && dur >= 0) {
              multiAgentAgentDurationSeconds.observe({ role, outcome }, dur);
            }
            if (outcome !== "ok") {
              const errorKind =
                kind === "merge-agent-result"
                  ? "merge_failed"
                  : kind === "review-agent-result"
                    ? "review_failed"
                    : kind === "conflict-agent-result"
                      ? "merge_conflict_analysis_failed"
                      : kind === "conflict-resolution-result"
                        ? "merge_conflict_resolution_failed"
                        : "review_exec_failed";
              multiAgentErrorsTotal.inc({ kind: errorKind });
            }
          } else if (kind === "review-escalated") {
            reviewEscalation = {
              reason: coerceNonEmptyString(coerceRecord(evt.data).reason) ?? undefined,
              attempts:
                typeof coerceRecord(evt.data).attempts === "number"
                  ? (coerceRecord(evt.data).attempts as number)
                  : undefined,
              fixerAttempts:
                typeof coerceRecord(evt.data).fixerAttempts === "number"
                  ? (coerceRecord(evt.data).fixerAttempts as number)
                  : undefined,
              plan: coerceNonEmptyString(coerceRecord(evt.data).plan) ?? undefined,
              failures: Array.isArray(coerceRecord(evt.data).failures)
                ? (coerceRecord(evt.data).failures as ReviewEscalationSummary["failures"])
                : undefined,
              relevantFiles: Array.isArray(coerceRecord(evt.data).relevantFiles)
                ? (coerceRecord(evt.data).relevantFiles as string[])
                : undefined,
              summary: coerceNonEmptyString(coerceRecord(evt.data).summary) ?? undefined,
            };
            if (!reviewEscalationMetricRecorded) {
              const metricKind = formatEscalationMetricKind(
                coerceNonEmptyString(coerceRecord(evt.data).reason) ?? undefined
              );
              multiAgentErrorsTotal.inc({ kind: metricKind });
              reviewEscalationMetricRecorded = true;
            }
          }
        } catch {
          // Metrics must never break streaming; ignore metric errors.
        }

        try {
          addReasoning(event);
        } catch {
          // Reasoning capture must never break streaming.
        }

        try {
          const redactedEventData = redactEventData(event);
          const eventType = getEventType(event);
          const eventId = makeEventId({
            runId,
            type: eventType,
            data: redactedEventData,
          });
          await workflowRepo.appendEvent({
            runId,
            eventId,
            eventType,
            eventData: wrapEventEnvelope({
              id: eventId,
              type: eventType,
              resource: "user",
              data: redactedEventData,
            }),
          });

          const uiMessages = maybeUiMessages(event);
          if (uiMessages && uiMessages.length > 0) {
            const uiEventId = makeEventId({
              runId,
              type: "ui-message",
              data: uiMessages,
            });
            await workflowRepo.appendEvent({
              runId,
              eventId: uiEventId,
              eventType: "ui-message",
              eventData: wrapEventEnvelope({
                id: uiEventId,
                type: "ui-message",
                resource: "user",
                data: uiMessages,
              }),
            });
          }
          if (workflowConversationId && uiMessages && uiMessages.length > 0) {
            const persisted = await persistWorkflowMessages({
              userId: session.user.id,
              conversationId: workflowConversationId,
              messages: uiMessages,
              persistedKeys: persistedMessageKeys,
              runId: runId ?? executor.runId,
              baseId: eventId,
              eventType: event.type,
              eventId,
            });
            if (persisted > 0) {
              refreshPreferences("workflow_messages_persisted");
            }
          }
          if (uiMessages && uiMessages.length > 0) {
            const resolvedRunId = runId ?? executor.runId;
            callbacks.emitUiMessages?.(uiMessages, {
              runId: resolvedRunId,
              eventId,
              eventType,
              originalEvent: event,
            });
          }
          push({ ...event, eventId } as WorkflowEvent);

          if (
            event.type === "notice" &&
            coerceNonEmptyString(coerceRecord(event).message) ===
              "workflow_suspended"
          ) {
            suspended = true;
          }

          if (
            input.linear?.sessionId &&
            input.authzLinear &&
            event.type === "error"
          ) {
            const message =
              coerceNonEmptyString(coerceRecord(event).message) ??
              "Workflow error occurred";
            emitLinearActivity("error", {
              sessionId: input.linear.sessionId,
              space: input.linear.space,
              authz: input.authzLinear,
              body: message,
            }).catch((error) => {
              logger.warn("linear_activity_emission_failed", {
                runId,
                error: error instanceof Error ? error.message : String(error),
              });
            });
          }
        } catch (error) {
          logger.warn("workflow_event_persistence_failed", {
            runId,
            eventType: getEventType(event),
            error: error instanceof Error ? error.message : String(error),
          });
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
        const reason =
          reviewEscalation?.reason && reviewEscalationMetricRecorded
            ? `review_escalation_required:${reviewEscalation.reason}`
            : "review_checklist_incomplete";
        throw new Error(reason);
      }
      if (input.linear?.sessionId && input.authzLinear) {
        await finalizeLinearSuccess({
          runId: runId ?? executor.runId,
          finalMessage: "Workflow completed successfully.",
          reviewChecks: reviewGate.summary(),
          linear: input.linear,
          authz: input.authzLinear,
          workflowUrl: workflowUrlFor(runId ?? executor.runId),
        });
      }

      await markCompleted();
    } catch (error) {
      if (cancelled) {
        await markCancelled();
        return;
      }
      await notifyLinearFailure(
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

function buildLinearCompletionComment(args: {
  runId: string;
  finalMessage: string | null;
  reviewChecks: ReviewCheckStatus[];
  workflowUrl: string | null;
}): string {
  const lines: string[] = [
    `Workflow run ${args.runId} completed successfully.`,
  ];

  if (args.workflowUrl) {
    lines.push(`Run details: ${args.workflowUrl}`);
  }

  if (args.finalMessage && args.finalMessage.trim().length > 0) {
    lines.push(`Summary: ${args.finalMessage.trim()}`);
  }

  if (args.reviewChecks.length > 0) {
    lines.push("Review checks:");
    for (const check of args.reviewChecks) {
      const attemptInfo =
        check.attempts > 0 ? ` (attempt ${check.attempts})` : "";
      lines.push(`- ${check.type}: ${check.status}${attemptInfo}`);
    }
  } else {
    lines.push("Review checks: not required.");
  }

  return lines.join("\n");
}

function buildLinearFailureComment(args: {
  runId: string;
  reason: string;
  workflowUrl: string | null;
}): string {
  const lines: string[] = [`Workflow run ${args.runId} failed.`];
  if (args.workflowUrl) {
    lines.push(`Run details: ${args.workflowUrl}`);
  }
  const trimmedReason = args.reason?.trim();
  if (trimmedReason) {
    lines.push(`Reason: ${trimmedReason}`);
  }
  lines.push("Review the run log, address the failure, and re-run when ready.");
  return lines.join("\n");
}

function formatEscalationMetricKind(reason?: string): string {
  if (!reason) {
    return "review_escalated";
  }
  const slug = reason
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug.length > 0 ? `review_${slug}` : "review_escalated";
}
