import { phaseStatusSchema } from "@alfred/pipeline/schemas";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure } from "../../../trpc";
import { toTRPCError } from "../../../utils/error";
import { WorkflowCheckpointStorage } from "../../../workflow/checkpoint";

export const workflowPhaseStatusProcedure = authedProcedure
  .input(z.object({ runId: z.string().min(1) }))
  .query(async ({ input }) => {
    try {
      const { PostgresCheckpointStorage } = await import("@alfred/db/repo/workflow");
      const { getResumeStage } = await import("@alfred/pipeline/snapshot");

      const storage = new WorkflowCheckpointStorage(new PostgresCheckpointStorage());
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
  });

