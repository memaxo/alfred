import { setTimeout as delay } from "node:timers/promises";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";
import {
  commentOnLinearIssue,
  emitLinearActivity,
  extractIssueIdFromSession,
  setLinearCompleted,
  setLinearDelegate,
  setLinearSessionExternalUrl,
  setLinearStarted,
} from "../integrations/linear";
import { recordAudit } from "../utils/audit";
import { makeEventId } from "../utils/event-id";
import { eventToUiMessages } from "../utils/normalize";
import { redactEventData } from "../utils/redaction";
import {
  multiAgentAgentDurationSeconds,
  multiAgentErrorsTotal,
  multiAgentTasksTotal,
  multiAgentWavesTotal,
  workflowStreamDurationSeconds,
  workflowStreamEventsTotal,
} from "./metrics";
import { type ReasonTrace, workflowProvenance } from "./provenance";
import { runRegistry } from "./registry";
import {
  createRequirementMessage,
  createWorkflowExecutor,
  deriveWorkflowTitle,
  ensureWorkflowConversation,
  persistWorkflowMessages,
  shouldUseWorkflowRuntime,
  type WorkflowInputPayload,
} from "./services";
import { ReviewGate, type ReviewCheckStatus } from "./review-gate";
import { ensureLinearTicket } from "./linear";

export type OrchestratorCallbacks = {
  triggerPreferenceRefresh: (
    userId: string,
    payload: { reason: string }
  ) => void;
  ensureObligations?: (ctx: any) => void;
  context?: any;
  emitError: (error: any) => void;
  emitNext: (event: WorkflowEvent) => void;
  emitComplete: () => void;
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
    if (!id || !externalUrlBase) {
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

  const asyncTask = (async () => {
    let runId: string | null = null;
    const persistedMessageKeys = new Set<string>();
    let workflowConversationId: string | null = null;
    const useRuntime = shouldUseWorkflowRuntime();
    const reasonTraces: ReasonTrace[] = [];
    const reviewGate = new ReviewGate();
    let linearIssueUrlFromCreation: string | null = null;

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
      const payload = event as any;
      const text =
        typeof payload.text === "string" && payload.text.length > 0
          ? payload.text
          : typeof payload.reasoning === "string" &&
              payload.reasoning.length > 0
            ? payload.reasoning
            : null;
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
        history = events.reverse().map((e) => ({
          ...(e.eventData as object),
          type: e.eventType,
        })) as WorkflowEvent[];
      }

      const executor = createWorkflowExecutor(input, abortController, history);

      if (input.runId) {
        runId = input.runId;
        await workflowRepo.updateRun(runId, { status: "running" });
      } else {
        runId = executor.runId;
        const storedInput = {
          ...(input as any),
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
            input.linear?.issueId ?? input.linear?.sessionId ?? null,
          linearIssueUrl:
            linearIssueUrlFromCreation ?? input.linear?.issueUrl ?? null,
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

      await runRegistry.register(runId, {
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
        return VALID_EVENT_TYPES.includes(type as any) ? type : "event";
      };

      const maybeUiMessages = (event: WorkflowEvent): UIMessage[] | null => {
        const msgs = eventToUiMessages(event);
        return Array.isArray(msgs) && msgs.length > 0 ? msgs : null;
      };

      for await (const event of executor.stream) {
        try {
          // Multi-agent observability hooks
          const evt = event as any;
          if (evt.kind === "data-subtasks" && Array.isArray(evt.data)) {
            multiAgentTasksTotal.inc(
              { status: "created" },
              evt.data.length || 1
            );
          } else if (evt.kind === "data-wave-plan") {
            multiAgentWavesTotal.inc({ status: "started" });
          } else if (evt.kind === "wave-result") {
            const data = evt.data || {};
            const status =
              typeof data.status === "string" ? data.status : "completed";
            multiAgentWavesTotal.inc({ status });

            const agents: Array<{
              role?: string;
              status?: string;
              stuck?: boolean;
              durationSeconds?: number;
            }> = Array.isArray(data.agents) ? data.agents : [];

            for (const agent of agents) {
              const role =
                agent.role && agent.role.length > 0 ? agent.role : "worker";
              const rawStatus = agent.status;
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
          } else if (evt.kind === "wave-aborted") {
            multiAgentErrorsTotal.inc({ kind: "wave_aborted" });
          } else if (evt.kind === "merge-conflict") {
            multiAgentErrorsTotal.inc({ kind: "merge_conflict" });
          } else if (evt.kind === "merge-plan") {
            multiAgentTasksTotal.inc({ status: "merged" });
          } else if (evt.kind === "review-plan") {
            multiAgentTasksTotal.inc({ status: "review" });
            reviewGate.applyPlan(evt.data ?? {});
          } else if (evt.kind === "review-check") {
            reviewGate.recordCheck({
              id: evt.data?.id,
              type: evt.data?.type,
              status: evt.data?.status,
              attempt: evt.data?.attempt,
              evidence:
                evt.data?.output ?? evt.data?.error ?? evt.data?.evidence,
            });
          } else if (
            evt.kind === "merge-agent-result" ||
            evt.kind === "review-agent-result" ||
            evt.kind === "conflict-agent-result" ||
            evt.kind === "conflict-resolution-result" ||
            evt.kind === "review-exec-result"
          ) {
            const data = evt.data || {};
            const role =
              typeof data.role === "string" && data.role.length > 0
                ? data.role
                : "worker";
            const rawStatus = data.status as string | undefined;
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
              const kind =
                evt.kind === "merge-agent-result"
                  ? "merge_failed"
                  : evt.kind === "review-agent-result"
                    ? "review_failed"
                    : evt.kind === "conflict-agent-result"
                      ? "merge_conflict_analysis_failed"
                      : evt.kind === "conflict-resolution-result"
                        ? "merge_conflict_resolution_failed"
                        : "review_exec_failed";
              multiAgentErrorsTotal.inc({ kind });
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
            eventData: redactedEventData,
          });

          const uiMessages = maybeUiMessages(event);
          if (uiMessages && uiMessages.length > 0) {
            await workflowRepo.appendEvent({
              runId,
              eventId: makeEventId({
                runId,
                type: "ui-message",
                data: uiMessages,
              }),
              eventType: "ui-message",
              eventData: uiMessages,
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
          push({ ...event, eventId } as WorkflowEvent);

          if (
            event.type === "notice" &&
            (event as any).message === "workflow_suspended"
          ) {
            suspended = true;
          }

          if (
            input.linear?.sessionId &&
            input.authzLinear &&
            event.type === "error"
          ) {
            emitLinearActivity("error", {
              sessionId: input.linear.sessionId,
              space: input.linear.space,
              authz: input.authzLinear,
              body: (event as any).message ?? "Workflow error occurred",
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

      if (finalStatus === "completed") {
        if (!reviewGate.isSatisfied()) {
          throw new Error("review_checklist_incomplete");
        }
        if (input.linear?.sessionId && input.authzLinear) {
          await finalizeLinearSuccess({
            runId: runId ?? executor.runId,
            finalMessage,
            reviewChecks: reviewGate.summary(),
            linear: input.linear,
            authz: input.authzLinear,
            workflowUrl: workflowUrlFor(runId ?? executor.runId),
          });
        }
      }

      await markCompleted();
    } catch (error) {
      if (cancelled) {
        await markCancelled();
        return;
      }
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
          await runRegistry.unregister(runId);
        }
      } catch (error) {
        logger.warn("workflow_unregister_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  })();

  asyncTask.catch((error) => callbacks.emitError(error));

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
      const attemptInfo = check.attempts > 0 ? ` (attempt ${check.attempts})` : "";
      lines.push(`- ${check.type}: ${check.status}${attemptInfo}`);
    }
  } else {
    lines.push("Review checks: not required.");
  }

  return lines.join("\n");
}
