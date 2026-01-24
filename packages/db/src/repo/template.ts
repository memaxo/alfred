/**
 * Plan Templates Repository
 *
 * CRUD operations for reusable workflow plan templates.
 */

import { eq, sql } from "drizzle-orm";

import { db } from "../client.js";
import { planTemplates } from "../schema/template.js";

export type PlanTemplate = typeof planTemplates.$inferSelect;
export type NewPlanTemplate = typeof planTemplates.$inferInsert;

/**
 * Save a new plan template.
 */
export async function saveTemplate(
  userId: string,
  name: string,
  planData: unknown,
  options?: {
    description?: string;
    triggerPattern?: string;
  }
): Promise<string> {
  const [template] = await db
    .insert(planTemplates)
    .values({
      userId,
      name,
      planData: planData as typeof planTemplates.$inferInsert.planData,
      description: options?.description,
      triggerPattern: options?.triggerPattern,
    })
    .returning();

  if (!template?.id) {
    throw new Error("Failed to save template");
  }

  return template.id;
}

/**
 * List all templates for a user.
 */
export async function listTemplates(userId: string): Promise<PlanTemplate[]> {
  return await db
    .select()
    .from(planTemplates)
    .where(eq(planTemplates.userId, userId))
    .orderBy(
      sql`${planTemplates.usageCount} DESC, ${planTemplates.successRate} DESC`
    );
}

/**
 * Get a template by ID.
 */
export async function getTemplate(
  templateId: string
): Promise<PlanTemplate | null> {
  const [template] = await db
    .select()
    .from(planTemplates)
    .where(eq(planTemplates.id, templateId))
    .limit(1);

  return template ?? null;
}

/**
 * Match template by trigger pattern.
 * Returns the best matching template based on usage and success rate.
 */
export async function matchTemplate(
  requirement: string
): Promise<PlanTemplate | null> {
  // For now, simple text matching
  // In production, use semantic similarity or regex matching
  const templates = await db
    .select()
    .from(planTemplates)
    .where(sql`${planTemplates.triggerPattern} IS NOT NULL`)
    .orderBy(
      sql`${planTemplates.usageCount} DESC, ${planTemplates.successRate} DESC`
    );

  for (const template of templates) {
    if (
      template.triggerPattern &&
      requirement.toLowerCase().includes(template.triggerPattern.toLowerCase())
    ) {
      return template;
    }
  }

  return null;
}

/**
 * Apply template to a requirement.
 * Returns the raw plan data for now.
 */
export async function applyTemplate(
  templateId: string,
  _requirement: string
): Promise<unknown> {
  const template = await getTemplate(templateId);

  if (!template) {
    throw new Error("Template not found");
  }

  // Increment usage count and update last used
  await db
    .update(planTemplates)
    .set({
      usageCount: sql`${planTemplates.usageCount} + 1`,
      lastUsedAt: new Date(),
    })
    .where(eq(planTemplates.id, templateId));

  // Return plan data (with requirement substituted if needed)
  return template.planData;
}

/**
 * Update template success rate based on execution outcome.
 */
export async function updateTemplateSuccess(
  templateId: string,
  successful: boolean
): Promise<void> {
  const template = await getTemplate(templateId);

  if (!template) {
    return;
  }

  // Simple success rate calculation
  const usageCount =
    typeof template.usageCount === "number"
      ? template.usageCount
      : Number.parseInt(String(template.usageCount ?? 0), 10);
  const currentRate = Number.parseFloat(String(template.successRate ?? 0));

  const newSuccessCount = successful
    ? currentRate * usageCount + 100
    : currentRate * usageCount;
  const newRate = newSuccessCount / (usageCount + 1);

  await db
    .update(planTemplates)
    .set({
      successRate: newRate.toFixed(2),
    })
    .where(eq(planTemplates.id, templateId));
}

/**
 * Delete a template.
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  await db.delete(planTemplates).where(eq(planTemplates.id, templateId));
}
