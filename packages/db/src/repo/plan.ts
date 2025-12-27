// packages/db/src/repo/plan.ts
import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  type NewWorkflowPlan,
  type WorkflowPlan,
  workflowPlans,
} from "../schema/plan";

/**
 * Create a new workflow plan
 */
export async function createPlan(data: NewWorkflowPlan): Promise<WorkflowPlan> {
  const [row] = await db.insert(workflowPlans).values(data).returning();
  if (!row) {
    throw new Error("plan_creation_failed");
  }
  return row;
}

/**
 * Find plan by ID
 */
export async function getPlanById(id: string): Promise<WorkflowPlan | null> {
  const [row] = await db
    .select()
    .from(workflowPlans)
    .where(eq(workflowPlans.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Update plan status
 */
export async function updatePlanStatus(
  id: string,
  status: WorkflowPlan["status"],
  userId?: string
): Promise<WorkflowPlan> {
  const updateData: Partial<WorkflowPlan> = {
    status,
    updatedAt: sql`NOW()` as unknown as Date,
  };

  if (status === "approved" && userId) {
    updateData.approvedAt = sql`NOW()` as unknown as Date;
    updateData.approvedBy = userId;
  }

  const [row] = await db
    .update(workflowPlans)
    .set(updateData)
    .where(eq(workflowPlans.id, id))
    .returning();

  if (!row) {
    throw new Error("plan_update_failed");
  }
  return row;
}

/**
 * List plans for a user
 */
export async function getPlansByUserId(
  userId: string
): Promise<WorkflowPlan[]> {
  return await db
    .select()
    .from(workflowPlans)
    .where(eq(workflowPlans.userId, userId))
    .orderBy(sql`${workflowPlans.createdAt} DESC`);
}

/**
 * Update plan data (generic)
 */
export async function updatePlan(
  id: string,
  data: Partial<Omit<WorkflowPlan, "id" | "userId" | "createdAt">>
): Promise<WorkflowPlan> {
  const [row] = await db
    .update(workflowPlans)
    .set({
      ...data,
      updatedAt: sql`NOW()` as unknown as Date,
    })
    .where(eq(workflowPlans.id, id))
    .returning();

  if (!row) {
    throw new Error("plan_update_failed");
  }
  return row;
}
