/**
 * Plan Templates Schema
 *
 * Reusable workflow plan templates for common patterns.
 */

import {
  decimal,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const planTemplates = pgTable(
  "plan_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    triggerPattern: text("trigger_pattern"),
    planData: jsonb("plan_data").notNull(),
    successRate: decimal("success_rate", { precision: 5, scale: 2 }),
    usageCount: text("usage_count").default("0"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_plan_templates_user").on(table.userId),
    triggerIdx: index("idx_plan_templates_trigger").on(table.triggerPattern),
    usageIdx: index("idx_plan_templates_usage").on(
      table.usageCount,
      table.successRate
    ),
    createdIdx: index("idx_plan_templates_created").on(table.createdAt),
  })
);

export type PlanTemplate = typeof planTemplates.$inferSelect;
export type NewPlanTemplate = typeof planTemplates.$inferInsert;
