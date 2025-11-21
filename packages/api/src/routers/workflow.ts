import { emitLinearActivity } from "@alfred/agent/orchestrator/linear";
import { configureLinearMetrics } from "@alfred/agent/orchestrator/linearmetrics";
import {
  codexLinearIntegrationLatencySeconds,
  codexSessionContinuityTotal,
  linearActivityDurationSeconds,
  linearActivityEmissionsTotal,
  linearSessionOperationsTotal,
  multiAgentAgentDurationSeconds,
  multiAgentErrorsTotal,
  multiAgentTasksTotal,
  multiAgentWavesTotal,
  replayQueriesTotal,
  replayQueryDurationSeconds,
  workflowStreamDurationSeconds,
  workflowStreamEventsTotal,
} from "@alfred/api/metrics";
import * as workflowRepo from "@alfred/db/repo/workflow";
import type {
  ReasoningEdgeRecord,
  ReasoningNodeRecord,
} from "@alfred/knowledge/query";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { eventToUiMessages } from "../ai/normalize";
import { requirePolicy } from "../gate";
import { triggerPreferenceRefresh } from "../preference/refresh";
import { runRegistry } from "../run-registry";
import {
  createRequirementMessage,
  createWorkflowExecutor,
  deriveWorkflowTitle,
  ensureObligations,
  ensureWorkflowConversation,
  mapWorkflowResource,
  mapWorkflowRunResource,
  persistWorkflowMessages,
  shouldUseWorkflowRuntime,
  workflowInput,
} from "../services/workflow";
import { authedProcedure, rateLimit, router } from "../trpc";
import { recordAudit } from "../utils/audit";
import { toTRPCError } from "../utils/error";
import { makeEventId } from "../utils/event-id";
import { redactEventData } from "../utils/redaction";
import { type ReasonTrace, workflowProvenance } from "../workflow/provenance";

// Feature flag for runtime migration (Phase 3.3)
configureLinearMetrics({
  linearActivityEmissionsTotal,
  linearActivityDurationSeconds,
  linearSessionOperationsTotal,
});

// Configure Codex-Linear metrics
(async () => {
  try {
    const { configureCodexLinearMetrics } = await import(
      "@alfred/agent/orchestrator/tool/codex-linear"
    );
    const { sessionManager } = await import(
      "@alfred/agent/orchestrator/codex-session"
    );
    configureCodexLinearMetrics({
      startTimer: (labels: { event_type: string }) =>
        codexLinearIntegrationLatencySeconds.startTimer(labels),
    });
    sessionManager.configureContinuityMetrics((status) => {
      codexSessionContinuityTotal.inc({ status });
    });
  } catch (error) {
    logger.warn("codex_linear_metrics_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
})();

function coerceRecord(val: unknown): Record<string, unknown> {
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

export const workflowRouter: ReturnType<typeof router> = router({
  start: authedProcedure
    .use(rateLimit)
    .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResource(raw)))
    .input(workflowInput)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      // Enforce obligations for medium/high autonomy workflows
      if (input.auto === "medium" || input.auto === "high") {
        ensureObligations(ctx);
      }

      try {
        const abortController = new AbortController();

        // Create executor (runtime or runner based on feature flag)
        // For start mutation, we don't pass history as it's a fresh run
        const executor = createWorkflowExecutor(input, abortController);

        // Create durable run row now so clients may hydrate history
        const storedInput = {
          ...(input as any),
          executionId: executor.runId,
          reasoningSince: Date.now(),
        };

        await workflowRepo.createRun({
          id: executor.runId,
          userId: session.user.id,
          workflowId: "plan",
          status: "running",
          inputData: storedInput,
          linearSessionId: input.linear?.sessionId,
          linearSpace: input.linear?.space,
        });

        try {
          const { conversation, created } = await ensureWorkflowConversation({
            userId: session.user.id,
            workflowId: executor.runId,
            title: deriveWorkflowTitle(input.requirement),
          });
          if (created) {
            const persisted = await persistWorkflowMessages({
              userId: session.user.id,
              conversationId: conversation.id,
              messages: [createRequirementMessage(input, executor.runId)],
              persistedKeys: new Set(),
              runId: executor.runId,
              eventType: "workflow.requirement",
              eventId: executor.runId,
            });
            if (persisted > 0) {
              triggerPreferenceRefresh(session.user.id, {
                reason: "workflow_requirement",
              });
            }
          }
        } catch (error) {
          logger.warn("workflow_conversation_init_failed", {
            runId: executor.runId,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Best-effort audit of start
        await recordAudit({
          userId: session.user.id,
          action: "workflow.start",
          resource: { kind: "workflow", id: executor.runId },
          decision: "allow",
          context: { auto: input.auto, mode: input.mode },
        });

        // Register for cancellation (interface identical for both)
        await runRegistry.register(executor.runId, {
          resume: async ({ resumeData }) => {
            await executor.resume(resumeData);
          },
          cancel: async () => {
            executor.cancel();
          },
          abortController,
        });

        return {
          runId: executor.runId,
          summary: executor.summary,
          results: [],
          plan: null,
          vcs: null,
          report: null,
          planArtifact: null,
          ticketId: input.linear?.sessionId ?? null,
          ticketUrl: null,
        };
      } catch (error) {
        throw toTRPCError(error, "workflow_start_failed");
      }
    }),

  stream: authedProcedure
    .use(rateLimit)
    .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResource(raw)))
    .input(workflowInput)
    .subscription(({ input, ctx }) =>
      observable<WorkflowEvent>((emit) => {
        const session = ctx.session;
        if (!session?.user?.id) {
          emit.error(
            new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
          );
          return () => {};
        }

        // Enforce obligations for medium/high autonomy workflows
        if (input.auto === "medium" || input.auto === "high") {
          try {
            ensureObligations(ctx);
          } catch (error) {
            emit.error(error);
            return () => {};
          }
        }

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
          emit.next(event);
        };

        const asyncTask = (async () => {
          let runId: string | null = null;
          const persistedMessageKeys = new Set<string>();
          let workflowConversationId: string | null = null;
          const useRuntime = shouldUseWorkflowRuntime();
          const reasonTraces: ReasonTrace[] = [];

          const refreshPreferences = (reason: string) =>
            triggerPreferenceRefresh(session.user.id, { reason });

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
            emit.complete();
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
            // We don't emit error or complete, just end stream?
            // If we emit complete, the client might think it's done.
            // But trpc subscription ending usually means "done" or "connection closed".
            // Client handles status update via "notice" or separate query.
            if (!timerClosed) {
              recordEvent("complete"); // Use complete for metric or add suspended?
              closeTimer("ok");
            }
            emit.complete();
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
              // Continue without throwing
            }
            recordEvent("complete");
            closeTimer("ok");
            emit.complete();
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
            // Recovery Logic:
            // If runId is provided, we are resuming/recovering.
            // We need to fetch history first.
            let history: WorkflowEvent[] | undefined;
            if (runId) {
              const events = await workflowRepo.listEvents(runId);
              // listEvents returns newest first (desc). Reverse for chronological replay.
              history = events.reverse().map((e) => ({
                ...(e.eventData as object),
                type: e.eventType,
              })) as WorkflowEvent[];

              // Check if run is already completed/cancelled?
              // If so, we might just want to replay events to client (replay query does this).
              // But if user wants to RESUME execution, we proceed.
              // Assuming caller knows what they are doing by calling stream with runId on a non-terminal run.
            }

            // Create executor (runtime or runner based on feature flag)
            const executor = createWorkflowExecutor(
              input,
              abortController,
              history
            );

            // Run is created *before* executor starts
            // This is already handled above in `createRun`? No wait.
            // We need `executor.runId` only if `runId` was null.

            if (runId) {
              // Resume case
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
              });
            }

            try {
              const { conversation, created } =
                await ensureWorkflowConversation({
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
            // Audit stream start (best-effort)
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

            // Helper to normalize certain events to UIMessage parts for byte-equal replay
            const maybeUiMessages = (
              event: WorkflowEvent
            ): UIMessage[] | null => {
              const msgs = eventToUiMessages(event);
              return Array.isArray(msgs) && msgs.length > 0 ? msgs : null;
            };

            // Consume the generator, persisting each event then pushing to client
            for await (const event of executor.stream) {
              try {
                // Multi-agent observability hooks
                if (
                  (event as any).kind === "data-subtasks" &&
                  Array.isArray((event as any).data)
                ) {
                  multiAgentTasksTotal.inc(
                    { status: "created" },
                    (event as any).data.length || 1
                  );
                } else if ((event as any).kind === "data-wave-plan") {
                  multiAgentWavesTotal.inc({ status: "started" });
                } else if ((event as any).kind === "wave-result") {
                  const data = (event as any).data || {};
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
                      agent.role && agent.role.length > 0
                        ? agent.role
                        : "worker";
                    const rawStatus = agent.status;
                    const outcome: "ok" | "error" | "stuck" =
                      rawStatus === "stuck" || agent.stuck
                        ? "stuck"
                        : rawStatus === "failed"
                          ? "error"
                          : "ok";

                    const dur = agent.durationSeconds;
                    if (
                      typeof dur === "number" &&
                      Number.isFinite(dur) &&
                      dur >= 0
                    ) {
                      multiAgentAgentDurationSeconds.observe(
                        { role, outcome },
                        dur
                      );
                    }

                    if (outcome !== "ok") {
                      multiAgentErrorsTotal.inc({ kind: "stuck_agent" });
                    }
                  }
                } else if ((event as any).kind === "wave-aborted") {
                  multiAgentErrorsTotal.inc({ kind: "wave_aborted" });
                } else if ((event as any).kind === "merge-conflict") {
                  multiAgentErrorsTotal.inc({ kind: "merge_conflict" });
                } else if ((event as any).kind === "merge-plan") {
                  multiAgentTasksTotal.inc({ status: "merged" });
                } else if ((event as any).kind === "review-plan") {
                  multiAgentTasksTotal.inc({ status: "review" });
                } else if (
                  (event as any).kind === "merge-agent-result" ||
                  (event as any).kind === "review-agent-result" ||
                  (event as any).kind === "conflict-agent-result" ||
                  (event as any).kind === "conflict-resolution-result" ||
                  (event as any).kind === "review-exec-result"
                ) {
                  const data = (event as any).data || {};
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
                  if (
                    typeof dur === "number" &&
                    Number.isFinite(dur) &&
                    dur >= 0
                  ) {
                    multiAgentAgentDurationSeconds.observe(
                      { role, outcome },
                      dur
                    );
                  }
                  if (outcome !== "ok") {
                    const kind =
                      (event as any).kind === "merge-agent-result"
                        ? "merge_failed"
                        : (event as any).kind === "review-agent-result"
                          ? "review_failed"
                          : (event as any).kind === "conflict-agent-result"
                            ? "merge_conflict_analysis_failed"
                            : (event as any).kind ===
                                "conflict-resolution-result"
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
                // Redact PII/secrets before persistence
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

                // If the event can be represented as UIMessage(s), persist a normalized copy
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
                if (
                  workflowConversationId &&
                  uiMessages &&
                  uiMessages.length > 0
                ) {
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
                // Push event including its identity for client-side dedupe
                push({ ...event, eventId } as WorkflowEvent);

                // Detect suspension
                if (
                  event.type === "notice" &&
                  (event as any).message === "workflow_suspended"
                ) {
                  suspended = true;
                }

                // Emit Linear activities for significant events (backup if runner doesn't emit)
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
                      error:
                        error instanceof Error ? error.message : String(error),
                    });
                  });
                }
              } catch (error) {
                logger.warn("workflow_event_persistence_failed", {
                  runId,
                  eventType: getEventType(event),
                  error: error instanceof Error ? error.message : String(error),
                });
                // Continue streaming without throwing
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
            emit.error(toTRPCError(error, "workflow_error"));
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
              // Continue without throwing
            }
          }
        })();

        asyncTask.catch((error) => emit.error(toTRPCError(error)));

        return () => {
          cancelled = true;
          abortController.abort();
          if (!timerClosed) {
            recordEvent("cancel");
            closeTimer("cancel");
          }
        };
      })
    ),

  resume: authedProcedure
    .use(rateLimit)
    .input(
      z.object({
        runId: z.string().min(1),
        event: z.enum(["deploy-authz", "linear-authz", "bio-authz"]),
        authz: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await runRegistry.dispatchResume(input.runId, {
        event: input.event,
        authz: input.authz,
      });

      if (!delivered) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      // Best-effort audit
      await recordAudit({
        userId: null,
        action: "workflow.resume",
        resource: { kind: "workflow", id: input.runId },
        decision: "allow",
        context: { event: input.event },
      });
      return { ok: true };
    }),

  // Return durable run metadata
  get: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input }) => {
      const run = await workflowRepo.getRun(input.runId);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      return run;
    }),

  // Return durable events for a run (newest first)
  events: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input }) => {
      const events = await workflowRepo.listEvents(input.runId);
      return events;
    }),

  reasoning: authedProcedure
    .use(requirePolicy("workflow.read", (raw) => mapWorkflowRunResource(raw)))
    .input(
      z.object({
        runId: z.string().min(1),
        limit: z.number().int().min(1).max(2000).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const run = await workflowRepo.getRun(input.runId);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }

      if (run.userId !== session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "access_denied" });
      }

      const inputData = coerceRecord(run.inputData ?? {});
      const resource =
        typeof inputData.cw === "string" && inputData.cw.length > 0
          ? inputData.cw
          : typeof inputData.workspace === "string" &&
              inputData.workspace.length > 0
            ? inputData.workspace
            : process.cwd();

      const executionId =
        typeof inputData.executionId === "string" &&
        inputData.executionId.length > 0
          ? inputData.executionId
          : run.id;

      const since =
        typeof inputData.reasoningSince === "number"
          ? inputData.reasoningSince
          : run.created instanceof Date
            ? run.created.getTime()
            : undefined;

      const { getReasoningChain } = await import("@alfred/db/repo/graph");
      const { reconstructReasoningChain } = await import(
        "@alfred/knowledge/query"
      );
      const { memoryNodes } = await import("@alfred/db/schema/graph");
      const { db } = await import("@alfred/db");

      const limit = input.limit;
      const initialArgs = {
        resource,
        executionId,
        since,
        limit,
      } as const;

      let { nodes, edges } = await getReasoningChain(initialArgs);

      if (nodes.length === 0 && executionId) {
        ({ nodes, edges } = await getReasoningChain({
          resource,
          since,
          limit,
        }));
      }

      const nodeRecords: ReasoningNodeRecord[] = nodes.map((node) => ({
        id: node.id,
        hash: node.hash,
        label: node.label,
        properties: (node.properties as Record<string, unknown> | null) ?? null,
      }));

      const edgeRecords: ReasoningEdgeRecord[] = edges.map((edge) => ({
        fromId: edge.fromId,
        toId: edge.toId,
        kind: edge.kind,
        metadata: (edge.metadata as Record<string, unknown> | null) ?? null,
      }));

      const chain = reconstructReasoningChain(nodeRecords, edgeRecords);

      // Best-effort provenance enrichment: gather distinct ragDocumentIds
      // referenced by reasoning nodes and load their rag_document labels.
      const docIds = new Set<string>();
      for (const node of nodes) {
        const props = (node.properties ?? null) as Record<
          string,
          unknown
        > | null;
        const ids = Array.isArray(props?.ragDocumentIds)
          ? (props?.ragDocumentIds as unknown[])
          : [];
        for (const raw of ids) {
          if (typeof raw === "string" && raw.length > 0) {
            docIds.add(raw);
          }
        }
      }

      let documents: Array<{ documentId: string; label: string }> = [];
      if (docIds.size > 0) {
        const rows = await db
          .select({
            label: memoryNodes.label,
            properties: memoryNodes.properties,
          })
          .from(memoryNodes)
          .where(
            and(
              eq(memoryNodes.kind, "rag_document"),
              eq(memoryNodes.resource, "user")
            )
          );

        documents = rows
          .map((row) => {
            const props = (row.properties ?? null) as Record<
              string,
              unknown
            > | null;
            const documentId = props?.documentId;
            return typeof documentId === "string" && docIds.has(documentId)
              ? { documentId, label: row.label }
              : null;
          })
          .filter(
            (entry): entry is { documentId: string; label: string } =>
              entry !== null
          );
      }

      return {
        runId: run.id,
        resource,
        executionId,
        chain,
        provenance: {
          ragDocuments: documents,
        },
      };
    }),

  /**
   * List workflow runs with optional filtering by status
   */
  listRuns: authedProcedure
    .input(
      z.object({
        status: z
          .enum(["running", "suspended", "completed", "failed", "cancelled"])
          .optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const runs = await workflowRepo.listRuns({
        userId: ctx.session.user.id,
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      });
      return runs;
    }),

  /**
   * Replay query: persisted events filtered by type in chronological order.
   * Default type is "ui-message" for assistant/orchestrator replays.
   */
  replay: authedProcedure
    .input(
      z.object({
        runId: z.string().min(1),
        eventType: z.string().optional().default("ui-message"),
        order: z.enum(["asc", "desc"]).optional(),
        page: z.number().int().min(0).optional(),
        pageSize: z.number().int().min(1).max(2000).optional(),
        includeTotal: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const stop = replayQueryDurationSeconds.startTimer({
        event_type: input.eventType,
      } as any);
      const items = await workflowRepo.listEventsByTypePaged({
        runId: input.runId,
        eventType: input.eventType,
        page: input.page ?? 0,
        pageSize: input.pageSize ?? 500,
        order: input.order,
      });
      const transformed = items.map((e) => ({
        eventId: (e as any).eventId,
        runId: e.runId,
        eventType: e.eventType,
        eventData: e.eventData,
        timestamp: (e as any).timestamp,
      }));
      let total: number | undefined;
      if (input.includeTotal) {
        total = await workflowRepo.countEventsByType(
          input.runId,
          input.eventType
        );
      }
      const page = input.page ?? 0;
      const pageSize = input.pageSize ?? 500;
      const hasMore =
        transformed.length === pageSize &&
        (total === undefined || (page + 1) * pageSize < total);
      try {
        replayQueriesTotal.inc({ event_type: input.eventType } as any);
      } finally {
        stop();
      }
      return { items: transformed, page, pageSize, total, hasMore };
    }),
});
