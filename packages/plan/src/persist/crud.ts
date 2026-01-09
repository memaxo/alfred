import { planRepo } from "@alfred/db";
import type { WorkflowPlan } from "@alfred/db/schema/plan";
import type { StructuredPlan } from "../types";

/**
 * Create a new plan from intent
 */
export async function createPlan(
  intent: string,
  userId: string,
  plan: StructuredPlan
): Promise<string> {
  const saved = await planRepo.createPlan({
    userId,
    intent,
    plan,
    status: "pending",
  });
  return saved.id;
}

/**
 * Get plan by ID
 */
export async function getPlan(id: string): Promise<StructuredPlan | null> {
  const saved = await planRepo.getPlanById(id);
  if (!saved) {
    return null;
  }
  return saved.plan as StructuredPlan;
}

/**
 * Get complete plan record with metadata
 */
export async function getPlanRecord(id: string): Promise<WorkflowPlan | null> {
  return await planRepo.getPlanById(id);
}

/**
 * List plans with optional filters
 */
export type PlanFilters = {
  userId: string;
  status?: "pending" | "approved" | "rejected" | "executed";
  limit?: number;
  offset?: number;
};

export async function listPlans(
  filters: PlanFilters
): Promise<Array<{ id: string; plan: StructuredPlan; status: string }>> {
  const savedList = await planRepo.getPlansByUserId(filters.userId);

  let filtered = savedList;
  if (filters.status) {
    filtered = savedList.filter((p) => p.status === filters.status);
  }

  if (filters.limit !== undefined) {
    const start = filters.offset ?? 0;
    filtered = filtered.slice(start, start + filters.limit);
  } else if (filters.offset !== undefined) {
    filtered = filtered.slice(filters.offset);
  }

  return filtered.map((p) => ({
    id: p.id,
    plan: p.plan as StructuredPlan,
    status: p.status,
  }));
}

/**
 * Update plan data
 */
export async function updatePlan(
  id: string,
  updates: Partial<StructuredPlan>
): Promise<void> {
  const existing = await planRepo.getPlanById(id);
  if (!existing) {
    throw new Error("plan_not_found");
  }

  const updatedPlan = existing.plan as StructuredPlan;
  const updated: StructuredPlan = {
    ...updatedPlan,
    ...updates,
  };

  await planRepo.updatePlan(id, { plan: updated });
}

/**
 * Approve plan for execution (status only)
 */
export async function approvePlanStatus(
  id: string,
  userId: string
): Promise<void> {
  await planRepo.updatePlanStatus(id, "approved", userId);
}

/**
 * Delete plan
 */
export async function deletePlan(id: string): Promise<void> {
  await planRepo.deletePlan(id);
}
