import { randomUUID } from "node:crypto";
import { openai } from "@ai-sdk/openai";
import { emitLinearActivity } from "@alfred/agent/orchestrator/linear";
import { configureLinearMetrics } from "@alfred/agent/orchestrator/linearmetrics";
import {
  linearActivityDurationSeconds,
  linearActivityEmissionsTotal,
  linearSessionOperationsTotal,
  replayQueriesTotal,
  replayQueryDurationSeconds,
  workflowStreamDurationSeconds,
  workflowStreamEventsTotal,
} from "@alfred/api/metrics";
import * as conversationRepo from "@alfred/db/repo/conversation";
import * as workflowRepo from "@alfred/db/repo/workflow";
import type {
  ReasoningEdgeRecord,
  ReasoningNodeRecord,
} from "@alfred/knowledge/query";
import { createRuntime } from "@alfred/runtime";
import type { WorkflowEvent } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { eventToUiMessages } from "../ai/normalize";
import { requirePolicy } from "../gate";
import { runRegistry } from "../run-registry";
import { authedProcedure, rateLimit, router } from "../trpc";
import { recordAudit } from "../utils/audit";
import { toTRPCError } from "../utils/error";
import { makeEventId } from "../utils/event-id";
import { logger } from "../utils/logger";
import { redactEventData } from "../utils/redaction";
import { runPlanV6 } from "../workflow/runner";

// Feature flag for runtime migration (Phase 3.3)
configureLinearMetrics({
  linearActivityEmissionsTotal,
  linearActivityDurationSeconds,
  linearSessionOperationsTotal,
});

/**
 * Create workflow executor (runtime or runner based on feature flag)
 *
 * Returns unified interface matching RunPlanV6 for backward compatibility.
 * Phase 3.3: Conditional creation based on USE_WORKFLOW_RUNTIME flag.
 */
function shouldUseWorkflowRuntime(): boolean {
  return process.env.USE_WORKFLOW_RUNTIME === "true";
}

function createWorkflowExecutor(
  input: z.infer<typeof workflowInput>,
  abortController: AbortController
) {
  if (shouldUseWorkflowRuntime()) {
    // NEW: Use @alfred/runtime
    const model = openai(process.env.OPENAI_MODEL_PLAN ?? "gpt-4o");

    return createRuntime({
      input: {
        requirement: input.requirement,
        auto: input.auto,
        workspace: input.workspace,
        repoBase: input.repoBase,
        mode: input.mode,
        context: input.context,
        linear:
          input.linear?.sessionId && input.authzLinear
            ? {
                sessionId: input.linear.sessionId,
                space: input.linear.space,
                authz: input.authzLinear,
              }
            : undefined,
      },
      model,
      signal: abortController.signal,
      stepTimeoutMs: 5 * 60 * 1000,
      workflowTimeoutMs: 30 * 60 * 1000,
    });
  }
  // EXISTING: Use deprecated runPlanV6
  return runPlanV6(
    {
      requirement: input.requirement,
      auto: input.auto,
      workspace: input.workspace,
      repoBase: input.repoBase,
      mode: input.mode,
      context: input.context,
      ...(input.linear?.sessionId && input.authzLinear
        ? {
            linear: {
              sessionId: input.linear.sessionId,
              space: input.linear.space,
              authz: input.authzLinear,
            },
          }
        : {}),
    },
    {
      signal: abortController.signal,
      stepTimeoutMs: 5 * 60 * 1000,
      workflowTimeoutMs: 30 * 60 * 1000,
    }
  );
}

const workflowInput = z.object({
  requirement: z.string().min(1),
  auto: z.enum(["read", "low", "medium", "high"]).default("low"),
  authz: z.string().optional(),
  cw: z.string().optional(),
  mode: z.enum(["sequential", "parallel"]).default("sequential"),
  workspace: z.string().optional(),
  repoBase: z.string().optional(),
  profile: z.string().min(1).optional(),
  authzDeploy: z.string().optional(),
  authzLinear: z.string().optional(),
  preview: z
    .object({
      host: z.string().min(1),
      upstream: z.string().url().optional(),
      tls: z.boolean().optional(),
    })
    .optional(),
  previewBuild: z
    .object({
      context: z.string().min(1),
      dockerfile: z.string().optional(),
      image: z.string().optional(),
      port: z.number().int().min(1).max(65_535).optional(),
      env: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  promote: z
    .object({
      host: z.string().min(1),
      upstream: z.string().url(),
      tls: z.boolean().optional(),
    })
    .optional(),
  linear: z
    .object({
      space: z.string().min(1),
      teamId: z.string().optional(),
      sessionId: z.string().min(1),
    })
    .optional(),
  context: z
    .object({
      enable: z.boolean().optional(),
      web: z.boolean().optional(),
      topK: z.number().int().min(1).max(100).optional(),
      maxTokens: z.number().int().min(2000).max(200_000).optional(),
      exts: z.array(z.string()).optional(),
      ignore: z.array(z.string()).optional(),
      seeds: z.array(z.string().url()).optional(),
    })
    .optional(),
  userId: z.string().min(1).optional(),
  policyObligations: z.array(z.string()).optional(),
});

const mapWorkflowResource = (raw: unknown) => {
  const input = raw as Partial<z.infer<typeof workflowInput>>;
  return {
    kind: "workflow" as const,
    id: "plan",
    attrs: {
      auto: input?.auto ?? "read",
      mode: input?.mode ?? "sequential",
    },
  };
};

const mapWorkflowRunResource = (raw: unknown) => {
  const input = raw as { runId?: string };
  return {
    kind: "workflow" as const,
    id: input?.runId ?? "run",
    attrs: {},
  };
};

function ensureObligations(ctx: { policy?: { obligations: string[] } }) {
  if (ctx.policy?.obligations?.length) {
    const obligations = ctx.policy.obligations;
    if (obligations.includes("requireBio")) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "biometric_required",
        cause: obligations,
      });
    }
  }
}

type WorkflowInputPayload = z.infer<typeof workflowInput>;

function deriveWorkflowTitle(requirement: string): string | undefined {
  const trimmed = requirement.trim();
  if (!trimmed) {
    return undefined;
  }
  const limit = 80;
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit - 3)}...`;
}

function workflowMessageId(runId: string, suffix: string): string {
  return `workflow-${runId}-${suffix}`;
}

function createRequirementMessage(
  input: WorkflowInputPayload,
  runId: string
): UIMessage {
  return {
    id: workflowMessageId(runId, "requirement"),
    role: "user",
    parts: [{ type: "text", text: input.requirement }],
    metadata: {
      auto: input.auto,
      workspace: input.workspace ?? null,
      repoBase: input.repoBase ?? null,
      createdAt: new Date().toISOString(),
    },
  };
}

async function ensureWorkflowConversation(options: {
  userId: string;
  workflowId: string;
  title?: string;
}) {
  const existing = await conversationRepo.getConversationByWorkflow(
    options.userId,
    options.workflowId
  );
  if (existing) {
    return { conversation: existing, created: false };
  }

  try {
    const conversation = await conversationRepo.createConversation(
      options.userId,
      options.title,
      options.workflowId
    );
    return { conversation, created: true };
  } catch (error) {
    const fallback = await conversationRepo.getConversationByWorkflow(
      options.userId,
      options.workflowId
    );
    if (fallback) {
      return { conversation: fallback, created: false };
    }
    throw error;
  }
}

async function persistWorkflowMessages(options: {
  userId: string;
  conversationId: string;
  messages: UIMessage[];
  persistedIds: Set<string>;
  runId: string;
  baseId?: string;
}) {
  const { userId, conversationId, messages, persistedIds, runId, baseId } =
    options;
  for (let index = 0; index < messages.length; index += 1) {
    const original = messages[index]!;
    const derivedId = baseId
      ? `${baseId}:${index}`
      : typeof original.id === "string" && original.id.length > 0
        ? original.id
        : workflowMessageId(runId, randomUUID());

    if (persistedIds.has(derivedId)) {
      continue;
    }

    const normalized: UIMessage = {
      ...original,
      id: derivedId,
      parts: Array.isArray(original.parts) ? original.parts : [],
    };

    try {
      await conversationRepo.createMessage(
        userId,
        conversationId,
        normalized
      );
      persistedIds.add(derivedId);
    } catch (error) {
      logger.warn("workflow_message_persist_failed", {
        runId,
        conversationId,
        messageId: derivedId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
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
        const executor = createWorkflowExecutor(input, abortController);

        // Create durable run row now so clients may hydrate history
        const storedInput = {
          ...input,
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
            await persistWorkflowMessages({
              userId: session.user.id,
              conversationId: conversation.id,
              messages: [createRequirementMessage(input, executor.runId)],
              persistedIds: new Set(),
              runId: executor.runId,
            });
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
        let timerClosed = false;

        const stopStreamTimer = workflowStreamDurationSeconds.startTimer();
        const closeTimer = (status: "ok" | "error" | "cancel") => {
          if (timerClosed) return;
          stopStreamTimer({ status });
          timerClosed = true;
        };

        const recordEvent = (
          event: "run" | "chunk" | "progress" | "error" | "complete" | "cancel"
        ) => {
          workflowStreamEventsTotal.inc({ event });
        };

        const push = (event: WorkflowEvent) => {
          if (cancelled) return;
          recordEvent(event.type === "progress" ? "progress" : "chunk");
          emit.next(event);
        };

        const asyncTask = (async () => {
          let runId: string | null = null;
          const persistedMessageIds = new Set<string>();
          let workflowConversationId: string | null = null;
          try {
            // Create executor (runtime or runner based on feature flag)
            const executor = createWorkflowExecutor(input, abortController);

            const storedInput = {
              ...input,
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

            runId = executor.runId;
            try {
              const { conversation, created } =
                await ensureWorkflowConversation({
                  userId: session.user.id,
                  workflowId: runId,
                  title: deriveWorkflowTitle(input.requirement),
                });
              workflowConversationId = conversation.id;
              if (created) {
                await persistWorkflowMessages({
                  userId: session.user.id,
                  conversationId: conversation.id,
                  messages: [createRequirementMessage(input, runId)],
                  persistedIds: persistedMessageIds,
                  runId,
                });
              }
            } catch (error) {
              logger.warn("workflow_conversation_init_failed", {
                runId,
                error: error instanceof Error ? error.message : String(error),
              });
            }

            await runRegistry.register(runId, {
              resume: async ({ resumeData }) => {
                if (cancelled) return;
                await executor.resume(resumeData);
              },
              cancel: async () => {
                cancelled = true;
                executor.cancel();
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
                  await persistWorkflowMessages({
                    userId: session.user.id,
                    conversationId: workflowConversationId,
                    messages: uiMessages,
                    persistedIds: persistedMessageIds,
                    runId: runId ?? executor.runId,
                    baseId: eventId,
                  });
                }
                // Push event including its identity for client-side dedupe
                push({ ...event, eventId } as WorkflowEvent);

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

            // Mark completion
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
          } catch (error) {
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

      const inputData = (run.inputData ?? {}) as Record<string, unknown>;
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

      return {
        runId: run.id,
        resource,
        executionId,
        chain,
      };
    }),

  /**
   * List workflow runs with optional filtering by status
   */
  listRuns: authedProcedure
    .input(
      z.object({
        status: z.enum(["running", "suspended", "completed", "failed", "cancelled"]).optional(),
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
