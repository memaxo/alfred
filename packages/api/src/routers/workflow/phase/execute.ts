import type {
  GatherExecutionContextFn,
  PersistLearningFn,
} from "@alfred/pipeline/observers";

import { executePhaseInputSchema } from "@alfred/pipeline/schemas";
import { TRPCError } from "@trpc/server";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import { z } from "zod";

import { requirePolicy } from "../../../gate";
import { CompilationObserver } from "../../../services/compilation";
import { ConciergeObserver } from "../../../services/concierge";
import { upsertWorkflowPatternFromCompletion } from "../../../services/pattern";
import { authedProcedure, rateLimit } from "../../../trpc";
import { toTRPCError } from "../../../utils/error";
import { getSessionId, getSessionUser } from "../../../utils/session";
import {
  getTestCheckpointStorage,
  WorkflowCheckpointStorage,
} from "../../../workflow/checkpoint";
import { attachHooksObserver } from "../../../workflow/hooks";
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
    const sessionId = getSessionId(ctx);
    const user = getSessionUser(ctx.session);
    if (!sessionId || !user?.id) {
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
          ReflectionObserver,
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

      // Best-effort: mark run as running and resolve projectId for scoping.
      let projectId: string | undefined;
      try {
        const { workflowRepo } = await import("@alfred/db");
        const run = await workflowRepo.getRun(input.runId);
        projectId = run?.projectId ?? undefined;
        await workflowRepo.updateRun(input.runId, {
          errorMessage: null,
          resumedAt: new Date(),
          status: "running",
          suspendedAt: null,
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

      await attachHooksObserver(runner, {
        runId: input.runId,
        sessionId,
        signal: new AbortController().signal,
        workspace: input.workspace ?? process.cwd(),
      });

      runner.addObserver(new MetricsObserver());
      runner.addObserver(new CostCleanupObserver());
      runner.addObserver(new CheckpointObserver(storage));

      // LLM-driven learning extraction. Gated behind ALFRED_ENRICHMENT.
      // Injects two callbacks so @alfred/pipeline never imports @alfred/db.
      let gatherContext: GatherExecutionContextFn | undefined;
      let persistLearning: PersistLearningFn | undefined;
      const workspace = input.workspace ?? process.cwd();
      if (process.env.ALFRED_ENRICHMENT === "1") {
        try {
          const { graphRepo, workflowRepo } = await import("@alfred/db");
          const createHash = await import("node:crypto").then(
            (m) => m.createHash
          );

          gatherContext = async (runId) => {
            const [run, errorEvents, toolResultEvents, agentCompleteEvents] =
              await Promise.all([
                workflowRepo.getRun(runId),
                workflowRepo.listEventsByType(runId, "error"),
                workflowRepo.listEventsByType(runId, "tool-result"),
                workflowRepo.listEventsByType(runId, "agent-complete"),
              ]);

            const compilation =
              ((run?.stateData as Record<string, unknown> | null)
                ?.compilation as Record<string, unknown> | null) ?? null;

            const errors = errorEvents.slice(0, 10).map((e) => {
              const data = e.eventData as Record<string, unknown> | null;
              return String(data?.message ?? data?.error ?? "unknown error");
            });

            const toolFailures = toolResultEvents
              .filter((e) => {
                const data = e.eventData as Record<string, unknown> | null;
                return data?.isError === true;
              })
              .slice(0, 10)
              .map((e) => {
                const data = e.eventData as Record<string, unknown> | null;
                return String(data?.toolName ?? "unknown tool");
              });

            const agentOutcomes = agentCompleteEvents.slice(0, 10).map((e) => {
              const data = e.eventData as Record<string, unknown> | null;
              return `${String(data?.agentId ?? "agent")}: ${String(data?.status ?? "unknown")}`;
            });

            return {
              compilation,
              eventSummary: { errors, toolFailures, agentOutcomes },
            };
          };

          persistLearning = async (learning) => {
            const hash = createHash("sha256")
              .update(`${learning.runId}:${learning.content}`)
              .digest("hex")
              .slice(0, 32);
            await graphRepo.createNode(
              workspace,
              hash,
              "task_learning",
              learning.content,
              {
                runId: learning.runId,
                taskId: learning.taskId,
                category: learning.category,
                confidence: learning.confidence,
                outcome: learning.outcome,
                source: learning.source,
                ts: Date.now(),
              },
              learning.projectId
            );
          };
        } catch {
          // DB unavailable — enrichment degrades silently
          gatherContext = undefined;
          persistLearning = undefined;
        }
      }

      runner.addObserver(
        new ReflectionObserver({
          runId: input.runId,
          workspace,
          projectId,
          gatherContext,
          persistLearning,
        })
      );
      runner.addObserver(
        new CompilationObserver({
          requirement: snapshot.requirement,
          runId: input.runId,
        })
      );
      runner.addObserver(
        new ConciergeObserver({
          runId: input.runId,
          userId: user.id,
        })
      );

      if (input.linear?.sessionId && input.authzLinear) {
        runner.addObserver(
          new LinearSyncObserver({
            authz: input.authzLinear,
            issueId: input.linear.issueId ?? input.linear.sessionId,
            space: input.linear.space,
            syncIntervalMs: 30_000,
          })
        );
      }

      const pipelineInput = {
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
        requirement: snapshot.requirement,
        runId: input.runId,
        userId: input.userId ?? user.id,
        workspace: input.workspace,
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

        updatedSnapshot.contextEntries = [...contextMap.entries()];
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
          const { createContextFromSnapshot } =
            await import("@alfred/pipeline/snapshot");
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
            const { phases } = plan;
            const { resources } = plan;
            const { evaluationCriteria } = plan;
            const intent =
              typeof plan.intent === "string" && plan.intent.length > 0
                ? plan.intent
                : finalSnapshot.requirement;

            if (phases && resources && evaluationCriteria) {
              await upsertWorkflowPatternFromCompletion({
                durationMs: Math.max(
                  0,
                  finalSnapshot.lastEventAt - finalSnapshot.startedAt
                ),
                intent,
                planTemplate: {
                  phases,
                  resources,
                  evaluationCriteria,
                },
                projectId: initOutput?.projectId ?? null,
                userId: user.id,
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
          completedAt:
            status === "completed" || status === "failed" ? new Date() : null,
          errorMessage:
            status === "failed"
              ? (finalSnapshot?.error ?? "pipeline_failed")
              : null,
          status:
            status === "completed"
              ? "completed"
              : (status === "suspended"
                ? "suspended"
                : "failed"),
          suspendedAt: status === "suspended" ? new Date() : null,
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
        completed: status === "completed",
        runId: input.runId,
        status,
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
      authz: z.string().optional(),
      authzLinear: z.string().optional(),
      dryRun: z.boolean().optional(),
      linear: linearInputSchema.optional(),
      runId: z.string().min(1),
      skipTaskIds: z.array(z.string()).optional(),
      waveIds: z.array(z.string()).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const user = getSessionUser(ctx.session);
    if (!getSessionId(ctx) || !user?.id) {
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

      const { createContextFromSnapshot } =
        await import("@alfred/pipeline/snapshot");
      const ctxDecoded = createContextFromSnapshot(snapshot, {
        emit: () => {},
      });

      const scheduleOutput = ctxDecoded.get("scheduleOutput") as
        | {
            waves: {
              id: string;
              agents: string[];
              dependsOn: string[];
            }[];
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
          contextEntries: [...contextMap.entries()],
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
          requirement: snapshot.requirement,
          runId: input.runId,
        })
      );

      if (input.linear?.sessionId && input.authzLinear) {
        runner.addObserver(
          new LinearSyncObserver({
            authz: input.authzLinear,
            issueId: input.linear.issueId ?? input.linear.sessionId,
            space: input.linear.space,
            syncIntervalMs: 30_000,
          })
        );
      }

      const userId = ctxDecoded.get<string>("userId") ?? user.id;

      const pipelineInput = {
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
        requirement: snapshot.requirement,
        runId: input.runId,
        userId,
        workspace,
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
        completed: status === "completed",
        runId: input.runId,
        status,
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
