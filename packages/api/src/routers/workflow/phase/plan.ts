import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import { type PipelineEvent } from "@alfred/pipeline";
import {
  planPhaseInputSchema,
  planPhaseOutputSchema,
} from "@alfred/pipeline/schemas";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { performance } from "node:perf_hooks";

import { requirePolicy } from "../../../gate";
import { ConciergeObserver } from "../../../services/concierge";
import { authedProcedure, rateLimit } from "../../../trpc";
import { toTRPCError } from "../../../utils/error";
import {
  getTestCheckpointStorage,
  WorkflowCheckpointStorage,
} from "../../../workflow/checkpoint";
import { mapWorkflowResourceLocal } from "../../../workflow/resource";

const isTestMode =
  process.env.VITE_TEST_MODE === "true" || process.env.MINDSCAPE_TEST === "1";

const workflowPlanPolicy = requirePolicy("workflow.plan", (raw) =>
  mapWorkflowResourceLocal(raw)
);

const phasePlanProcedure = isTestMode
  ? authedProcedure.use(rateLimit)
  : authedProcedure.use(rateLimit).use(workflowPlanPolicy);

export const workflowPhasePlanProcedure = authedProcedure
  .use(rateLimit)
  .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResourceLocal(raw)))
  .input(planPhaseInputSchema)
  .mutation(async ({ input, ctx }) => {
    const { session } = ctx;
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
        fileTreeHash,
        requirement: input.requirement,
        runId,
        workspace,
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
          inputData: {
            requirement: input.requirement,
            workspace,
            runId,
          },
          linearIssueId: input.linear?.issueId,
          linearSessionId: input.linear?.sessionId,
          linearSpace: input.linear?.space,
          planId: undefined,
          projectId: undefined,
          requirement: input.requirement,
          status: "running",
          userId: session.user.id,
          workflowId: "pipeline",
        });
      }

      const runner = new PipelineRunner({
        enableLearning: false,
        enableLinearSync: false,
        maxParallel: 1,
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
      runner.addObserver(
        new ConciergeObserver({
          runId,
          userId: session.user.id,
        })
      );

      const pipelineInput = {
        authz: input.authz,
        linear: input.linear
          ? {
              sessionId: input.linear.sessionId ?? "",
              space: input.linear.space,
              issueId: input.linear.issueId,
              authz: input.authzLinear ?? "",
            }
          : undefined,
        requirement: input.requirement,
        runId,
        userId: session.user.id,
        workspace,
      };

      // Run pipeline up to and including 'schedule' stage
      for await (const _event of runner.runUntilStage(
        pipelineInput,
        "schedule"
      )) {
        // Events are consumed; outputs stored in context by checkpoint observer
        void _event;
      }

      // Load the snapshot to get all outputs
      const snapshot = await storage.load(runId);
      if (!snapshot) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "snapshot_not_found_after_plan",
        });
      }

      const { createContextFromSnapshot } =
        await import("@alfred/pipeline/snapshot");
      const ctxDecoded = createContextFromSnapshot(snapshot, {
        emit: () => {},
      });

      const scheduleOutput = ctxDecoded.get("scheduleOutput") as {
        waves: {
          id: string;
          agents: string[];
          dependsOn: string[];
          agentType?: string;
          phaseId?: string;
        }[];
        executionMode: "sequential" | "parallel";
        estimatedDuration: number;
      };
      const planOutput = ctxDecoded.get("planOutput") as {
        planId: string;
        structuredPlan: unknown;
        subtasks: {
          id: string;
          title: string;
          requirement: string;
          deps: string[];
          priority: number;
          acceptance: string[];
          filesHint: string[];
        }[];
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
          intent: input.requirement,
          plan: planOutput.structuredPlan,
          projectId:
            initOutput?.projectId && typeof initOutput.projectId === "string"
              ? initOutput.projectId
              : null,
          status: "pending",
          userId: session.user.id,
        });
      } catch {
        await planRepo.updatePlan(planOutput.planId, {
          intent: input.requirement,
          plan: planOutput.structuredPlan,
          projectId:
            initOutput?.projectId && typeof initOutput.projectId === "string"
              ? initOutput.projectId
              : null,
          status: "pending",
        });
      }

      // Mark the run as awaiting approval.
      await workflowRepo.updateRun(runId, {
        completedAt: null,
        planId: planOutput.planId,
        projectId:
          initOutput?.projectId && typeof initOutput.projectId === "string"
            ? initOutput.projectId
            : null,
        requirement: input.requirement,
        resumedAt: null,
        status: "suspended",
        suspendedAt: new Date(),
      });

      const result = {
        context: contextOutput
          ? {
              totalTokens: contextOutput.totalTokens ?? 0,
              ragChunkCount: Array.isArray(contextOutput.ragChunks)
                ? contextOutput.ragChunks.length
                : 0,
            }
          : undefined,
        estimatedDuration: scheduleOutput.estimatedDuration,
        execPlans: execPlansRecord,
        executionMode: scheduleOutput.executionMode,
        planId: planOutput.planId,
        rootPlanPath: planOutput.rootPlanPath,
        runId,
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
        structuredPlan: planOutput.structuredPlan,
        subtasks: planOutput.subtasks,
        waveCount: scheduleOutput.waves.length,
        waves: scheduleOutput.waves,
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
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
          status: "failed",
        });
      } catch {
        // Best-effort.
      }

      throw toTRPCError(error, "workflow_phase_plan_failed");
    }
  });

export const workflowPhaseCachedPlanProcedure = phasePlanProcedure
  .input(planPhaseInputSchema)
  .query(async ({ input, ctx }) => {
    const { session } = ctx;
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
        fileTreeHash,
        requirement: input.requirement,
        runId: input.runId ?? "",
        workspace,
      });

      const plan = await getCachedPlan(cacheKey);
      return {
        cacheKey,
        cached: Boolean(plan),
        plan,
      };
    } catch (error) {
      throw toTRPCError(error, "workflow_phase_cached_plan_failed");
    }
  });

export const workflowPhaseStreamPlanProcedure = authedProcedure
  .use(rateLimit)
  .input(planPhaseInputSchema)
  .subscription(({ input, ctx }) =>
    observable<PipelineEvent>((emit) => {
      const { session } = ctx;
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
            { CheckpointObserver, MetricsObserver, PipelineEventQueueObserver },
            { PostgresCheckpointStorage },
          ] = await Promise.all([
            import("@alfred/pipeline"),
            import("@alfred/pipeline/observers"),
            import("@alfred/db/repo/workflow"),
          ]);

          const runner = new PipelineRunner({
            enableLearning: false,
            enableLinearSync: false,
            maxParallel: 1,
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
          runner.addObserver(
            new ConciergeObserver({
              runId,
              userId: session.user.id,
            })
          );

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
              inputData: {
                requirement: input.requirement,
                workspace,
                runId,
              },
              linearIssueId: input.linear?.issueId,
              linearSessionId: input.linear?.sessionId,
              linearSpace: input.linear?.space,
              requirement: input.requirement,
              status: "running",
              userId: session.user.id,
              workflowId: "pipeline",
            });
          }

          const pipelineInput = {
            authz: input.authz,
            linear: input.linear
              ? {
                  sessionId: input.linear.sessionId ?? "",
                  space: input.linear.space,
                  issueId: input.linear.issueId,
                  authz: input.authzLinear ?? "",
                }
              : undefined,
            requirement: input.requirement,
            runId,
            userId: session.user.id,
            workspace,
          };

          // Run in background, stream events
          void (async () => {
            try {
              for await (const _event of runner.runUntilStage(
                pipelineInput,
                "schedule",
                abortController.signal
              )) {
                void _event;
              }
            } catch (error) {
              logger.warn("phase_stream_plan_failed", {
                error: error instanceof Error ? error.message : String(error),
                runId,
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
  );
