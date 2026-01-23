import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePolicy } from "../../../gate";
import { authedProcedure, rateLimit } from "../../../trpc";
import { toTRPCError } from "../../../utils/error";
import {
  getTestCheckpointStorage,
  WorkflowCheckpointStorage,
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

export const workflowPhaseApproveAndExecuteProcedure = phaseExecuteProcedure
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

      const { workflowRepo: dbWorkflowRepo, planRepo } = await import(
        "@alfred/db"
      );

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
      await dbWorkflowRepo.updateRun(input.runId, {
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
  });
