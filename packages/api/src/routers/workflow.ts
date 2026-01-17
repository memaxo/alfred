import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import {
  codexLinearActivitiesDroppedTotal,
  codexLinearActivitiesEmittedTotal,
  codexLinearActivityBatchesTotal,
  codexLinearIntegrationLatencySeconds,
  codexSessionContinuityTotal,
} from "@alfred/api/metrics";
import { ensureMirrorNodes } from "@alfred/db/repo/graph/write";
import * as workflowRepo from "@alfred/db/repo/workflow";
import type {
  ReasoningEdgeRecord,
  ReasoningNodeRecord,
} from "@alfred/knowledge/query";
import { logger } from "@alfred/logger";
import type { Obligation, WorkflowEvent } from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { PolicyObligationError } from "../errors";
import { requirePolicy } from "../gate";
import { triggerPreferenceRefresh } from "../preference/refresh";
import { authedProcedure, rateLimit, router } from "../trpc";
import { toTRPCError } from "../utils/error";
import { enforceWorkflowPlanPolicy } from "../workflow/access";
import { createWorkflowSuspension } from "../workflow/suspension";

const requiresBiometric = (obligations: Obligation[]): boolean =>
  obligations.some(
    (obligation) =>
      obligation.type === "biometric" ||
      (typeof obligation.metadata?.code === "string" &&
        obligation.metadata.code === "requireBio")
  );

let workflowMetricsInit = false;
async function initWorkflowMetrics(): Promise<void> {
  if (workflowMetricsInit) {
    return;
  }
  workflowMetricsInit = true;
  try {
    const [{ configureLinearMetrics }, metrics] = await Promise.all([
      import("@alfred/agent/orchestrator/linearmetrics"),
      import("@alfred/agent/workflow/metrics"),
    ]);
    configureLinearMetrics({
      linearActivityEmissionsTotal: metrics.linearActivityEmissionsTotal,
      linearActivityDurationSeconds: metrics.linearActivityDurationSeconds,
      linearSessionOperationsTotal: metrics.linearSessionOperationsTotal,
    });
  } catch (error) {
    logger.warn("workflow_linear_metrics_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const [{ configureCodexLinearMetrics }, { sessionManager }] =
      await Promise.all([
        import("@alfred/agent/orchestrator/tool/codex-linear"),
        import("@alfred/agent/orchestrator/codex-session"),
      ]);
    configureCodexLinearMetrics({
      histogram: codexLinearIntegrationLatencySeconds,
      activitiesEmitted: codexLinearActivitiesEmittedTotal,
      activitiesDropped: codexLinearActivitiesDroppedTotal,
      activityBatches: codexLinearActivityBatchesTotal,
    });
    sessionManager.configureContinuityMetrics(
      (status: "success" | "failure") => {
        codexSessionContinuityTotal.inc({ status });
      }
    );
  } catch (error) {
    logger.warn("codex_linear_metrics_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function mapWorkflowResourceLocal(raw: unknown) {
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id =
    typeof input.projectId === "string" && input.projectId.length > 0
      ? input.projectId
      : "default";
  return { kind: "workflow" as const, id, attrs: { scope: "self" } };
}

function mapWorkflowRunResourceLocal(raw: unknown) {
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id =
    typeof input.runId === "string" && input.runId.length > 0
      ? input.runId
      : "unknown";
  return { kind: "workflow.run" as const, id, attrs: { scope: "self" } };
}

const workflowInputDataSchema = z.record(z.string(), z.unknown());

export function parseWorkflowInputData(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) {
    return {};
  }
  const result = workflowInputDataSchema.safeParse(val);
  if (!result.success) {
    // Log warning but return empty object for backward compatibility
    // Invalid data will be handled gracefully downstream
    return {};
  }
  return result.data;
}

const workflowInputSchema = z
  .object({
    requirement: z.string().min(1),
    auto: z.enum(["read", "low", "medium", "high"]).optional(),
    mode: z.string().optional(),
    projectId: z.string().optional(),
    planId: z.string().optional(),
    runId: z.string().optional(),
    linear: z.unknown().optional(),
    authzLinear: z.string().optional(),
  })
  .passthrough();

export const workflowRouter = router({
  start: authedProcedure
    .use(rateLimit)
    .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResourceLocal(raw)))
    .input(workflowInputSchema)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      await initWorkflowMetrics();
      const { workflowInput } = await import("@alfred/agent/workflow/schema");
      const workflow = workflowInput.parse(input) as WorkflowInputPayload;

      // Enforce obligations for medium/high autonomy workflows
      if (workflow.auto === "medium" || workflow.auto === "high") {
        const obligations = ctx.policy?.obligations ?? [];
        if (obligations.length > 0 && requiresBiometric(obligations)) {
          throw new PolicyObligationError("workflow.plan", obligations, {
            reason: "workflow_autonomy",
            auto: workflow.auto,
          });
        }
      }

      try {
        const [
          { ensureLinearTicket },
          {
            createRequirementMessage,
            createWorkflowExecutor,
            deriveWorkflowTitle,
            ensureWorkflowConversation,
            persistWorkflowMessages,
          },
          { recordAudit },
          { registerRunHandle },
        ] = await Promise.all([
          import("@alfred/agent/workflow/linear"),
          import("@alfred/agent/workflow/services"),
          import("@alfred/agent/utils/audit"),
          import("@alfred/agent/workflow/session-recovery"),
        ]);

        const abortController = new AbortController();
        const { linear: preparedLinear, ticket } = await ensureLinearTicket({
          linear: workflow.linear,
          authzLinear: workflow.authzLinear,
          requirement: workflow.requirement,
        });
        const workflowPayload = {
          ...workflow,
          linear: preparedLinear,
        } as typeof workflow;

        const executor = await createWorkflowExecutor(
          // biome-ignore lint/suspicious/noExplicitAny: Internal payload compatibility
          workflowPayload as any,
          abortController,
          undefined,
          ctx.runtimeContext
        );

        const storedInput: Record<string, unknown> = {
          ...workflowPayload,
          executionId: executor.runId,
          reasoningSince: Date.now(),
        };
        const linearIssueId =
          preparedLinear?.issueId ?? preparedLinear?.sessionId ?? undefined;
        const linearIssueUrl =
          ticket?.issueUrl ?? preparedLinear?.issueUrl ?? undefined;

        await workflowRepo.createRun({
          id: executor.runId,
          userId: session.user.id,
          projectId: workflow.projectId,
          planId: workflow.planId,
          requirement: workflow.requirement,
          workflowId: "plan",
          status: "running",
          inputData: storedInput,
          linearSessionId: preparedLinear?.sessionId,
          linearSpace: preparedLinear?.space,
          linearIssueId,
          linearIssueUrl,
        });

        // Trigger Linear metadata sync if project is associated
        if (workflow.projectId) {
          const projectId = workflow.projectId;
          void (async () => {
            const url = process.env.DATABASE_URL;
            if (url && !url.startsWith("sqlite")) {
              await import("@alfred/db/repo/project")
                .then((repo) => repo.updateProjectLastActive(projectId))
                .catch(() => {});
            }
            const { syncOnWorkflowStart } = await import("@alfred/plan");
            await syncOnWorkflowStart(projectId as string, executor.runId);
          })();
        }

        await ensureMirrorNodes(
          "user",
          [
            {
              kind: "workflow_run",
              id: executor.runId,
              label: deriveWorkflowTitle(workflowPayload.requirement),
              properties: {
                entity: { kind: "workflow_run", id: executor.runId },
                workflowId: "plan",
                status: "running",
                linearIssueId,
                linearIssueUrl,
              },
            },
          ],
          { projectId: workflow.projectId ?? undefined }
        );

        try {
          const { conversation, created } = await ensureWorkflowConversation({
            userId: session.user.id,
            workflowId: executor.runId,
            title: deriveWorkflowTitle(workflowPayload.requirement),
            projectId: workflow.projectId,
          });
          if (created) {
            const persisted = await persistWorkflowMessages({
              userId: session.user.id,
              conversationId: conversation.id,
              messages: [
                createRequirementMessage(workflowPayload, executor.runId),
              ],
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

        await recordAudit({
          userId: session.user.id,
          projectId: workflow.projectId ?? undefined,
          action: "workflow.start",
          resource: { kind: "workflow", id: executor.runId },
          decision: "allow",
          context: { auto: workflow.auto, mode: workflow.mode },
        });

        await registerRunHandle(executor.runId, {
          resume: async ({ resumeData }: { resumeData: unknown }) => {
            await executor.resume(resumeData);
          },
          // biome-ignore lint/suspicious/useAwait: Cancel is synchronous or returns a promise
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
          ticketId: linearIssueId,
          ticketUrl: linearIssueUrl,
        };
      } catch (error) {
        throw toTRPCError(error, "workflow_start_failed");
      }
    }),

  stream: authedProcedure
    .use(rateLimit)
    .input(workflowInputSchema)
    .subscription(({ input, ctx }) =>
      observable<WorkflowEvent>((emit) => {
        const session = ctx.session;
        if (!session?.user?.id) {
          emit.error(
            new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
          );
          return () => {};
        }

        let cleanup: (() => void) | undefined;

        const startWorkflow = async (options: {
          obligations: Obligation[];
          runId?: string;
        }) => {
          await initWorkflowMetrics();
          const [
            { orchestrateWorkflowStream },
            { ensureObligations },
            { workflowInput },
          ] = await Promise.all([
            import("@alfred/agent/workflow/orchestrator"),
            import("@alfred/agent/workflow/services"),
            import("@alfred/agent/workflow/schema"),
          ]);

          const callbacks = {
            triggerPreferenceRefresh,
            ensureObligations: (ctx: unknown) => {
              ensureObligations(
                ctx as { policy?: { obligations: Obligation[] } }
              );
            },
            context: { ...ctx, policy: { obligations: options.obligations } },
            emitError: (error: unknown) => {
              emit.error(toTRPCError(error, "workflow_execution_error"));
            },
            emitNext: (event: WorkflowEvent) => emit.next(event),
            emitComplete: () => emit.complete(),
            // biome-ignore lint/suspicious/noExplicitAny: Internal callback compatibility
          } as any;

          const payload = options.runId
            ? // biome-ignore lint/suspicious/noExplicitAny: Payload contains defaults from Zod
              (workflowInput.parse({ ...input, runId: options.runId }) as any)
            : // biome-ignore lint/suspicious/noExplicitAny: Payload contains defaults from Zod
              (workflowInput.parse(input) as any);
          cleanup = await orchestrateWorkflowStream(
            payload,
            session,
            callbacks
          );
        };

        const suspension = createWorkflowSuspension({
          sessionUserId: session.user.id,
          // biome-ignore lint/suspicious/noExplicitAny: Input schema compatibility
          input: input as any,
          transport: "trpc",
          auditContext: {
            auto: input.auto ?? "low",
            mode: input.mode ?? "sequential",
          },
          // biome-ignore lint/suspicious/useAwait: Emit is called asynchronously but doesn't need await here
          emitObligation: async ({ runId, obligations, resumeEvents }) => {
            emit.next({
              _: "obligation",
              runId,
              obligations,
              resumeEvents,
            } as WorkflowEvent);
          },
          policyCheck: async () => {
            const { obligations } = await enforceWorkflowPlanPolicy({
              session,
              input: {
                ...input,
                auto: input.auto ?? "low",
                mode:
                  (input.mode as
                    | "sequential"
                    | "parallel"
                    | null
                    | undefined) ?? "sequential",
              } as WorkflowInputPayload,
            });
            return obligations;
          },
          startWorkflow: ({ runId, obligations }) =>
            startWorkflow({ runId, obligations }),
          onError: (error, _info) => {
            emit.error(toTRPCError(error, "workflow_suspension_error"));
          },
        });

        const startStream = async () => {
          try {
            const { obligations } = await enforceWorkflowPlanPolicy({
              session,
              input: {
                ...input,
                auto: input.auto ?? "low",
                mode:
                  (input.mode as
                    | "sequential"
                    | "parallel"
                    | null
                    | undefined) ?? "sequential",
              } as WorkflowInputPayload,
            });

            if (obligations.length > 0) {
              await suspension.suspend(obligations);
              return;
            }

            await startWorkflow({ obligations });
          } catch (error) {
            emit.error(toTRPCError(error, "workflow_start_failed"));
          }
        };

        void startStream();

        return () => {
          cleanup?.();
          void suspension.dispose();
        };
      })
    ),

  resume: authedProcedure
    .use(rateLimit)
    .input(
      z.object({
        runId: z.string().min(1),
        clarificationId: z.string().uuid().optional(), // New: resume from clarification
        response: z.string().optional(), // New: response to clarification
        event: z
          .enum([
            "deploy-authz",
            "linear-authz",
            "bio-authz",
            "mfa-authz",
            "human-authz",
          ])
          .optional(),
        authz: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      // Handle clarification resume
      if (input.clarificationId && input.response) {
        try {
          const { resumeWorkflowAfterClarification } = await import(
            "@alfred/runtime/orchestrator/resume"
          );
          await resumeWorkflowAfterClarification(
            input.runId,
            input.clarificationId,
            input.response
          );
          return { ok: true };
        } catch (error) {
          throw toTRPCError(error, "workflow_resume_failed");
        }
      }

      // Handle existing obligation resume
      if (input.event && input.authz) {
        try {
          const { runRegistry } = await import(
            "@alfred/agent/workflow/registry"
          );
          const delivered = await runRegistry.dispatchResume(input.runId, {
            event: input.event,
            authz: input.authz,
          });

          if (!delivered) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "run_not_found",
            });
          }
        } catch (error) {
          const { StreamNotAttachedError } = await import(
            "@alfred/agent/workflow/session-recovery"
          );
          if (error instanceof StreamNotAttachedError) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "stream_not_attached",
            });
          }
          throw toTRPCError(error, "workflow_resume_failed");
        }
        {
          const run = await workflowRepo.getRun(input.runId);
          const { recordAudit } = await import("@alfred/agent/utils/audit");
          await recordAudit({
            userId: session.user.id,
            projectId: run?.projectId ?? undefined,
            action: "workflow.resume",
            resource: { kind: "workflow", id: input.runId },
            decision: "allow",
            context: { event: input.event },
          });
        }
        return { ok: true };
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "invalid_resume_payload",
      });
    }),

  get: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input }) => {
      const run = await workflowRepo.getRun(input.runId);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      return run;
    }),

  cancel: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const run = await workflowRepo.getRun(input.runId);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      if (run.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "not_owner" });
      }
      if (run.status !== "running" && run.status !== "suspended") {
        return { cancelled: false, reason: "already_finished" };
      }
      // Cancel via registry if still active
      const { runRegistry } = await import("@alfred/agent/workflow/registry");
      const handle = (
        runRegistry as { runs?: Map<string, { cancel: () => void }> }
      ).runs?.get(input.runId);
      if (handle) {
        try {
          await handle.cancel();
        } catch {
          // Ignore cancel errors - run may have already completed
        }
      }
      // Update status in DB
      await workflowRepo.updateRun(input.runId, {
        status: "cancelled",
        completedAt: new Date(),
      });
      logger.info("workflow_cancelled", {
        runId: input.runId,
        userId: ctx.session.user.id,
      });
      return { cancelled: true };
    }),

  events: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input }) => {
      const events = await workflowRepo.listEvents(input.runId);
      return events;
    }),

  reasoning: authedProcedure
    .use(
      requirePolicy("workflow.read", (raw) => mapWorkflowRunResourceLocal(raw))
    )
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

      const inputData = parseWorkflowInputData(run.inputData);
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

      const graphRepoPkg = "@alfred/db/repo/graph";
      const { getReasoningChain } = await import(graphRepoPkg);
      const knowledgeQueryPkg = "@alfred/knowledge/query";
      const { reconstructReasoningChain } = await import(knowledgeQueryPkg);
      const graphSchemaPkg = "@alfred/db/schema/graph";
      const { memoryNodes } = await import(graphSchemaPkg);
      const dbPkg = "@alfred/db";
      const { db } = await import(dbPkg);

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

      const nodeRecords: ReasoningNodeRecord[] = nodes.map(
        (node: (typeof nodes)[number]) => ({
          id: node.id,
          hash: node.hash,
          label: node.label,
          properties:
            (node.properties as Record<string, unknown> | null) ?? null,
        })
      );

      const edgeRecords: ReasoningEdgeRecord[] = edges.map(
        (edge: (typeof edges)[number]) => ({
          fromId: edge.fromId,
          toId: edge.toId,
          kind: edge.kind,
          metadata: (edge.metadata as Record<string, unknown> | null) ?? null,
        })
      );

      const chain = reconstructReasoningChain(nodeRecords, edgeRecords);

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
          .map(
            (
              row: (typeof rows)[number]
            ): { documentId: string; label: string } | null => {
              const props = (row.properties ?? null) as Record<
                string,
                unknown
              > | null;
              const documentId = props?.documentId;
              return typeof documentId === "string" && docIds.has(documentId)
                ? { documentId, label: row.label }
                : null;
            }
          )
          .filter(
            (
              entry: { documentId: string; label: string } | null
            ): entry is { documentId: string; label: string } => entry !== null
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
      await initWorkflowMetrics();
      const [
        { replayQueriesTotal, replayQueryDurationSeconds },
        { unwrapEventEnvelope },
      ] = await Promise.all([
        import("@alfred/agent/workflow/metrics"),
        import("@alfred/agent/utils/envelope"),
      ]);
      let stop: (() => void) | null = null;
      try {
        stop = replayQueryDurationSeconds.startTimer({
          event_type: input.eventType,
        });
      } catch {
        stop = null;
      }
      const items = await workflowRepo.listEventsByTypePaged({
        runId: input.runId,
        eventType:
          input.eventType as import("@alfred/db/schema/workflow").WorkflowEventType,
        page: input.page ?? 0,
        pageSize: input.pageSize ?? 500,
        order: input.order,
      });
      const transformed = items.map((e) => ({
        eventId: e.eventId,
        runId: e.runId,
        eventType: e.eventType,
        eventData: unwrapEventEnvelope(e.eventData).data,
        timestamp: e.timestamp,
      }));
      let total: number | undefined;
      if (input.includeTotal) {
        total = await workflowRepo.countEventsByType(
          input.runId,
          input.eventType as import("@alfred/db/schema/workflow").WorkflowEventType
        );
      }
      const page = input.page ?? 0;
      const pageSize = input.pageSize ?? 500;
      const hasMore =
        transformed.length === pageSize &&
        (total === undefined || (page + 1) * pageSize < total);
      try {
        replayQueriesTotal.inc({ event_type: input.eventType });
      } finally {
        stop?.();
      }
      return { items: transformed, page, pageSize, total, hasMore };
    }),

  suspend: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { runRegistry } = await import("@alfred/agent/workflow/registry");
      const delivered = await runRegistry.dispatchSuspend(input.runId);
      if (delivered) {
        return { ok: true };
      }
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "run_not_found_or_not_suspendable",
      });
    }),

  resumePipeline: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .subscription(({ input, ctx }) =>
      observable<WorkflowEvent>((emit) => {
        const session = ctx.session;
        if (!session?.user?.id) {
          emit.error(
            new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
          );
          return () => {};
        }

        let cleanup: (() => void) | undefined;

        const startResume = async () => {
          try {
            const { PostgresCheckpointStorage } = await import(
              "@alfred/db/repo/workflow"
            );
            const storage = new PostgresCheckpointStorage();
            const snapshot = await storage.load(input.runId);
            if (!snapshot) {
              emit.error(
                new TRPCError({
                  code: "NOT_FOUND",
                  message: "no_checkpoint_found",
                })
              );
              return;
            }

            const { resumeWorkflowPipeline } = await import(
              "@alfred/runtime/workflow/pipeline-bridge"
            );
            const generator = resumeWorkflowPipeline(
              input.runId,
              snapshot as any, // Cast to any to avoid importing PipelineSnapshot here
              session
            );

            for await (const event of generator) {
              emit.next(event);
            }
            emit.complete();
          } catch (error) {
            emit.error(toTRPCError(error, "workflow_resume_failed"));
          }
        };

        void startResume();

        return () => {
          cleanup?.();
        };
      })
    ),
});
