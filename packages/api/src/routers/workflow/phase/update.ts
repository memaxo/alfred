import { type PipelineSnapshot } from "@alfred/pipeline";
import { TRPCError } from "@trpc/server";
import { performance } from "node:perf_hooks";
import { z } from "zod";

import { requirePolicy } from "../../../gate";
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

export const workflowPhaseUpdatePlanProcedure = phasePlanProcedure
  .input(
    z.object({
      runId: z.string().min(1),
      structuredPlan: z.unknown(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { session } = ctx;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const startTime = performance.now();

    try {
      const { phaseUpdatePlanDurationSeconds } =
        await import("@alfred/pipeline/metrics");

      const { structuredPlanSchema } = await import("@alfred/plan/schema");
      const { hasCycles, planToWaves } = await import("@alfred/plan/generate");

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
        contextEntries: [...ctxMap.entries()],
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
        structuredPlan: parsedPlan,
        subtasks,
        waveCount: waves.length,
        waves,
      };
    } catch (error) {
      const durationSec = (performance.now() - startTime) / 1000;
      const { phaseUpdatePlanDurationSeconds } =
        await import("@alfred/pipeline/metrics");
      phaseUpdatePlanDurationSeconds.observe(durationSec);

      throw toTRPCError(error, "workflow_phase_update_plan_failed");
    }
  });
