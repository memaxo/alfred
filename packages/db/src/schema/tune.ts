/**
 * ALFRED Tune Jobs Schema
 * Stores fine-tuning job records
 */

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const tuneJobs = pgTable("tune_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  config: jsonb("config").notNull(),
  progress: jsonb("progress"),
  artifacts: jsonb("artifacts"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type TuneJob = typeof tuneJobs.$inferSelect;
export type TuneJobInsert = typeof tuneJobs.$inferInsert;

// Job status type for type safety
export type TuneJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
