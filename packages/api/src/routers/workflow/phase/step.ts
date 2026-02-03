import type { StageName } from "@alfred/pipeline";

import { TRPCError } from "@trpc/server";
import { performance } from "node:perf_hooks";
import { z } from "zod";

import { requirePolicy } from "../../../gate";
import { ConciergeObserver } from "../../../services/concierge";
import { authedProcedure, rateLimit } from "../../../trpc";
import { toTRPCError } from "../../../utils/error";
import { getSessionId, getSessionUser } from "../../../utils/session";
import {
  getTestCheckpointStorage,
  WorkflowCheckpointStorage,
} from "../../../workflow/checkpoint";
import { createCognitiveBridge } from "../../../workflow/cognitive";
import { attachHooksObserver } from "../../../workflow/hooks";
import { linearInputSchema } from "../../../workflow/input";
import { mapWorkflowRunResourceLocal } from "../../../workflow/resource";

const isTestMode =
  process.env.VITE_TEST_MODE === "true" || process.env.MINDSCAPE_TEST === "1";

const stageNameSchema = z.enum([
  "init",
  "context",
  "plan",
  "schedule",
  "execute",
  "review",
  "learn",
  "summarize",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stageOutputSummary(
  stage: StageName,
  output: unknown
): Record<string, unknown> {
  const out = isRecord(output) ? output : {};

  if (stage === "init") {
    return {
      projectId: typeof out.projectId === "string" ? out.projectId : undefined,
    };
  }

  if (stage === "context") {
    return {
      totalTokens:
        typeof out.totalTokens === "number" ? Math.trunc(out.totalTokens) : 0,
      ragChunkCount: Array.isArray(out.ragChunks) ? out.ragChunks.length : 0,
    };
  }

  if (stage === "plan") {
    const subtasks = Array.isArray(out.subtasks) ? out.subtasks : [];
    return {
      planId: typeof out.planId === "string" ? out.planId : undefined,
      subtaskCount: subtasks.length,
      rootPlanPath:
        typeof out.rootPlanPath === "string" ? out.rootPlanPath : undefined,
    };
  }

  if (stage === "schedule") {
    const waves = Array.isArray(out.waves) ? out.waves : [];
    return {
      executionMode:
        out.executionMode === "parallel" || out.executionMode === "sequential"
          ? out.executionMode
          : undefined,
      waveCount: waves.length,
      estimatedDuration:
        typeof out.estimatedDuration === "number"
          ? Math.trunc(out.estimatedDuration)
          : undefined,
    };
  }

  if (stage === "execute") {
    const fileChanges = Array.isArray(out.fileChanges) ? out.fileChanges : [];
    const { outcomes } = out;
    const outcomeCount =
      outcomes instanceof Map
        ? outcomes.size
        : isRecord(outcomes) && Array.isArray(outcomes.entries)
          ? outcomes.entries.length
          : isRecord(outcomes)
            ? Object.keys(outcomes).length
            : 0;
    return {
      dryRun: out.dryRun === true,
      fileChangeCount: fileChanges.length,
      outcomeCount,
    };
  }

  if (stage === "review") {
    const checks = Array.isArray(out.checks) ? out.checks : [];
    return {
      allPassed: out.allPassed === true,
      checkCount: checks.length,
      fixAttempts: typeof out.fixAttempts === "number" ? out.fixAttempts : 0,
    };
  }

  if (stage === "learn") {
    const insights = Array.isArray(out.insights) ? out.insights : [];
    const mistakes = Array.isArray(out.mistakes) ? out.mistakes : [];
    return {
      insightCount: insights.length,
      mistakeCount: mistakes.length,
      graphUpdates:
        typeof out.graphUpdates === "number" ? Math.trunc(out.graphUpdates) : 0,
    };
  }

  if (stage === "summarize") {
    const summary = typeof out.summary === "string" ? out.summary.trim() : "";
    return {
      hasSummary: summary.length > 0,
      summaryText: summary.length > 0 ? summary.slice(0, 200) : undefined,
    };
  }

  return {};
}

const workflowStepPolicy = requirePolicy("workflow.execute", (raw) =>
  mapWorkflowRunResourceLocal(raw)
);

const phaseStepProcedure = isTestMode
  ? authedProcedure.use(rateLimit)
  : authedProcedure.use(rateLimit).use(workflowStepPolicy);

export const workflowPhaseStepProcedure = phaseStepProcedure
  .input(
    z.object({
      runId: z.string().min(1),
      untilStage: stageNameSchema,
      // When snapshot does not exist, these are required.
      requirement: z.string().min(1).optional(),
      workspace: z.string().min(1).optional(),
      // Tool authz (Bearer <jwt>) for executor tools (docker/codex/droid/etc)
      authz: z.string().optional(),
      // Optional Linear integration input
      linear: linearInputSchema.optional(),
      authzLinear: z.string().optional(),
      // Optional execution overrides (applied via snapshot context)
      waveIds: z.array(z.string().min(1)).optional(),
      skipTaskIds: z.array(z.string().min(1)).optional(),
      dryRun: z.boolean().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const sessionId = getSessionId(ctx);
    const user = getSessionUser(ctx.session);
    if (!sessionId || !user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const startedAt = performance.now();

    try {
      const [
        { PipelineRunner, STAGE_ORDER, registerDefaultStages },
        { CheckpointObserver, CostCleanupObserver, MetricsObserver },
        { PostgresCheckpointStorage },
        { getResumeStage, createContextFromSnapshot },
      ] = await Promise.all([
        import("@alfred/pipeline"),
        import("@alfred/pipeline/observers"),
        import("@alfred/db/repo/workflow"),
        import("@alfred/pipeline/snapshot"),
      ]);

      const storageInner = isTestMode
        ? getTestCheckpointStorage()
        : new PostgresCheckpointStorage();
      const storage = new WorkflowCheckpointStorage(storageInner);

      const stopIndex = STAGE_ORDER.indexOf(input.untilStage);
      if (stopIndex === -1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "stage_invalid",
        });
      }

      const existingSnapshot = await storage.load(input.runId);

      // If stage already completed, this is an idempotent no-op.
      if (
        existingSnapshot &&
        existingSnapshot.lastCompletedStageIndex >= stopIndex
      ) {
        const ctxDecoded = createContextFromSnapshot(existingSnapshot, {
          emit: () => {},
        });
        const workspace =
          ctxDecoded.get<string>("workspace") ??
          input.workspace ??
          process.cwd();
        const cognitive = createCognitiveBridge({
          requirement: existingSnapshot.requirement,
          runId: existingSnapshot.runId,
          source: "phase",
          startedAtMs: existingSnapshot.startedAt,
          userId: user.id,
          workspace,
        });
        await cognitive.ensureInput();

        const output = ctxDecoded.get(`${input.untilStage}Output`);
        const nextStage = getResumeStage(existingSnapshot);
        const canResume =
          existingSnapshot.status !== "completed" &&
          existingSnapshot.status !== "failed" &&
          nextStage !== null;

        return {
          canResume,
          durationMs: Math.round(performance.now() - startedAt),
          lastCompletedStage: existingSnapshot.lastCompletedStage,
          lastCompletedStageIndex: existingSnapshot.lastCompletedStageIndex,
          nextStage,
          outputSummary: stageOutputSummary(input.untilStage, output),
          runId: existingSnapshot.runId,
          stageResults: existingSnapshot.stageResults ?? [],
          status: existingSnapshot.status,
          untilStage: input.untilStage,
        };
      }

      // Create/ensure workflow run row exists before snapshots are persisted (FK).
      // Best-effort: if DB is unavailable, checkpointing will fail later anyway.
      try {
        const { workflowRepo } = await import("@alfred/db");
        const existingRun = await workflowRepo.getRun(input.runId);
        if (!existingRun) {
          const requirement = input.requirement?.trim();
          if (!requirement) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "requirement_required",
            });
          }
          const workspace = input.workspace ?? process.cwd();
          await workflowRepo.createRun({
            id: input.runId,
            inputData: {
              requirement,
              workspace,
              runId: input.runId,
            },
            linearIssueId: input.linear?.issueId,
            linearSessionId: input.linear?.sessionId,
            linearSpace: input.linear?.space,
            planId: undefined,
            projectId: undefined,
            requirement,
            status: "running",
            userId: user.id,
            workflowId: "pipeline",
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        // ignore; proceed best-effort
      }

      const runner = new PipelineRunner({
        enableLearning: false,
        enableLinearSync: false,
        maxParallel: 1,
      });
      registerDefaultStages(runner);

      const resolveWorkspace = async (): Promise<string> => {
        if (typeof input.workspace === "string" && input.workspace.length > 0) {
          return input.workspace;
        }
        const snap = await storage.load(input.runId);
        if (!snap) {
          return process.cwd();
        }
        const ctxDecoded = createContextFromSnapshot(snap, { emit: () => {} });
        const fromCtx = ctxDecoded.get<string>("workspace");
        if (typeof fromCtx === "string" && fromCtx.length > 0) {
          return fromCtx;
        }
        const planOutput = ctxDecoded.get("planOutput") as
          | { rootPlanPath?: unknown }
          | undefined;
        const rootPlanPath = planOutput?.rootPlanPath;
        if (typeof rootPlanPath === "string" && rootPlanPath.length > 0) {
          // <workspace>/.agent/plans/<runId>/root.md
          const path = await import("node:path");
          return path.resolve(rootPlanPath, "..", "..", "..", "..");
        }
        return process.cwd();
      };

      const workspace = await resolveWorkspace();

      const requirement =
        existingSnapshot?.requirement ??
        input.requirement ??
        "workflow_step_missing_requirement";
      const runStartedAtMs = existingSnapshot?.startedAt ?? Date.now();
      const cognitive = createCognitiveBridge({
        requirement,
        runId: input.runId,
        source: "phase",
        startedAtMs: runStartedAtMs,
        userId: user.id,
        workspace,
      });
      const autonomyLevel = await cognitive.ensureInput();

      await attachHooksObserver(runner, {
        runId: input.runId,
        sessionId,
        signal: new AbortController().signal,
        workspace,
      });

      runner.addObserver(new MetricsObserver());
      runner.addObserver(new CostCleanupObserver());
      runner.addObserver(new CheckpointObserver(storage));
      runner.addObserver(
        new ConciergeObserver({ runId: input.runId, userId: user.id })
      );

      // Update snapshot context with execution overrides / authz if needed.
      const snapshotBeforeRun = await storage.load(input.runId);
      if (snapshotBeforeRun) {
        const contextMap = new Map(snapshotBeforeRun.contextEntries ?? []);
        // Ensure cognitive stream keys are available for resumed stage stepping.
        contextMap.set("cognitiveStreamId", cognitive.streamId);
        if (typeof autonomyLevel === "number") {
          contextMap.set("autonomyLevel", autonomyLevel);
        }
        if (typeof input.authz === "string") {
          contextMap.set("authz", input.authz);
        }
        if (typeof input.authzLinear === "string") {
          contextMap.set("linearAuthz", input.authzLinear);
        }
        if (input.waveIds) {
          contextMap.set("waveIds", input.waveIds);
        }
        if (input.skipTaskIds) {
          contextMap.set("skipTaskIds", input.skipTaskIds);
        }
        if (typeof input.dryRun === "boolean") {
          contextMap.set("dryRun", input.dryRun);
        }
        await storage.save(input.runId, {
          ...snapshotBeforeRun,
          contextEntries: [...contextMap.entries()],
        });
      }

      const pipelineInput = {
        authz: input.authz,
        cognitive: {
          autonomyLevel: autonomyLevel ?? undefined,
          streamId: cognitive.streamId,
        },
        linear: input.linear
          ? {
              sessionId: input.linear.sessionId ?? "",
              space: input.linear.space,
              teamId: input.linear.teamId,
              issueId: input.linear.issueId,
              authz: input.authzLinear ?? "",
            }
          : undefined,
        requirement,
        runId: input.runId,
        userId: user.id,
        workspace,
      };

      const snapshotForRun = await storage.load(input.runId);
      if (snapshotForRun) {
        for await (const _event of runner.resumeUntilStage(
          snapshotForRun,
          pipelineInput,
          input.untilStage
        )) {
          if (
            _event.type === "agent:complete" ||
            _event.type === "agent:escalate-request" ||
            _event.type === "pipeline:complete" ||
            _event.type === "pipeline:failed" ||
            _event.type === "pipeline:suspend"
          ) {
            await cognitive.handlePipelineEvent(_event);
          }
        }
      } else {
        // New run: run from start until requested stage.
        for await (const _event of runner.runUntilStage(
          pipelineInput,
          input.untilStage
        )) {
          if (
            _event.type === "agent:complete" ||
            _event.type === "agent:escalate-request" ||
            _event.type === "pipeline:complete" ||
            _event.type === "pipeline:failed" ||
            _event.type === "pipeline:suspend"
          ) {
            await cognitive.handlePipelineEvent(_event);
          }
        }
      }

      const finalSnapshot = await storage.load(input.runId);
      if (!finalSnapshot) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "snapshot_not_found_after_step",
        });
      }

      const ctxDecoded = createContextFromSnapshot(finalSnapshot, {
        emit: () => {},
      });
      const output = ctxDecoded.get(`${input.untilStage}Output`);
      const nextStage = getResumeStage(finalSnapshot);
      const canResume =
        finalSnapshot.status !== "completed" &&
        finalSnapshot.status !== "failed" &&
        nextStage !== null;

      return {
        canResume,
        durationMs: Math.round(performance.now() - startedAt),
        lastCompletedStage: finalSnapshot.lastCompletedStage,
        lastCompletedStageIndex: finalSnapshot.lastCompletedStageIndex,
        nextStage,
        outputSummary: stageOutputSummary(input.untilStage, output),
        runId: finalSnapshot.runId,
        stageResults: finalSnapshot.stageResults ?? [],
        status: finalSnapshot.status,
        untilStage: input.untilStage,
      };
    } catch (error) {
      throw toTRPCError(error, "workflow_phase_step_failed");
    }
  });
