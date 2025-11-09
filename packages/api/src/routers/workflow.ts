import * as workflowRepo from "@alfred/db/repo/workflow";
import type { WorkflowEvent } from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { requirePolicy } from "../gate";
import {
  workflowStreamDurationSeconds,
  workflowStreamEventsTotal,
} from "../metrics";
import { runRegistry } from "../run-registry";
import { authedProcedure, rateLimit, router } from "../trpc";
import { toTRPCError } from "../utils/error";
import { logger } from "../utils/logger";
import { redactEventData } from "../utils/redaction";
import { eventToUiMessages } from "../ai/normalize";
import { makeEventId } from "../utils/event-id";
import { recordAudit } from "../utils/audit";
import { runPlanV6 } from "../workflow/runner";
import {
  replayQueriesTotal,
  replayQueryDurationSeconds,
} from "../metrics";
import {
  setLinearDelegate,
  setLinearStarted,
  extractIssueIdFromSession,
  emitLinearActivity,
  setLinearSessionExternalUrl,
} from "@alfred/agent/orchestrator/linear";

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
      sessionId: z.string().optional(),
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

export const workflowRouter: ReturnType<typeof router> = router({
  start: authedProcedure
    .use(rateLimit)
    .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResource(raw)))
    .input(workflowInput)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session) {
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
        const runner = runPlanV6(
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
            stepTimeoutMs: 5 * 60 * 1000, // 5 minutes per step
            workflowTimeoutMs: 30 * 60 * 1000, // 30 minutes overall
          }
        );

        // Create durable run row now so clients may hydrate history
        await workflowRepo.createRun({
          id: runner.runId,
          userId: session.user.id,
          workflowId: "plan",
          status: "running",
          inputData: input,
          linearSessionId: input.linear?.sessionId,
          linearSpace: input.linear?.space,
        });

        // Best-effort audit of start
        await recordAudit({
          userId: session.user.id,
          action: "workflow.start",
          resource: { kind: "workflow", id: runner.runId },
          decision: "allow",
          context: { auto: input.auto, mode: input.mode },
        });

        // Initialize Linear session (delegate, state) - fire-and-forget
        if (input.linear?.sessionId && input.authzLinear) {
          const issueId = extractIssueIdFromSession(input.linear.sessionId);
          if (issueId) {
            setLinearDelegate({
              space: input.linear.space,
              issueId,
              authz: input.authzLinear,
            }).catch((error) => {
              logger.warn("linear_delegate_setup_failed", {
                runId: runner.runId,
                error: error instanceof Error ? error.message : String(error),
              });
            });

            setLinearStarted({
              space: input.linear.space,
              issueId,
              authz: input.authzLinear,
            }).catch((error) => {
              logger.warn("linear_started_setup_failed", {
                runId: runner.runId,
                error: error instanceof Error ? error.message : String(error),
              });
            });

            // Set external URL pointing to workflow run viewer
            const appUrl = process.env.VITE_APP_URL ?? process.env.APP_URL;
            if (appUrl) {
              const runUrl = `${appUrl}/orchestrator/run/${runner.runId}`;
              setLinearSessionExternalUrl(
                input.linear.sessionId,
                input.linear.space,
                input.authzLinear,
                runUrl
              ).catch((error) => {
                logger.warn("linear_session_external_url_failed", {
                  runId: runner.runId,
                  error: error instanceof Error ? error.message : String(error),
                });
              });
            }
          }
        }

        // Register for cancellation
        await runRegistry.register(runner.runId, {
          resume: async ({ resumeData }) => {
            await runner.resume(resumeData);
          },
          cancel: async () => {
            abortController.abort();
          },
          abortController,
        });

        return {
          runId: runner.runId,
          summary: runner.summary,
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
        if (!session) {
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
          try {
            const runner = runPlanV6(
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
                stepTimeoutMs: 5 * 60 * 1000, // 5 minutes per step
                workflowTimeoutMs: 30 * 60 * 1000, // 30 minutes overall
              }
            );

            await workflowRepo.createRun({
              id: runner.runId,
              userId: session.user.id,
              workflowId: "plan",
              status: "running",
              inputData: input,
              linearSessionId: input.linear?.sessionId,
              linearSpace: input.linear?.space,
            });

            // Initialize Linear session (delegate, state) - fire-and-forget
            if (input.linear?.sessionId && input.authzLinear) {
              const issueId = extractIssueIdFromSession(input.linear.sessionId);
              if (issueId) {
                setLinearDelegate({
                  space: input.linear.space,
                  issueId,
                  authz: input.authzLinear,
                }).catch((error) => {
                  logger.warn("linear_delegate_setup_failed", {
                    runId: runner.runId,
                    error: error instanceof Error ? error.message : String(error),
                  });
                });

                setLinearStarted({
                  space: input.linear.space,
                  issueId,
                  authz: input.authzLinear,
                }).catch((error) => {
                  logger.warn("linear_started_setup_failed", {
                    runId: runner.runId,
                    error: error instanceof Error ? error.message : String(error),
                  });
                });

                // Set external URL pointing to workflow run viewer
                const appUrl = process.env.VITE_APP_URL ?? process.env.APP_URL;
                if (appUrl) {
                  const runUrl = `${appUrl}/orchestrator/run/${runner.runId}`;
                  setLinearSessionExternalUrl(
                    input.linear.sessionId,
                    input.linear.space,
                    input.authzLinear,
                    runUrl
                  ).catch((error) => {
                    logger.warn("linear_session_external_url_failed", {
                      runId: runner.runId,
                      error: error instanceof Error ? error.message : String(error),
                    });
                  });
                }
              }
            }

            runId = runner.runId;
            await runRegistry.register(runId, {
              resume: async ({ resumeData }) => {
                if (cancelled) return;
                await runner.resume(resumeData);
              },
              cancel: async () => {
                cancelled = true;
                abortController.abort();
              },
              abortController,
            });
            // Audit stream start (best-effort)
            await recordAudit({
              userId: session.user.id,
              action: "workflow.stream",
              resource: { kind: "workflow", id: runId ?? runner.runId },
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
            const maybeUiMessages = (event: WorkflowEvent): unknown[] | null => {
              const msgs = eventToUiMessages(event);
              return Array.isArray(msgs) && msgs.length > 0 ? (msgs as unknown[]) : null;
            };

            // Consume the generator, persisting each event then pushing to client
            for await (const event of runner.stream) {
              try {
                // Redact PII/secrets before persistence
                const redactedEventData = redactEventData(event);
                const eventType = getEventType(event);
                const eventId = makeEventId({ runId, type: eventType, data: redactedEventData });
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
                    eventId: makeEventId({ runId, type: 'ui-message', data: uiMessages }),
                    eventType: 'ui-message',
                    eventData: uiMessages,
                  });
                }
                // Push event including its identity for client-side dedupe
                push({ ...event, eventId } as WorkflowEvent);

                // Emit Linear activities for significant events (backup if runner doesn't emit)
                if (input.linear?.sessionId && input.authzLinear) {
                  if (event.type === "error") {
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
      let total: number | undefined = undefined;
      if (input.includeTotal) {
        total = await workflowRepo.countEventsByType(
          input.runId,
          input.eventType
        );
      }
      const page = input.page ?? 0;
      const pageSize = input.pageSize ?? 500;
      const hasMore = transformed.length === pageSize && (total === undefined || (page + 1) * pageSize < total);
      try {
        replayQueriesTotal.inc({ event_type: input.eventType } as any);
      } finally {
        stop();
      }
      return { items: transformed, page, pageSize, total, hasMore };
    }),
});
