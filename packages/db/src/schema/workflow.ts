/**
 * ALFRED Workflow Schema
 * Durable execution tracking for workflows
 */

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./project";

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  planId: uuid("plan_id"), // Link to structured plan
  requirement: text("requirement"), // Copy of intent/requirement
  workflowId: text("workflow_id").notNull(),
  status: text("status").notNull().default("running"), // 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled'
  inputData: jsonb("input_data"),
  stateData: jsonb("state_data"), // Current workflow state
  webhookUrl: text("webhook_url"), // Webhook URL for resume
  webhookSecret: text("webhook_secret"), // Secret for webhook verification
  linearSessionId: text("linear_session_id"),
  linearSpace: text("linear_space"),
  linearIssueId: text("linear_issue_id"),
  linearIssueUrl: text("linear_issue_url"),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  resumedAt: timestamp("resumed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  learnedAt: timestamp("learned_at", { withTimezone: true }),
  dreamedAt: timestamp("dreamed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const workflowEvents = pgTable("workflow_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => workflowRuns.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").defaultRandom().notNull().unique(),
  eventType: text("event_type").notNull(), // 'step_start' | 'step_complete' | 'suspend' | 'resume' | 'error'
  eventData: jsonb("event_data"),
  stepId: text("step_id"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});
