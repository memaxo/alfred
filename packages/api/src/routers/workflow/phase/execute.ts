import * as path from "node:path";
import { performance } from "node:perf_hooks";
import { executePhaseInputSchema } from "@alfred/pipeline/schemas";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePolicy } from "../../../gate";
import { CompilationObserver } from "../../../services/compilation";
import { ConciergeObserver } from "../../../services/concierge";
import { upsertWorkflowPatternFromCompletion } from "../../../services/pattern";
import { authedProcedure, rateLimit } from "../../../trpc";
import { toTRPCError } from "../../../utils/error";
import {
  getTestCheckpointStorage,
  WorkflowCheckpointStorage,
} from "../../../workflow/checkpoint";
import { linearInputSchema } from "../../../workflow/input";
import { mapWorkflowRunResourceLocal } from "../../../workflow/resource";
import { expandWaveIds } from "../../../workflow/wave";

const isTestMode =
  process.env.VITE_TEST_MODE === "true" || process.env.MINDSCAPE_TEST === "1";

export const workflowPhaseExecuteProcedure = authedProcedure
  .use(rateLimit)
  .use(
    requirePolicy("workflow.execute", (raw) => mapWorkflowRunResourceLocal(raw))
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
      runner.addObserver(
        new ConciergeObserver({
          userId: session.user.id,
          runId: input.runId,
        })
      );
      runner.addObserver(
        new ConciergeObserver({
          userId: session.user.id,
          runId: input.runId,
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
        void _event;
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

          const isRecord = (value: unknown): value is Record<string, unknown> =>
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
  });

export const workflowPhaseExecuteByRunIdProcedure = authedProcedure
  .use(rateLimit)
  .use(
    requirePolicy("workflow.execute", (raw) => mapWorkflowRunResourceLocal(raw))
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
        void _event;
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
  });
