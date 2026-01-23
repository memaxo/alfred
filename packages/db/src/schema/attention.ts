import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { focusCommitments, focusSets } from "./focus";
import { workflowRuns } from "./workflow";

export type AttentionStatus = "open" | "acknowledged" | "resolved";
export type AttentionUrgency = "low" | "normal" | "high" | "critical";

export const attentionItems = pgTable("attention_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  focusSetId: uuid("focus_set_id").references(() => focusSets.id, {
    onDelete: "cascade",
  }),
  commitmentId: uuid("commitment_id").references(() => focusCommitments.id, {
    onDelete: "set null",
  }),
  workflowRunId: uuid("workflow_run_id").references(() => workflowRuns.id, {
    onDelete: "set null",
  }),
  kind: text("kind").notNull(),
  status: text("status").$type<AttentionStatus>().notNull().default("open"),
  urgency: text("urgency").$type<AttentionUrgency>().notNull().default("normal"),
  title: text("title"),
  body: text("body"),
  payload: jsonb("payload"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type AttentionItem = typeof attentionItems.$inferSelect;
export type NewAttentionItem = typeof attentionItems.$inferInsert;

