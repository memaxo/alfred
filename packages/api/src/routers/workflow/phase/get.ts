import { planPhaseOutputSchema } from "@alfred/pipeline/schemas";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePolicy } from "../../../gate";
import { authedProcedure, rateLimit } from "../../../trpc";
import { toTRPCError } from "../../../utils/error";
import {
  WorkflowCheckpointStorage,
  getTestCheckpointStorage,
} from "../../../workflow/checkpoint";
import { mapWorkflowRunResourceLocal } from "../../../workflow/resource";

const isTestMode =
  process.env.VITE_TEST_MODE === "true" || process.env.MINDSCAPE_TEST === "1";

const workflowExecutePolicy = requirePolicy("workflow.execute", (raw) =>
  mapWorkflowRunResourceLocal(raw)
);

const phaseExecuteProcedure = isTestMode
  ? authedProcedure.use(rateLimit)
  : authedProcedure.use(rateLimit).use(workflowExecutePolicy);

export const workflowPhaseGetPlanProcedure = phaseExecuteProcedure
  .input(z.object({ runId: z.string().min(1) }))
  .query(async ({ input }) => {
    try {
      const storage = isTestMode
        ? new WorkflowCheckpointStorage(getTestCheckpointStorage())
        : new WorkflowCheckpointStorage(
            new (await import("@alfred/db/repo/workflow")).PostgresCheckpointStorage()
          );
      const snapshot = await storage.load(input.runId);
      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "snapshot_not_found",
        });
      }

      const { createContextFromSnapshot } = await import("@alfred/pipeline/snapshot");
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
  });

