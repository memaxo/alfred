/**
 * ALFRED Workflow Schema
 * Durable execution tracking for workflows
 */

import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  workflowId: text("workflow_id").notNull(),
  status: text("status").notNull().default("running"), // 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled'
  inputData: jsonb("input_data"),
  stateData: jsonb("state_data"), // Current workflow state
  webhookUrl: text("webhook_url"), // Webhook URL for resume
  webhookSecret: text("webhook_secret"), // Secret for webhook verification
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  resumedAt: timestamp("resumed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const workflowEvents = pgTable("workflow_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => workflowRuns.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // 'step_start' | 'step_complete' | 'suspend' | 'resume' | 'error'
  eventData: jsonb("event_data"),
  stepId: text("step_id"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

