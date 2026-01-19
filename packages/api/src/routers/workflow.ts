import * as path from "node:path";
import { performance } from "node:perf_hooks";
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
import type {
  CheckpointStorage,
  PipelineEvent,
  PipelineSnapshot,
} from "@alfred/pipeline";
import { InMemoryCheckpointStorage } from "@alfred/pipeline/observers";
import {
  executePhaseInputSchema,
  phaseStatusSchema,
  planPhaseInputSchema,
  planPhaseOutputSchema,
} from "@alfred/pipeline/schemas";
import {
  isSerializable,
  type SerializableValue,
} from "@alfred/pipeline/snapshot";
import type { Obligation } from "@alfred/type";
import { workflowCompilationSchema } from "@alfred/type/compilation";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { PolicyObligationError } from "../errors";
import { requirePolicy } from "../gate";
import { triggerPreferenceRefresh } from "../preference/refresh";
import { CompilationObserver } from "../services/compilation";
import { upsertWorkflowPatternFromCompletion } from "../services/pattern";
import { authedProcedure, rateLimit, router } from "../trpc";
import { toTRPCError } from "../utils/error";
import { enforceWorkflowPlanPolicy } from "../workflow/access";

const requiresBiometric = (obligations: Obligation[]): boolean =>
  obligations.some(
    (obligation) =>
      obligation.type === "biometric" ||
      (typeof obligation.metadata?.code === "string" &&
        obligation.metadata.code === "requireBio")
  );

const isTestMode =
  process.env.VITE_TEST_MODE === "true" || process.env.MINDSCAPE_TEST === "1";

let memCheckpointStorage: InMemoryCheckpointStorage | null = null;
function getTestCheckpointStorage(): InMemoryCheckpointStorage {
  memCheckpointStorage ??= new InMemoryCheckpointStorage();
  return memCheckpointStorage;
}

const workflowPlanPolicy = requirePolicy("workflow.plan", (raw) =>
  mapWorkflowResourceLocal(raw)
);

const workflowExecutePolicy = requirePolicy("workflow.execute", (raw) =>
  mapWorkflowRunResourceLocal(raw)
);

const phasePlanProcedure = isTestMode
  ? authedProcedure.use(rateLimit)
  : authedProcedure.use(rateLimit).use(workflowPlanPolicy);

const phaseExecuteProcedure = isTestMode
  ? authedProcedure.use(rateLimit)
  : authedProcedure.use(rateLimit).use(workflowExecutePolicy);

class WorkflowCheckpointStorage implements CheckpointStorage {
  private readonly stageNameSchema = z.enum([
    "init",
    "context",
    "plan",
    "schedule",
    "execute",
    "review",
    "learn",
    "summarize",
  ] as const);

  private readonly snapshotSchema = z.object({
    runId: z.string().min(1),
    status: z.enum(["idle", "running", "suspended", "completed", "failed"]),
    requirement: z.string(),
    lastCompletedStage: z
      .enum([
        "init",
        "context",
        "plan",
        "schedule",
        "execute",
        "review",
        "learn",
        "summarize",
      ])
      .nullable(),
    lastCompletedStageIndex: z.number(),
    contextEntries: z.array(z.tuple([z.string(), z.unknown()])).optional(),
    stageResults: z
      .array(
        z.object({
          name: this.stageNameSchema,
          durationMs: z.number(),
          status: z.enum(["success", "failure", "skipped"]),
        })
      )
      .optional(),
    startedAt: z.number(),
    lastEventAt: z.number(),
    lastEventId: z.string().nullable(),
    error: z.string().nullable(),
  });

  constructor(
    private readonly inner: {
      save(runId: string, snapshot: unknown): Promise<void>;
      load(runId: string): Promise<unknown | null>;
      delete?(runId: string): Promise<void>;
    }
  ) {}

  async save(runId: string, snapshot: PipelineSnapshot): Promise<void> {
    await this.inner.save(runId, snapshot);
  }

  async load(runId: string): Promise<PipelineSnapshot | null> {
    const raw = await this.inner.load(runId);
    if (!raw) {
      return null;
    }
    const parsed = this.snapshotSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error("checkpoint_snapshot_invalid");
    }
    const contextEntries = parsed.data.contextEntries ?? [];
    const typedEntries: [string, SerializableValue][] = [];
    for (const [key, value] of contextEntries) {
      if (!isSerializable(value)) {
        throw new Error(`checkpoint_snapshot_nonserializable:${key}`);
      }
      typedEntries.push([key, value]);
    }
    return {
      ...(parsed.data as Omit<
        PipelineSnapshot,
        "contextEntries" | "stageResults"
      >),
      contextEntries: typedEntries,
      stageResults: parsed.data.stageResults ?? [],
    };
  }

  async delete(runId: string): Promise<void> {
    if (this.inner.delete) {
      await this.inner.delete(runId);
    }
  }
}

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

const linearInputSchema = z.object({
  space: z.string().min(1),
  teamId: z.string().optional(),
  sessionId: z.string().optional(),
  issueId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  issueUrl: z.string().optional(),
});

/**
 * Phase-level workflow APIs for staged execution control.
 * Enables plan preview, human-in-the-loop review, and staged execution.
 */
const workflowPhaseRouter = router({
  /**
   * Run init → context → plan → schedule stages only.
   * Returns WavePlan[] and snapshot for later execution.
   */
  plan: authedProcedure
    .use(rateLimit)
    .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResourceLocal(raw)))
    .input(planPhaseInputSchema)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const runId = input.runId ?? crypto.randomUUID();
      const startTime = performance.now();

      try {
        const [
          { PipelineRunner, registerDefaultStages },
          { CheckpointObserver, MetricsObserver, PipelineEventQueueObserver },
          { PostgresCheckpointStorage },
          {
            phasePlanRequestsTotal,
            phasePlanDurationSeconds,
            phasePlanPreviewsTotal,
            phaseCacheHitsTotal,
          },
          { getPlanCacheKey, getCachedPlan, cachePlan, computeFileTreeHash },
        ] = await Promise.all([
          import("@alfred/pipeline"),
          import("@alfred/pipeline/observers"),
          import("@alfred/db/repo/workflow"),
          import("@alfred/pipeline/metrics"),
          import("@alfred/pipeline/cache"),
        ]);

        const workspace = input.workspace ?? process.cwd();

        // Check cache
        const fileTreeHash = await computeFileTreeHash(workspace);
        const cacheKey = getPlanCacheKey({
          runId,
          requirement: input.requirement,
          workspace,
          fileTreeHash,
        });

        const cached = await getCachedPlan(cacheKey);
        if (cached) {
          phaseCacheHitsTotal.inc({ result: "hit" });
          phasePlanRequestsTotal.inc({ status: "cached" });
          const durationSec = (performance.now() - startTime) / 1000;
          phasePlanDurationSeconds.observe({ status: "cached" }, durationSec);
          return cached;
        }

        phaseCacheHitsTotal.inc({ result: "miss" });

        const { workflowRepo } = await import("@alfred/db");
        const { planRepo } = await import("@alfred/db");

        // Ensure a workflow run row exists before snapshots are persisted (FK).
        const existingRun = await workflowRepo.getRun(runId);
        if (!existingRun) {
          await workflowRepo.createRun({
            id: runId,
            userId: session.user.id,
            projectId: undefined,
            planId: undefined,
            requirement: input.requirement,
            workflowId: "pipeline",
            status: "running",
            inputData: {
              requirement: input.requirement,
              workspace,
              runId,
            },
            linearSessionId: input.linear?.sessionId,
            linearSpace: input.linear?.space,
            linearIssueId: input.linear?.issueId,
          });
        }

        const runner = new PipelineRunner({
          maxParallel: 1,
          enableLearning: false,
          enableLinearSync: false,
        });
        registerDefaultStages(runner);

        const storage = new WorkflowCheckpointStorage(
          isTestMode
            ? getTestCheckpointStorage()
            : new PostgresCheckpointStorage()
        );
        const queueObserver = new PipelineEventQueueObserver();
        runner.addObserver(queueObserver);
        runner.addObserver(new MetricsObserver());
        runner.addObserver(new CheckpointObserver(storage));

        const pipelineInput = {
          runId,
          requirement: input.requirement,
          workspace,
          userId: session.user.id,
          authz: input.authz,
          linear: input.linear
            ? {
                sessionId: input.linear.sessionId ?? "",
                space: input.linear.space,
                issueId: input.linear.issueId,
                authz: input.authzLinear ?? "",
              }
            : undefined,
        };

        // Run pipeline up to and including 'schedule' stage
        for await (const _event of runner.runUntilStage(
          pipelineInput,
          "schedule"
        )) {
          // Events are consumed; outputs stored in context by checkpoint observer
        }

        // Load the snapshot to get all outputs
        const snapshot = await storage.load(runId);
        if (!snapshot) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "snapshot_not_found_after_plan",
          });
        }

        const { createContextFromSnapshot } = await import(
          "@alfred/pipeline/snapshot"
        );
        const ctxDecoded = createContextFromSnapshot(snapshot, {
          emit: () => {},
        });

        const scheduleOutput = ctxDecoded.get("scheduleOutput") as {
          waves: Array<{
            id: string;
            agents: string[];
            dependsOn: string[];
            agentType?: string;
            phaseId?: string;
          }>;
          executionMode: "sequential" | "parallel";
          estimatedDuration: number;
        };
        const planOutput = ctxDecoded.get("planOutput") as {
          planId: string;
          structuredPlan: unknown;
          subtasks: Array<{
            id: string;
            title: string;
            requirement: string;
            deps: string[];
            priority: number;
            acceptance: string[];
            filesHint: string[];
          }>;
          execPlans: Map<string, string> | Record<string, string>;
          rootPlanPath: string;
        };
        const contextOutput = ctxDecoded.get("contextOutput") as {
          totalTokens?: number;
          ragChunks?: unknown[];
        };

        // Convert Map to record if needed
        const execPlansRecord: Record<string, string> = Object.fromEntries(
          planOutput.execPlans instanceof Map
            ? planOutput.execPlans
            : Object.entries(planOutput.execPlans)
        );

        const initOutput = ctxDecoded.get("initOutput") as
          | { projectId?: string }
          | undefined;

        // Persist/refresh plan row for approval gate and history.
        try {
          await planRepo.createPlan({
            id: planOutput.planId,
            userId: session.user.id,
            projectId:
              initOutput?.projectId && typeof initOutput.projectId === "string"
                ? initOutput.projectId
                : null,
            intent: input.requirement,
            plan: planOutput.structuredPlan,
            status: "pending",
          });
        } catch {
          await planRepo.updatePlan(planOutput.planId, {
            projectId:
              initOutput?.projectId && typeof initOutput.projectId === "string"
                ? initOutput.projectId
                : null,
            intent: input.requirement,
            plan: planOutput.structuredPlan,
            status: "pending",
          });
        }

        // Mark the run as awaiting approval.
        await workflowRepo.updateRun(runId, {
          status: "suspended",
          planId: planOutput.planId,
          projectId:
            initOutput?.projectId && typeof initOutput.projectId === "string"
              ? initOutput.projectId
              : null,
          requirement: input.requirement,
          suspendedAt: new Date(),
          resumedAt: null,
          completedAt: null,
        });

        const result = {
          runId,
          planId: planOutput.planId,
          structuredPlan: planOutput.structuredPlan,
          waves: scheduleOutput.waves,
          waveCount: scheduleOutput.waves.length,
          subtasks: planOutput.subtasks,
          execPlans: execPlansRecord,
          rootPlanPath: planOutput.rootPlanPath,
          executionMode: scheduleOutput.executionMode,
          estimatedDuration: scheduleOutput.estimatedDuration,
          snapshot: {
            runId: snapshot.runId,
            status: snapshot.status,
            requirement: snapshot.requirement,
            lastCompletedStage: snapshot.lastCompletedStage,
            lastCompletedStageIndex: snapshot.lastCompletedStageIndex,
            startedAt: snapshot.startedAt,
            lastEventAt: snapshot.lastEventAt,
            error: snapshot.error,
          },
          context: contextOutput
            ? {
                totalTokens: contextOutput.totalTokens ?? 0,
                ragChunkCount: Array.isArray(contextOutput.ragChunks)
                  ? contextOutput.ragChunks.length
                  : 0,
              }
            : undefined,
        };

        // Record metrics
        const durationSec = (performance.now() - startTime) / 1000;
        phasePlanRequestsTotal.inc({ status: "success" });
        phasePlanDurationSeconds.observe({ status: "success" }, durationSec);
        phasePlanPreviewsTotal.inc();

        const planResult = planPhaseOutputSchema.parse(result);

        // Cache the plan
        void cachePlan(cacheKey, planResult);

        return planResult;
      } catch (error) {
        // Record error metrics
        const durationSec = (performance.now() - startTime) / 1000;
        const { phasePlanRequestsTotal, phasePlanDurationSeconds } =
          await import("@alfred/pipeline/metrics");
        phasePlanRequestsTotal.inc({ status: "error" });
        phasePlanDurationSeconds.observe({ status: "error" }, durationSec);

        try {
          const { workflowRepo } = await import("@alfred/db");
          await workflowRepo.updateRun(runId, {
            status: "failed",
            completedAt: new Date(),
            errorMessage:
              error instanceof Error ? error.message : String(error),
          });
        } catch {
          // Best-effort.
        }

        throw toTRPCError(error, "workflow_phase_plan_failed");
      }
    }),

  /**
   * Execute a previously planned workflow.
   * Takes WavePlan[] and runs execute → review → learn → summarize.
   */
  execute: authedProcedure
    .use(rateLimit)
    .use(
      requirePolicy("workflow.execute", (raw) =>
        mapWorkflowRunResourceLocal(raw)
      )
    )
    .input(executePhaseInputSchema)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const startTime = performance.now();

      try {
        const [
          { PipelineRunner, registerDefaultStages },
          {
            CheckpointObserver,
            CostCleanupObserver,
            MetricsObserver,
            LinearSyncObserver,
          },
          { PostgresCheckpointStorage },
          { phaseExecuteRequestsTotal, phaseExecuteDurationSeconds },
        ] = await Promise.all([
          import("@alfred/pipeline"),
          import("@alfred/pipeline/observers"),
          import("@alfred/db/repo/workflow"),
          import("@alfred/pipeline/metrics"),
        ]);

        const storage = new WorkflowCheckpointStorage(
          isTestMode
            ? getTestCheckpointStorage()
            : new PostgresCheckpointStorage()
        );

        // Load existing snapshot
        const snapshot = await storage.load(input.runId);
        if (!snapshot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "snapshot_not_found",
          });
        }

        // Best-effort: mark run as running when executing.
        try {
          const { workflowRepo } = await import("@alfred/db");
          await workflowRepo.updateRun(input.runId, {
            status: "running",
            suspendedAt: null,
            resumedAt: new Date(),
            errorMessage: null,
          });
        } catch {
          // Ignore; execution should still proceed.
        }

        const runner = new PipelineRunner({
          enableLearning: true,
          enableLinearSync: Boolean(input.linear?.sessionId),
          linearSyncInterval: 30_000,
        });
        registerDefaultStages(runner);

        runner.addObserver(new MetricsObserver());
        runner.addObserver(new CostCleanupObserver());
        runner.addObserver(new CheckpointObserver(storage));
        runner.addObserver(
          new CompilationObserver({
            runId: input.runId,
            requirement: snapshot.requirement,
          })
        );

        if (input.linear?.sessionId && input.authzLinear) {
          runner.addObserver(
            new LinearSyncObserver({
              syncIntervalMs: 30_000,
              space: input.linear.space,
              issueId: input.linear.issueId ?? input.linear.sessionId,
              authz: input.authzLinear,
            })
          );
        }

        const pipelineInput = {
          runId: input.runId,
          requirement: snapshot.requirement,
          workspace: input.workspace,
          userId: input.userId ?? session.user.id,
          authz: input.authz,
          linear: input.linear
            ? {
                sessionId: input.linear.sessionId ?? "",
                space: input.linear.space,
                teamId: input.linear.teamId,
                issueId: input.linear.issueId,
                authz: input.authzLinear ?? "",
              }
            : undefined,
        };

        // Set partial execution params in snapshot context if provided
        if (input.waveIds || input.skipTaskIds || input.dryRun) {
          const updatedSnapshot = { ...snapshot };
          const contextMap = new Map(updatedSnapshot.contextEntries);

          if (input.waveIds) {
            contextMap.set("waveIds", input.waveIds);
          }
          if (input.skipTaskIds) {
            contextMap.set("skipTaskIds", input.skipTaskIds);
          }
          if (input.dryRun) {
            contextMap.set("dryRun", input.dryRun);
          }

          updatedSnapshot.contextEntries = Array.from(contextMap.entries());
          await storage.save(input.runId, updatedSnapshot);
        }

        // Reload snapshot with partial execution params
        const executionSnapshot = await storage.load(input.runId);
        if (!executionSnapshot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "snapshot_not_found",
          });
        }

        // Resume from the snapshot (will continue from execute stage)
        for await (const _event of runner.resume(
          executionSnapshot,
          pipelineInput
        )) {
          // Events are emitted to observers
        }

        // Load final snapshot
        const finalSnapshot = await storage.load(input.runId);

        const status = finalSnapshot?.status ?? "failed";

        if (finalSnapshot && status === "completed") {
          try {
            const { createContextFromSnapshot } = await import(
              "@alfred/pipeline/snapshot"
            );
            const ctxDecoded = createContextFromSnapshot(finalSnapshot, {
              emit: () => {},
            });
            const planOutput = ctxDecoded.get("planOutput") as
              | { structuredPlan?: unknown }
              | undefined;
            const initOutput = ctxDecoded.get("initOutput") as
              | { projectId?: string }
              | undefined;
            const plan = planOutput?.structuredPlan;

            const isRecord = (
              value: unknown
            ): value is Record<string, unknown> =>
              typeof value === "object" &&
              value !== null &&
              !Array.isArray(value);

            if (isRecord(plan)) {
              const phases = plan.phases;
              const resources = plan.resources;
              const evaluationCriteria = plan.evaluationCriteria;
              const intent =
                typeof plan.intent === "string" && plan.intent.length > 0
                  ? plan.intent
                  : finalSnapshot.requirement;

              if (phases && resources && evaluationCriteria) {
                await upsertWorkflowPatternFromCompletion({
                  userId: session.user.id,
                  projectId: initOutput?.projectId ?? null,
                  intent,
                  planTemplate: {
                    phases,
                    resources,
                    evaluationCriteria,
                  },
                  durationMs: Math.max(
                    0,
                    finalSnapshot.lastEventAt - finalSnapshot.startedAt
                  ),
                });
              }
            }
          } catch {
            // Best-effort.
          }
        }

        try {
          const { workflowRepo } = await import("@alfred/db");
          await workflowRepo.updateRun(input.runId, {
            status:
              status === "completed"
                ? "completed"
                : status === "suspended"
                  ? "suspended"
                  : "failed",
            suspendedAt: status === "suspended" ? new Date() : null,
            completedAt:
              status === "completed" || status === "failed" ? new Date() : null,
            errorMessage:
              status === "failed"
                ? (finalSnapshot?.error ?? "pipeline_failed")
                : null,
          });
        } catch {
          // Best-effort.
        }

        // Record metrics
        const durationSec = (performance.now() - startTime) / 1000;
        phaseExecuteRequestsTotal.inc({
          status: status === "completed" ? "success" : "error",
        });
        phaseExecuteDurationSeconds.observe(
          { status: status === "completed" ? "success" : "error" },
          durationSec
        );

        return {
          runId: input.runId,
          status,
          completed: status === "completed",
        };
      } catch (error) {
        // Record error metrics
        const durationSec = (performance.now() - startTime) / 1000;
        const { phaseExecuteRequestsTotal, phaseExecuteDurationSeconds } =
          await import("@alfred/pipeline/metrics");
        phaseExecuteRequestsTotal.inc({ status: "error" });
        phaseExecuteDurationSeconds.observe({ status: "error" }, durationSec);

        throw toTRPCError(error, "workflow_phase_execute_failed");
      }
    }),

  /**
   * Execute a workflow run by runId only.
   * Derives execute inputs from the persisted snapshot context.
   */
  executeByRunId: authedProcedure
    .use(rateLimit)
    .use(
      requirePolicy("workflow.execute", (raw) =>
        mapWorkflowRunResourceLocal(raw)
      )
    )
    .input(
      z.object({
        runId: z.string().min(1),
        waveIds: z.array(z.string()).optional(),
        skipTaskIds: z.array(z.string()).optional(),
        dryRun: z.boolean().optional(),
        authz: z.string().optional(),
        linear: linearInputSchema.optional(),
        authzLinear: z.string().optional(),
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

      const startTime = performance.now();

      try {
        const [
          { PipelineRunner, registerDefaultStages },
          {
            CheckpointObserver,
            CostCleanupObserver,
            MetricsObserver,
            LinearSyncObserver,
          },
          { PostgresCheckpointStorage },
          { phaseExecuteRequestsTotal, phaseExecuteDurationSeconds },
        ] = await Promise.all([
          import("@alfred/pipeline"),
          import("@alfred/pipeline/observers"),
          import("@alfred/db/repo/workflow"),
          import("@alfred/pipeline/metrics"),
        ]);

        const storage = new WorkflowCheckpointStorage(
          new PostgresCheckpointStorage()
        );

        const snapshot = await storage.load(input.runId);
        if (!snapshot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "snapshot_not_found",
          });
        }

        const { createContextFromSnapshot } = await import(
          "@alfred/pipeline/snapshot"
        );
        const ctxDecoded = createContextFromSnapshot(snapshot, {
          emit: () => {},
        });

        const scheduleOutput = ctxDecoded.get("scheduleOutput") as
          | {
              waves: Array<{
                id: string;
                agents: string[];
                dependsOn: string[];
              }>;
            }
          | undefined;

        const planOutput = ctxDecoded.get("planOutput") as
          | {
              rootPlanPath: string;
            }
          | undefined;

        if (!(scheduleOutput && planOutput)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "plan_not_ready",
          });
        }

        if (
          !("rootPlanPath" in planOutput) ||
          typeof planOutput.rootPlanPath !== "string" ||
          planOutput.rootPlanPath.length === 0
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "plan_not_ready",
          });
        }

        const workspace =
          ctxDecoded.get<string>("workspace") ??
          // Fallback: infer workspace from root plan path: <workspace>/.agent/plans/<runId>/root.md
          path.resolve(planOutput.rootPlanPath, "..", "..", "..", "..");

        // Auto-include prerequisite waves when waveIds are provided.
        const expandedWaveIds = input.waveIds
          ? expandWaveIds(scheduleOutput.waves, input.waveIds)
          : undefined;

        // Persist partial execution params to snapshot context so execute stage can read them.
        if (expandedWaveIds || input.skipTaskIds || input.dryRun) {
          const contextMap = new Map(snapshot.contextEntries ?? []);

          if (expandedWaveIds) {
            contextMap.set("waveIds", expandedWaveIds);
          }
          if (input.skipTaskIds) {
            contextMap.set("skipTaskIds", input.skipTaskIds);
          }
          if (typeof input.dryRun === "boolean") {
            contextMap.set("dryRun", input.dryRun);
          }

          await storage.save(input.runId, {
            ...snapshot,
            contextEntries: Array.from(contextMap.entries()),
          });
        }

        const executionSnapshot = await storage.load(input.runId);
        if (!executionSnapshot) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "snapshot_not_found_after_update",
          });
        }

        const runner = new PipelineRunner({
          enableLearning: true,
          enableLinearSync: Boolean(input.linear?.sessionId),
          linearSyncInterval: 30_000,
        });
        registerDefaultStages(runner);

        runner.addObserver(new MetricsObserver());
        runner.addObserver(new CostCleanupObserver());
        runner.addObserver(new CheckpointObserver(storage));
        runner.addObserver(
          new CompilationObserver({
            runId: input.runId,
            requirement: snapshot.requirement,
          })
        );

        if (input.linear?.sessionId && input.authzLinear) {
          runner.addObserver(
            new LinearSyncObserver({
              syncIntervalMs: 30_000,
              space: input.linear.space,
              issueId: input.linear.issueId ?? input.linear.sessionId,
              authz: input.authzLinear,
            })
          );
        }

        const userId = ctxDecoded.get<string>("userId") ?? session.user.id;

        const pipelineInput = {
          runId: input.runId,
          requirement: snapshot.requirement,
          workspace,
          userId,
          authz: input.authz,
          linear: input.linear
            ? {
                sessionId: input.linear.sessionId ?? "",
                space: input.linear.space,
                teamId: input.linear.teamId,
                issueId: input.linear.issueId,
                authz: input.authzLinear ?? "",
              }
            : undefined,
        };

        for await (const _event of runner.resume(
          executionSnapshot,
          pipelineInput
        )) {
          // observers handle persistence/metrics
        }

        const finalSnapshot = await storage.load(input.runId);
        const status = finalSnapshot?.status ?? "failed";

        const durationSec = (performance.now() - startTime) / 1000;
        phaseExecuteRequestsTotal.inc({
          status: status === "completed" ? "success" : "error",
        });
        phaseExecuteDurationSeconds.observe(
          { status: status === "completed" ? "success" : "error" },
          durationSec
        );

        return {
          runId: input.runId,
          status,
          completed: status === "completed",
        };
      } catch (error) {
        const durationSec = (performance.now() - startTime) / 1000;
        const { phaseExecuteRequestsTotal, phaseExecuteDurationSeconds } =
          await import("@alfred/pipeline/metrics");
        phaseExecuteRequestsTotal.inc({ status: "error" });
        phaseExecuteDurationSeconds.observe({ status: "error" }, durationSec);

        throw toTRPCError(error, "workflow_phase_execute_by_runid_failed");
      }
    }),

  /**
   * Stream plan-only pipeline events.
   */
  streamPlan: authedProcedure
    .use(rateLimit)
    .input(planPhaseInputSchema)
    .subscription(({ input, ctx }) =>
      observable<PipelineEvent>((emit) => {
        const session = ctx.session;
        if (!session?.user?.id) {
          emit.error(
            new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
          );
          return () => {};
        }

        let cleanup: (() => void) | undefined;
        const runId = input.runId ?? crypto.randomUUID();

        const startPlanStream = async () => {
          const abortController = new AbortController();

          try {
            const [
              { PipelineRunner, registerDefaultStages },
              {
                CheckpointObserver,
                MetricsObserver,
                PipelineEventQueueObserver,
              },
              { PostgresCheckpointStorage },
            ] = await Promise.all([
              import("@alfred/pipeline"),
              import("@alfred/pipeline/observers"),
              import("@alfred/db/repo/workflow"),
            ]);

            const runner = new PipelineRunner({
              maxParallel: 1,
              enableLearning: false,
              enableLinearSync: false,
            });
            registerDefaultStages(runner);

            const storage = new WorkflowCheckpointStorage(
              isTestMode
                ? getTestCheckpointStorage()
                : new PostgresCheckpointStorage()
            );
            const queueObserver = new PipelineEventQueueObserver();
            runner.addObserver(queueObserver);
            runner.addObserver(new MetricsObserver());
            runner.addObserver(new CheckpointObserver(storage));

            cleanup = () => {
              abortController.abort();
              queueObserver.close();
            };

            const workspace = input.workspace ?? process.cwd();

            // Ensure run exists before persisting checkpoints (FK to workflow_snapshots).
            const existingRun = await workflowRepo.getRun(runId);
            if (!existingRun) {
              await workflowRepo.createRun({
                id: runId,
                userId: session.user.id,
                requirement: input.requirement,
                workflowId: "pipeline",
                status: "running",
                inputData: {
                  requirement: input.requirement,
                  workspace,
                  runId,
                },
                linearSessionId: input.linear?.sessionId,
                linearSpace: input.linear?.space,
                linearIssueId: input.linear?.issueId,
              });
            }

            const pipelineInput = {
              runId,
              requirement: input.requirement,
              workspace,
              userId: session.user.id,
              authz: input.authz,
              linear: input.linear
                ? {
                    sessionId: input.linear.sessionId ?? "",
                    space: input.linear.space,
                    issueId: input.linear.issueId,
                    authz: input.authzLinear ?? "",
                  }
                : undefined,
            };

            // Run in background, stream events
            void (async () => {
              try {
                for await (const _event of runner.runUntilStage(
                  pipelineInput,
                  "schedule",
                  abortController.signal
                )) {
                  // Events go to queueObserver
                }
              } catch (error) {
                logger.warn("phase_stream_plan_failed", {
                  runId,
                  error: error instanceof Error ? error.message : String(error),
                });
              } finally {
                queueObserver.close();
              }
            })();

            for await (const event of queueObserver.stream()) {
              emit.next(event);
            }
            emit.complete();
          } catch (error) {
            emit.error(toTRPCError(error, "workflow_phase_stream_plan_error"));
          }
        };

        void startPlanStream();

        return () => {
          cleanup?.();
        };
      })
    ),

  /**
   * Get current phase status for a run.
   */
  status: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const { PostgresCheckpointStorage } = await import(
          "@alfred/db/repo/workflow"
        );
        const { getResumeStage } = await import("@alfred/pipeline/snapshot");

        const storage = new WorkflowCheckpointStorage(
          new PostgresCheckpointStorage()
        );
        const snapshot = await storage.load(input.runId);

        if (!snapshot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "snapshot_not_found",
          });
        }

        const nextStage = getResumeStage(snapshot);
        const canResume =
          snapshot.status !== "completed" &&
          snapshot.status !== "failed" &&
          nextStage !== null;

        return phaseStatusSchema.parse({
          runId: snapshot.runId,
          status: snapshot.status,
          lastCompletedStage: snapshot.lastCompletedStage,
          lastCompletedStageIndex: snapshot.lastCompletedStageIndex,
          stageResults: snapshot.stageResults ?? [],
          error: snapshot.error,
          canResume,
          nextStage,
        });
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw toTRPCError(error, "workflow_phase_status_failed");
      }
    }),

  /**
   * Load a persisted plan by runId.
   * Returns the same shape as `phase.plan` (PlanPhaseOutput).
   */
  getPlan: phaseExecuteProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const storage = isTestMode
          ? new WorkflowCheckpointStorage(getTestCheckpointStorage())
          : new WorkflowCheckpointStorage(
              new (
                await import("@alfred/db/repo/workflow")
              ).PostgresCheckpointStorage()
            );
        const snapshot = await storage.load(input.runId);
        if (!snapshot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "snapshot_not_found",
          });
        }

        const { createContextFromSnapshot } = await import(
          "@alfred/pipeline/snapshot"
        );
        const ctxDecoded = createContextFromSnapshot(snapshot, {
          emit: () => {},
        });

        const scheduleOutput = ctxDecoded.get("scheduleOutput") as
          | {
              waves: Array<{
                id: string;
                agents: string[];
                dependsOn: string[];
                agentType?: string;
                phaseId?: string;
              }>;
              executionMode: "sequential" | "parallel";
              estimatedDuration: number;
            }
          | undefined;

        const planOutput = ctxDecoded.get("planOutput") as
          | {
              planId: string;
              structuredPlan: unknown;
              subtasks: Array<{
                id: string;
                title: string;
                requirement: string;
                deps: string[];
                priority: number;
                acceptance: string[];
                filesHint: string[];
              }>;
              execPlans: Map<string, string> | Record<string, string>;
              rootPlanPath: string;
            }
          | undefined;

        const contextOutput = ctxDecoded.get("contextOutput") as
          | {
              totalTokens?: number;
              ragChunks?: unknown[];
            }
          | undefined;

        if (!(scheduleOutput && planOutput)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "plan_not_ready",
          });
        }

        const execPlansRaw = planOutput.execPlans;
        const execPlansRecord: Record<string, string> =
          execPlansRaw instanceof Map
            ? Object.fromEntries(execPlansRaw)
            : Array.isArray(execPlansRaw)
              ? Object.fromEntries(execPlansRaw)
              : execPlansRaw;

        const result = {
          runId: snapshot.runId,
          planId: planOutput.planId,
          structuredPlan: planOutput.structuredPlan,
          waves: scheduleOutput.waves,
          waveCount: scheduleOutput.waves.length,
          subtasks: planOutput.subtasks,
          execPlans: execPlansRecord,
          rootPlanPath: planOutput.rootPlanPath,
          executionMode: scheduleOutput.executionMode,
          estimatedDuration: scheduleOutput.estimatedDuration,
          snapshot: {
            runId: snapshot.runId,
            status: snapshot.status,
            requirement: snapshot.requirement,
            lastCompletedStage: snapshot.lastCompletedStage,
            lastCompletedStageIndex: snapshot.lastCompletedStageIndex,
            startedAt: snapshot.startedAt,
            lastEventAt: snapshot.lastEventAt,
            error: snapshot.error,
          },
          context: contextOutput
            ? {
                totalTokens: contextOutput.totalTokens ?? 0,
                ragChunkCount: Array.isArray(contextOutput.ragChunks)
                  ? contextOutput.ragChunks.length
                  : 0,
              }
            : undefined,
        };

        return planPhaseOutputSchema.parse(result);
      } catch (error) {
        throw toTRPCError(error, "workflow_phase_get_plan_failed");
      }
    }),

  /**
   * Check whether a plan is available in Redis cache.
   * Returns the cached plan (if present) plus the cache key.
   */
  cachedPlan: phasePlanProcedure
    .input(planPhaseInputSchema)
    .query(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      try {
        const { computeFileTreeHash, getCachedPlan, getPlanCacheKey } =
          await import("@alfred/pipeline/cache");

        const workspace = input.workspace ?? process.cwd();
        const fileTreeHash = await computeFileTreeHash(workspace);
        const cacheKey = getPlanCacheKey({
          runId: input.runId ?? "",
          requirement: input.requirement,
          workspace,
          fileTreeHash,
        });

        const plan = await getCachedPlan(cacheKey);
        return {
          cached: Boolean(plan),
          plan,
          cacheKey,
        };
      } catch (error) {
        throw toTRPCError(error, "workflow_phase_cached_plan_failed");
      }
    }),

  /**
   * Update an existing plan with modified subtasks.
   * Optionally regenerate waves based on new dependencies.
   */
  updatePlan: phasePlanProcedure
    .input(
      z.object({
        runId: z.string().min(1),
        structuredPlan: z.unknown(),
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

      const startTime = performance.now();

      try {
        const { phaseUpdatePlanDurationSeconds } = await import(
          "@alfred/pipeline/metrics"
        );

        const { structuredPlanSchema } = await import("@alfred/plan/schema");
        const { hasCycles, planToWaves } = await import(
          "@alfred/plan/generate"
        );

        const parsedPlan = structuredPlanSchema.parse(input.structuredPlan);
        if (hasCycles(parsedPlan.phases)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "plan_has_cycles",
          });
        }

        const subtasks = parsedPlan.phases.flatMap((p) => p.tasks);
        if (subtasks.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "plan_has_no_tasks",
          });
        }

        const storage = isTestMode
          ? new WorkflowCheckpointStorage(getTestCheckpointStorage())
          : new WorkflowCheckpointStorage(
              new (
                await import("@alfred/db/repo/workflow")
              ).PostgresCheckpointStorage()
            );
        const snapshot = await storage.load(input.runId);

        if (!snapshot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "snapshot_not_found",
          });
        }

        const waves = planToWaves(parsedPlan, { maxConcurrency: 5 });

        // Update snapshot context
        const ctxMap = new Map(snapshot.contextEntries ?? []);
        const planOutput = ctxMap.get("planOutput") as Record<
          string,
          unknown
        > | null;

        if (planOutput) {
          ctxMap.set("planOutput", {
            ...planOutput,
            structuredPlan: parsedPlan,
            subtasks,
          });
        }

        const scheduleOutputEntry = ctxMap.get("scheduleOutput") as Record<
          string,
          unknown
        > | null;

        if (scheduleOutputEntry) {
          ctxMap.set("scheduleOutput", {
            ...scheduleOutputEntry,
            waves,
          });
        }

        // Update snapshot
        const updatedSnapshot: PipelineSnapshot = {
          ...snapshot,
          contextEntries: Array.from(ctxMap.entries()),
        };

        await storage.save(input.runId, updatedSnapshot);

        // Persist the plan edits (skip in test mode)
        if (!isTestMode) {
          try {
            const { planRepo } = await import("@alfred/db");
            await planRepo.updatePlan(parsedPlan.id, { plan: parsedPlan });
          } catch {
            // Best-effort (plan persistence is not required for snapshot execution).
          }
        }

        // Record metrics
        const durationSec = (performance.now() - startTime) / 1000;
        phaseUpdatePlanDurationSeconds.observe(durationSec);

        return {
          runId: input.runId,
          waves,
          waveCount: waves.length,
          structuredPlan: parsedPlan,
          subtasks,
        };
      } catch (error) {
        const durationSec = (performance.now() - startTime) / 1000;
        const { phaseUpdatePlanDurationSeconds } = await import(
          "@alfred/pipeline/metrics"
        );
        phaseUpdatePlanDurationSeconds.observe(durationSec);

        throw toTRPCError(error, "workflow_phase_update_plan_failed");
      }
    }),

  /**
   * Approve a planned workflow and transition the run to executable state.
   * Execution itself is performed via `workflow.resumePipeline` (streaming).
   */
  approveAndExecute: phaseExecuteProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      try {
        const { createContextFromSnapshot } = await import(
          "@alfred/pipeline/snapshot"
        );

        const storage = isTestMode
          ? new WorkflowCheckpointStorage(getTestCheckpointStorage())
          : new WorkflowCheckpointStorage(
              new (
                await import("@alfred/db/repo/workflow")
              ).PostgresCheckpointStorage()
            );
        const snapshot = await storage.load(input.runId);
        if (!snapshot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "snapshot_not_found",
          });
        }

        const ctxDecoded = createContextFromSnapshot(snapshot, {
          emit: () => {},
        });
        const planOutput = ctxDecoded.get("planOutput") as
          | { planId?: string; structuredPlan?: unknown }
          | undefined;

        const planId = planOutput?.planId;
        if (typeof planId !== "string" || planId.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "plan_not_ready",
          });
        }

        if (isTestMode) {
          return { runId: input.runId, planId };
        }

        const [{ updateRun }, planRepo] = await Promise.all([
          import("@alfred/db/repo/workflow"),
          import("@alfred/db/repo/plan"),
        ]);

        // Ensure plan exists, then approve.
        const existing = await planRepo.getPlanById(planId);
        if (!existing) {
          await planRepo.createPlan({
            id: planId,
            userId: session.user.id,
            projectId: null,
            intent: snapshot.requirement,
            plan: planOutput?.structuredPlan ?? {},
            status: "pending",
          });
        }
        await planRepo.updatePlanStatus(planId, "approved", session.user.id);

        // Transition run to running (resume subscription performs actual execution).
        await updateRun(input.runId, {
          status: "running",
          planId,
          suspendedAt: null,
          resumedAt: new Date(),
          errorMessage: null,
        });

        return { runId: input.runId, planId };
      } catch (error) {
        throw toTRPCError(error, "workflow_phase_approve_failed");
      }
    }),

  /**
   * Save current plan as a reusable template.
   */
  saveAsTemplate: authedProcedure
    .use(rateLimit)
    .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResourceLocal(raw)))
    .input(
      z.object({
        runId: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        triggerPattern: z.string().optional(),
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

      try {
        const [{ PostgresCheckpointStorage }, { templateRepo }] =
          await Promise.all([
            import("@alfred/db/repo/workflow"),
            import("@alfred/db"),
          ]);

        const storage = new WorkflowCheckpointStorage(
          new PostgresCheckpointStorage()
        );
        const snapshot = await storage.load(input.runId);

        if (!snapshot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "snapshot_not_found",
          });
        }

        const ctxMap = new Map(snapshot.contextEntries ?? []);
        const planOutput = ctxMap.get("planOutput");

        if (!planOutput) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "plan_not_found_in_snapshot",
          });
        }

        const templateId = await templateRepo.saveTemplate(
          session.user.id,
          input.name,
          planOutput,
          {
            description: input.description,
            triggerPattern: input.triggerPattern,
          }
        );

        return { templateId };
      } catch (error) {
        throw toTRPCError(error, "workflow_save_template_failed");
      }
    }),

  /**
   * List user's plan templates.
   */
  listTemplates: authedProcedure
    .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResourceLocal(raw)))
    .query(async ({ ctx }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      try {
        const { templateRepo } = await import("@alfred/db");
        const templates = await templateRepo.listTemplates(session.user.id);

        return templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          triggerPattern: t.triggerPattern,
          successRate: t.successRate ? Number.parseFloat(t.successRate) : null,
          usageCount: typeof t.usageCount === "number" ? t.usageCount : 0,
          lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
          createdAt: t.createdAt?.toISOString() ?? new Date().toISOString(),
        }));
      } catch (error) {
        throw toTRPCError(error, "workflow_list_templates_failed");
      }
    }),

  /**
   * Apply template to a new requirement.
   */
  applyTemplate: authedProcedure
    .use(rateLimit)
    .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResourceLocal(raw)))
    .input(
      z.object({
        templateId: z.string().min(1),
        requirement: z.string().min(1),
        workspace: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { templateRepo } = await import("@alfred/db");

        const planData = await templateRepo.applyTemplate(
          input.templateId,
          input.requirement
        );

        // Return as a structured plan that can be used for execution
        return {
          templateId: input.templateId,
          planData,
        };
      } catch (error) {
        throw toTRPCError(error, "workflow_apply_template_failed");
      }
    }),
});

export const workflowRouter = router({
  // Phase-level APIs for staged execution
  phase: workflowPhaseRouter,

  compilation: router({
    get: authedProcedure
      .use(rateLimit)
      .use(
        requirePolicy("workflow.read", (raw) =>
          mapWorkflowRunResourceLocal(raw)
        )
      )
      .input(z.object({ runId: z.string().min(1) }))
      .query(async ({ input, ctx }) => {
        const session = ctx.session;
        if (!session?.user?.id) {
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

        const stateData =
          run.stateData &&
          typeof run.stateData === "object" &&
          run.stateData !== null
            ? (run.stateData as Record<string, unknown>)
            : {};
        const compilation = stateData.compilation;
        const parsed = workflowCompilationSchema.safeParse(compilation);
        return parsed.success ? parsed.data : null;
      }),
  }),

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
      const workflow = workflowInput.parse(input);

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
        };

        const executor = await createWorkflowExecutor(
          workflowPayload,
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

  streamPipeline: authedProcedure
    .use(rateLimit)
    .input(workflowInputSchema)
    .subscription(({ input, ctx }) =>
      observable<PipelineEvent>((emit) => {
        const session = ctx.session;
        if (!session?.user?.id) {
          emit.error(
            new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
          );
          return () => {};
        }

        let cleanup: (() => void) | undefined;

        const startPipeline = async () => {
          const abortController = new AbortController();
          const runId = input.runId ?? crypto.randomUUID();

          try {
            const normalizedMode =
              input.mode === "parallel" || input.mode === "sequential"
                ? input.mode
                : "sequential";
            const { workflowInput } = await import(
              "@alfred/agent/workflow/schema"
            );
            const policyInput = workflowInput.parse({
              ...input,
              auto: input.auto ?? "low",
              mode: normalizedMode,
            });

            const { obligations } = await enforceWorkflowPlanPolicy({
              session,
              input: policyInput,
            });

            if (obligations.length > 0) {
              emit.next({
                type: "pipeline:suspend",
                reason: "policy_obligation",
                timestamp: Date.now(),
              });
              emit.complete();
              return;
            }

            const [
              { PipelineRunner, registerDefaultStages },
              {
                CheckpointObserver,
                CostCleanupObserver,
                MetricsObserver,
                PipelineEventQueueObserver,
                LinearSyncObserver,
              },
              { registerRunHandle, unregisterRunHandle },
              { ensureLinearTicket },
              { bootstrapLinearSession },
              { PostgresCheckpointStorage },
            ] = await Promise.all([
              import("@alfred/pipeline"),
              import("@alfred/pipeline/observers"),
              import("@alfred/agent/workflow/session-recovery"),
              import("@alfred/agent/workflow/linear"),
              import("@alfred/runtime/workflow/linear"),
              import("@alfred/db/repo/workflow"),
            ]);

            const rawInput = input as Record<string, unknown>;
            const parsedLinear = linearInputSchema.safeParse(input.linear);
            let normalizedLinear = parsedLinear.success
              ? parsedLinear.data
              : undefined;

            if (normalizedLinear && input.authzLinear) {
              try {
                const ensured = await ensureLinearTicket({
                  linear: normalizedLinear,
                  authzLinear: input.authzLinear,
                  requirement: input.requirement,
                });
                normalizedLinear = ensured.linear;
              } catch (error) {
                logger.warn("pipeline_stream_linear_ticket_failed", {
                  runId,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }

            if (normalizedLinear && input.authzLinear) {
              await bootstrapLinearSession({
                runId,
                requirement: input.requirement,
                linear: normalizedLinear,
                authz: input.authzLinear,
              });
            }

            const toolgraph = rawInput.toolgraph;
            const maxParallel =
              typeof toolgraph === "object" &&
              toolgraph !== null &&
              typeof (toolgraph as { maxParallel?: unknown }).maxParallel ===
                "number"
                ? (toolgraph as { maxParallel: number }).maxParallel
                : 4;

            const runner = new PipelineRunner({
              maxParallel: input.mode === "parallel" ? maxParallel : 1,
              enableLearning: true,
              enableLinearSync: Boolean(normalizedLinear?.sessionId),
              linearSyncInterval: 30_000,
            });
            registerDefaultStages(runner);

            const queueObserver = new PipelineEventQueueObserver();
            runner.addObserver(queueObserver);
            runner.addObserver(new MetricsObserver());
            runner.addObserver(new CostCleanupObserver());
            runner.addObserver(
              new CheckpointObserver(
                new WorkflowCheckpointStorage(new PostgresCheckpointStorage())
              )
            );
            runner.addObserver(
              new CompilationObserver({
                runId,
                requirement: input.requirement,
              })
            );

            if (normalizedLinear?.sessionId && input.authzLinear) {
              runner.addObserver(
                new LinearSyncObserver({
                  syncIntervalMs: 30_000,
                  space: normalizedLinear.space,
                  issueId:
                    normalizedLinear.issueId ?? normalizedLinear.sessionId,
                  authz: input.authzLinear,
                })
              );
            }

            await registerRunHandle(runId, {
              resume: () => Promise.resolve(),
              suspend: () => {
                abortController.abort();
                return Promise.resolve();
              },
              cancel: () => {
                abortController.abort();
                return Promise.resolve();
              },
              abortController,
            });

            cleanup = () => {
              abortController.abort();
              queueObserver.close();
              void unregisterRunHandle(runId).catch(() => {});
            };

            const workspace =
              typeof rawInput.workspace === "string" &&
              rawInput.workspace.length > 0
                ? rawInput.workspace
                : typeof rawInput.cw === "string" && rawInput.cw.length > 0
                  ? rawInput.cw
                  : process.cwd();

            // Ensure run exists before persisting checkpoints/compilation (FK).
            const existingRun = await workflowRepo.getRun(runId);
            if (!existingRun) {
              await workflowRepo.createRun({
                id: runId,
                userId: session.user.id,
                requirement: input.requirement,
                workflowId: "pipeline",
                status: "running",
                inputData: {
                  requirement: input.requirement,
                  workspace,
                  runId,
                },
                linearSessionId: normalizedLinear?.sessionId,
                linearSpace: normalizedLinear?.space,
                linearIssueId: normalizedLinear?.issueId,
              });
            }

            const pipelineInput = {
              runId,
              requirement: input.requirement,
              workspace,
              userId: session.user.id,
              authz:
                typeof rawInput.authz === "string" ? rawInput.authz : undefined,
              linear: normalizedLinear
                ? {
                    sessionId: normalizedLinear.sessionId ?? "",
                    space: normalizedLinear.space,
                    teamId: normalizedLinear.teamId,
                    issueId: normalizedLinear.issueId,
                    authz: input.authzLinear ?? "",
                  }
                : undefined,
            };

            const { wrapEventEnvelope } = await import(
              "@alfred/agent/utils/envelope"
            );

            const persistTasks = new Set<Promise<void>>();
            const persistPipelineEvent = (event: PipelineEvent): void => {
              // Skip high-volume chatter
              if (
                event.type === "stage:progress" ||
                event.type === "agent:progress"
              ) {
                return;
              }

              const mapped = ((): {
                eventType: import("@alfred/db/schema/workflow").WorkflowEventType;
                data: Record<string, unknown>;
              } | null => {
                switch (event.type) {
                  case "pipeline:start":
                    return {
                      eventType: "run",
                      data: {
                        kind: "pipeline_start",
                        runId: event.runId,
                        requirement: event.requirement,
                      },
                    };
                  case "stage:enter":
                    return {
                      eventType: "step-start",
                      data: { kind: "stage_enter", stage: event.stage },
                    };
                  case "stage:exit":
                    return {
                      eventType: "step-complete",
                      data: {
                        kind: "stage_exit",
                        stage: event.stage,
                        durationMs: event.durationMs,
                      },
                    };
                  case "stage:error":
                    return {
                      eventType: "error",
                      data: {
                        kind: "stage_error",
                        stage: event.stage,
                        message: event.error,
                      },
                    };
                  case "agent:spawn":
                    return {
                      eventType: "agent-start",
                      data: {
                        kind: "agent_spawn",
                        agentId: event.agentId,
                        taskId: event.taskId,
                      },
                    };
                  case "agent:complete":
                    return {
                      eventType: "agent-complete",
                      data: {
                        kind: "agent_complete",
                        agentId: event.agentId,
                        outcome: event.outcome,
                      },
                    };
                  case "agent:escalate-request":
                    return {
                      eventType: "notice",
                      data: {
                        kind: "escalation",
                        agentId: event.agentId,
                        reason: event.reason,
                        details: event.details,
                        suggestions: event.suggestions,
                        severity: event.severity,
                        timestamp: event.timestamp,
                      },
                    };
                  case "pipeline:suspend":
                    return {
                      eventType: "suspend",
                      data: { kind: "pipeline_suspend", reason: event.reason },
                    };
                  case "pipeline:resume":
                    return {
                      eventType: "resume",
                      data: {
                        kind: "pipeline_resume",
                        fromStage: event.fromStage,
                      },
                    };
                  case "pipeline:complete":
                    return {
                      eventType: "finish",
                      data: {
                        kind: "pipeline_complete",
                        summary: event.summary,
                        summaryText: event.summaryText,
                      },
                    };
                  case "pipeline:failed":
                    return {
                      eventType: "error",
                      data: {
                        kind: "pipeline_failed",
                        lastStage: event.lastStage,
                        message: event.error,
                      },
                    };
                }
                return null;
              })();

              if (!mapped) {
                return;
              }

              const p = workflowRepo
                .appendEvent({
                  runId,
                  eventType: mapped.eventType,
                  timestamp: new Date(event.timestamp),
                  eventData: wrapEventEnvelope({
                    id: crypto.randomUUID(),
                    type: mapped.eventType,
                    resource: "user",
                    data: mapped.data,
                  }),
                })
                .then(() => {})
                .catch((error) => {
                  logger.warn("workflow_pipeline_event_persist_failed", {
                    runId,
                    eventType: event.type,
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                })
                .finally(() => {
                  persistTasks.delete(p);
                });

              persistTasks.add(p);
            };

            void (async () => {
              try {
                for await (const _event of runner.run(
                  pipelineInput,
                  abortController.signal
                )) {
                  void _event;
                }
              } catch (error) {
                logger.warn("pipeline_stream_failed", {
                  runId,
                  error: error instanceof Error ? error.message : String(error),
                });
              } finally {
                queueObserver.close();
                await unregisterRunHandle(runId).catch(() => {});
              }
            })();

            for await (const event of queueObserver.stream()) {
              persistPipelineEvent(event);
              emit.next(event);
            }
            await Promise.allSettled(Array.from(persistTasks));
            emit.complete();
          } catch (error) {
            emit.error(toTRPCError(error, "workflow_pipeline_stream_error"));
          }
        };

        void startPipeline();

        return () => {
          cleanup?.();
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
        const wanted = Array.from(docIds);
        const documentIdExpr = sql<string>`${memoryNodes.properties} ->> 'documentId'`;

        const rows = await db
          .select({
            label: memoryNodes.label,
            documentId: documentIdExpr,
          })
          .from(memoryNodes)
          .where(
            and(
              eq(memoryNodes.kind, "rag_document"),
              eq(memoryNodes.resource, "user"),
              inArray(documentIdExpr, wanted)
            )
          );

        documents = rows
          .filter(
            (
              row: (typeof rows)[number]
            ): row is { label: string; documentId: string } =>
              typeof row.documentId === "string" && row.documentId.length > 0
          )
          .map((row: { label: string; documentId: string }) => ({
            documentId: row.documentId,
            label: row.label,
          }));
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
    .input(
      z.object({
        runId: z.string().min(1),
        dryRun: z.boolean().optional(),
      })
    )
    .subscription(({ input, ctx }) =>
      observable<PipelineEvent>((emit) => {
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
            const [
              { PipelineRunner, registerDefaultStages },
              {
                CheckpointObserver,
                CostCleanupObserver,
                MetricsObserver,
                PipelineEventQueueObserver,
                LinearSyncObserver,
              },
              { PostgresCheckpointStorage },
              { registerRunHandle, unregisterRunHandle },
            ] = await Promise.all([
              import("@alfred/pipeline"),
              import("@alfred/pipeline/observers"),
              import("@alfred/db/repo/workflow"),
              import("@alfred/agent/workflow/session-recovery"),
            ]);

            const storage = new WorkflowCheckpointStorage(
              isTestMode
                ? getTestCheckpointStorage()
                : new PostgresCheckpointStorage()
            );
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

            if (input.dryRun) {
              try {
                const updatedSnapshot = { ...snapshot };
                const contextMap = new Map(updatedSnapshot.contextEntries);
                contextMap.set("dryRun", true);
                updatedSnapshot.contextEntries = Array.from(
                  contextMap.entries()
                );
                await storage.save(input.runId, updatedSnapshot);
              } catch {
                // Best-effort.
              }
            }

            const resumeSnapshot = await storage.load(input.runId);
            if (!resumeSnapshot) {
              emit.error(
                new TRPCError({
                  code: "NOT_FOUND",
                  message: "no_checkpoint_found",
                })
              );
              return;
            }

            const ctxEntries = new Map(resumeSnapshot.contextEntries ?? []);
            const workspace =
              (ctxEntries.get("workspace") as string | undefined) ??
              process.cwd();
            const userId =
              (ctxEntries.get("userId") as string | undefined) ??
              session.user.id;
            const linearSessionId = ctxEntries.get("linearSessionId");
            const linearIssueId = ctxEntries.get("linearIssueId");
            const linearSpace = ctxEntries.get("linearSpace");
            const linearTeamId = ctxEntries.get("linearTeamId");
            const linearAuthz = ctxEntries.get("linearAuthz");

            const runner = new PipelineRunner({
              enableLearning: true,
              enableLinearSync: Boolean(linearSessionId),
              linearSyncInterval: 30_000,
            });
            registerDefaultStages(runner);

            const queueObserver = new PipelineEventQueueObserver();
            runner.addObserver(queueObserver);
            runner.addObserver(new MetricsObserver());
            runner.addObserver(new CostCleanupObserver());
            runner.addObserver(new CheckpointObserver(storage));
            runner.addObserver(
              new CompilationObserver({
                runId: input.runId,
                requirement: resumeSnapshot.requirement,
              })
            );

            // Best-effort: mark run as running when resuming.
            try {
              const { workflowRepo } = await import("@alfred/db");
              await workflowRepo.updateRun(input.runId, {
                status: "running",
                suspendedAt: null,
                resumedAt: new Date(),
                errorMessage: null,
              });
            } catch {
              // Ignore; streaming resume should still proceed.
            }

            if (
              typeof linearSessionId === "string" &&
              typeof linearIssueId === "string" &&
              typeof linearSpace === "string" &&
              typeof linearAuthz === "string" &&
              linearAuthz.length > 0
            ) {
              runner.addObserver(
                new LinearSyncObserver({
                  syncIntervalMs: 30_000,
                  space: linearSpace,
                  issueId: linearIssueId,
                  authz: linearAuthz,
                })
              );
            }

            const abortController = new AbortController();
            await registerRunHandle(input.runId, {
              resume: () => Promise.resolve(),
              suspend: () => {
                abortController.abort();
                return Promise.resolve();
              },
              cancel: () => {
                abortController.abort();
                return Promise.resolve();
              },
              abortController,
            });

            cleanup = () => {
              abortController.abort();
              queueObserver.close();
              void unregisterRunHandle(input.runId).catch(() => {});
            };

            const pipelineInput = {
              runId: input.runId,
              requirement: resumeSnapshot.requirement,
              workspace,
              userId,
              authz: undefined,
              linear:
                typeof linearSessionId === "string" &&
                typeof linearSpace === "string" &&
                typeof linearAuthz === "string" &&
                linearAuthz.length > 0
                  ? {
                      sessionId: linearSessionId,
                      space: linearSpace,
                      teamId:
                        typeof linearTeamId === "string"
                          ? linearTeamId
                          : undefined,
                      issueId:
                        typeof linearIssueId === "string"
                          ? linearIssueId
                          : undefined,
                      authz: linearAuthz,
                    }
                  : undefined,
            };

            void (async () => {
              try {
                for await (const _event of runner.resume(
                  resumeSnapshot,
                  pipelineInput,
                  abortController.signal
                )) {
                  void _event;
                }

                try {
                  const finalSnapshot = await storage.load(input.runId);
                  const finalStatus = finalSnapshot?.status ?? "failed";

                  if (finalSnapshot && finalStatus === "completed") {
                    try {
                      const { createContextFromSnapshot } = await import(
                        "@alfred/pipeline/snapshot"
                      );
                      const ctxDecoded = createContextFromSnapshot(
                        finalSnapshot,
                        {
                          emit: () => {},
                        }
                      );
                      const planOutput = ctxDecoded.get("planOutput") as
                        | { structuredPlan?: unknown }
                        | undefined;
                      const initOutput = ctxDecoded.get("initOutput") as
                        | { projectId?: string }
                        | undefined;
                      const plan = planOutput?.structuredPlan;

                      const isRecord = (
                        value: unknown
                      ): value is Record<string, unknown> =>
                        typeof value === "object" &&
                        value !== null &&
                        !Array.isArray(value);

                      if (isRecord(plan)) {
                        const phases = plan.phases;
                        const resources = plan.resources;
                        const evaluationCriteria = plan.evaluationCriteria;
                        const intent =
                          typeof plan.intent === "string" &&
                          plan.intent.length > 0
                            ? plan.intent
                            : finalSnapshot.requirement;

                        if (phases && resources && evaluationCriteria) {
                          await upsertWorkflowPatternFromCompletion({
                            userId,
                            projectId: initOutput?.projectId ?? null,
                            intent,
                            planTemplate: {
                              phases,
                              resources,
                              evaluationCriteria,
                            },
                            durationMs: Math.max(
                              0,
                              finalSnapshot.lastEventAt -
                                finalSnapshot.startedAt
                            ),
                          });
                        }
                      }
                    } catch {
                      // Best-effort.
                    }
                  }

                  const { workflowRepo } = await import("@alfred/db");
                  await workflowRepo.updateRun(input.runId, {
                    status:
                      finalStatus === "completed"
                        ? "completed"
                        : finalStatus === "suspended"
                          ? "suspended"
                          : "failed",
                    suspendedAt:
                      finalStatus === "suspended" ? new Date() : null,
                    completedAt:
                      finalStatus === "completed" || finalStatus === "failed"
                        ? new Date()
                        : null,
                    errorMessage:
                      finalStatus === "failed"
                        ? (finalSnapshot?.error ?? "pipeline_failed")
                        : null,
                  });
                } catch {
                  // Best-effort.
                }
              } catch (error) {
                logger.warn("pipeline_resume_failed", {
                  runId: input.runId,
                  error: error instanceof Error ? error.message : String(error),
                });
                try {
                  const { workflowRepo } = await import("@alfred/db");
                  await workflowRepo.updateRun(input.runId, {
                    status: "failed",
                    completedAt: new Date(),
                    errorMessage:
                      error instanceof Error ? error.message : String(error),
                  });
                } catch {
                  // Best-effort.
                }
              } finally {
                queueObserver.close();
                await unregisterRunHandle(input.runId).catch(() => {});
              }
            })();

            const { wrapEventEnvelope } = await import(
              "@alfred/agent/utils/envelope"
            );

            const persistTasks = new Set<Promise<void>>();
            const persistPipelineEvent = (event: PipelineEvent): void => {
              if (
                event.type === "stage:progress" ||
                event.type === "agent:progress"
              ) {
                return;
              }

              const mapped = ((): {
                eventType: import("@alfred/db/schema/workflow").WorkflowEventType;
                data: Record<string, unknown>;
              } | null => {
                switch (event.type) {
                  case "pipeline:start":
                    return {
                      eventType: "run",
                      data: {
                        kind: "pipeline_start",
                        runId: event.runId,
                        requirement: event.requirement,
                      },
                    };
                  case "stage:enter":
                    return {
                      eventType: "step-start",
                      data: { kind: "stage_enter", stage: event.stage },
                    };
                  case "stage:exit":
                    return {
                      eventType: "step-complete",
                      data: {
                        kind: "stage_exit",
                        stage: event.stage,
                        durationMs: event.durationMs,
                      },
                    };
                  case "stage:error":
                    return {
                      eventType: "error",
                      data: {
                        kind: "stage_error",
                        stage: event.stage,
                        message: event.error,
                      },
                    };
                  case "agent:spawn":
                    return {
                      eventType: "agent-start",
                      data: {
                        kind: "agent_spawn",
                        agentId: event.agentId,
                        taskId: event.taskId,
                      },
                    };
                  case "agent:complete":
                    return {
                      eventType: "agent-complete",
                      data: {
                        kind: "agent_complete",
                        agentId: event.agentId,
                        outcome: event.outcome,
                      },
                    };
                  case "agent:escalate-request":
                    return {
                      eventType: "notice",
                      data: {
                        kind: "escalation",
                        agentId: event.agentId,
                        reason: event.reason,
                        details: event.details,
                        suggestions: event.suggestions,
                        severity: event.severity,
                        timestamp: event.timestamp,
                      },
                    };
                  case "pipeline:suspend":
                    return {
                      eventType: "suspend",
                      data: { kind: "pipeline_suspend", reason: event.reason },
                    };
                  case "pipeline:resume":
                    return {
                      eventType: "resume",
                      data: {
                        kind: "pipeline_resume",
                        fromStage: event.fromStage,
                      },
                    };
                  case "pipeline:complete":
                    return {
                      eventType: "finish",
                      data: {
                        kind: "pipeline_complete",
                        summary: event.summary,
                        summaryText: event.summaryText,
                      },
                    };
                  case "pipeline:failed":
                    return {
                      eventType: "error",
                      data: {
                        kind: "pipeline_failed",
                        lastStage: event.lastStage,
                        message: event.error,
                      },
                    };
                }
                return null;
              })();

              if (!mapped) {
                return;
              }

              const p = workflowRepo
                .appendEvent({
                  runId: input.runId,
                  eventType: mapped.eventType,
                  timestamp: new Date(event.timestamp),
                  eventData: wrapEventEnvelope({
                    id: crypto.randomUUID(),
                    type: mapped.eventType,
                    resource: "user",
                    data: mapped.data,
                  }),
                })
                .then(() => {})
                .catch((error) => {
                  logger.warn("workflow_pipeline_event_persist_failed", {
                    runId: input.runId,
                    eventType: event.type,
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                })
                .finally(() => {
                  persistTasks.delete(p);
                });

              persistTasks.add(p);
            };

            for await (const event of queueObserver.stream()) {
              persistPipelineEvent(event);
              emit.next(event);
            }
            await Promise.allSettled(Array.from(persistTasks));
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

// ─── Helper Functions ──────────────────────────────────────────────────────────

function expandWaveIds(
  waves: Array<{ id: string; dependsOn: string[] }>,
  selected: string[]
): string[] {
  const waveById = new Map(waves.map((w) => [w.id, w]));
  const out = new Set<string>();
  const stack = [...selected];

  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || out.has(id)) {
      continue;
    }
    out.add(id);
    const wave = waveById.get(id);
    if (!wave) {
      continue;
    }
    for (const dep of wave.dependsOn) {
      if (!out.has(dep)) {
        stack.push(dep);
      }
    }
  }

  return [...out];
}
