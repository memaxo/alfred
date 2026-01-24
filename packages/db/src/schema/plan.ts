// packages/db/src/schema/plan.ts
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { projects } from "./project";

export const workflowPlans = pgTable("workflow_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  intent: text("intent").notNull(),
  plan: jsonb("plan").notNull(),
  status: text("status").notNull().default("pending"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type WorkflowPlan = typeof workflowPlans.$inferSelect;
export type NewWorkflowPlan = typeof workflowPlans.$inferInsert;
