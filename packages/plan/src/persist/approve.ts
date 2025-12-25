import { planRepo, workflowRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { convertPlanToWavePlan } from "@alfred/runtime";
import type { WorkflowPlan } from "@alfred/db/schema/plan";

/**
 * Approve a plan and trigger workflow execution
 */
export async function approvePlan(
  planId: string,
  userId: string
): Promise<{ plan: WorkflowPlan; runId: string }> {
  // 1. Load plan
  const savedPlan = await planRepo.getPlanById(planId);
  if (!savedPlan) {
    throw new Error(`Plan ${planId} not found`);
  }

  // 2. Check approval status
  if (savedPlan.status !== "pending") {
    throw new Error(`Plan ${planId} already ${savedPlan.status}`);
  }

  // 3. Approve plan in DB
  const approved = await planRepo.updatePlanStatus(planId, "approved", userId);

  // 4. Create workflow run from plan
  const runId = await createWorkflowRun(approved);

  // 5. Update plan status to "executed"
  await planRepo.updatePlanStatus(planId, "executed");

  logger.info("plan_approved_and_executed", {
    planId,
    runId,
    userId,
  });

  return { plan: approved, runId };
}

/**
 * Reject a plan
 */
export async function rejectPlan(
  planId: string,
  _userId: string,
  reason?: string
): Promise<WorkflowPlan> {
  const rejected = await planRepo.updatePlanStatus(planId, "rejected");

  if (reason) {
    // Optionally store reason in plan metadata if schema supports it
    await planRepo.updatePlan(planId, {
      plan: {
        ...(rejected.plan as any),
        rejectionReason: reason,
      },
    });
  }

  logger.info("plan_rejected", {
    planId,
    reason,
  });

  return rejected;
}

async function createWorkflowRun(plan: WorkflowPlan): Promise<string> {
  // Convert StructuredPlan → WavePlan (P3-1)
  const wavePlan = await convertPlanToWavePlan(plan.plan as any);

  // Create workflow run in DB
  // Note: We're reusing the plan ID as the base for the run ID or generating a new one
  const runId = crypto.randomUUID();

  await workflowRepo.createRun({
    id: runId,
    userId: plan.userId,
    workflowId: "plan",
    status: "running",
    requirement: plan.intent,
    projectId: plan.projectId ?? undefined,
    // Add plan context to run data
    inputData: {
      planId: plan.id,
      intent: plan.intent,
      wavePlan,
    },
  });

  return runId;
}
