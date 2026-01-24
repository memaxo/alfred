import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { focusCommitments, focusSets } from "./focus";
import { workflowRuns } from "./workflow";

export type DeltaBriefScope = "focus_set" | "commitment" | "workflow_run";

export const deltaBriefs = pgTable("delta_briefs", {
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
  scope: text("scope").$type<DeltaBriefScope>().notNull(),
  sinceAt: timestamp("since_at", { withTimezone: true }),
  untilAt: timestamp("until_at", { withTimezone: true }),
  summaryText: text("summary_text").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type DeltaBrief = typeof deltaBriefs.$inferSelect;
export type NewDeltaBrief = typeof deltaBriefs.$inferInsert;
