/**
 * ALFRED Workflow Schema
 * Durable execution tracking for workflows
 */

import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { workflowPlans } from "./plan";
import { projects } from "./project";

export type WorkflowRunStatus =
  | "running"
  | "suspended"
  | "completed"
  | "failed"
  | "cancelled";

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  planId: uuid("plan_id").references(() => workflowPlans.id, {
    onDelete: "set null",
  }), // Link to structured plan
  requirement: text("requirement"), // Copy of intent/requirement
  workflowId: text("workflow_id").notNull(),
  status: text("status")
    .$type<WorkflowRunStatus>()
    .notNull()
    .default("running"),
  // JSONB handling. Use as any for Drizzle limitation.
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

export type WorkflowEventType =
  | "run"
  | "progress"
  | "stdout"
  | "stderr"
  | "droid"
  | "notice"
  | "error"
  | "ui-message"
  | "text-delta"
  | "tool-call"
  | "tool-result"
  | "reasoning"
  | "finish"
  | "data-status"
  | "file"
  | "obligation"
  | "data-cache-handoff"
  | "context"
  | "plan-selected"
  | "phase-start"
  | "phase-complete"
  | "phase-progress"
  | "agent-start"
  | "agent-complete"
  | "wave-start"
  | "wave-complete"
  | "agent-handoff"
  | "assistant"
  | "report"
  | "require-scope"
  | "step-start"
  | "step-complete"
  | "step-skip"
  | "step_start"
  | "step_complete"
  | "suspend"
  | "resume";

// Self-referential table: workflowEvents references itself via parentId
// TypeScript cannot infer types for self-referential tables, so we use a type assertion
// The self-reference works correctly at runtime; this is purely a type-level limitation
const _workflowEventsTable = pgTable(
  "workflow_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").defaultRandom().notNull().unique(),
    eventType: text("event_type").$type<WorkflowEventType>().notNull(),
    // JSONB handling. Use as any for Drizzle limitation.
    eventData: jsonb("event_data"),
    stepId: text("step_id"),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
    // Debugger fields for causal linking and ordering
    // Self-reference: parent event ID for causal chain
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => _workflowEventsTable.eventId
    ),
    seq: integer("seq"), // Monotonic sequence number per run (like codex_events.seq)
    lamport: integer("lamport"), // Lamport clock for cross-run ordering
  },
  (t) => ({
    runSeqIdx: index("workflow_events_run_seq_idx").on(t.runId, t.seq),
    parentIdIdx: index("workflow_events_parent_id_idx").on(t.parentId),
    lamportIdx: index("workflow_events_lamport_idx").on(t.lamport),
    runSeqTimestampIdx: index("workflow_events_run_seq_timestamp_idx").on(
      t.runId,
      t.seq,
      t.timestamp
    ),
  })
);

export const workflowEvents = _workflowEventsTable;

export const workflowSnapshots = pgTable(
  "workflow_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    // JSONB handling. Use as any for Drizzle limitation.
    state: jsonb("state").notNull(),
    lastEventId: uuid("last_event_id")
      .notNull()
      .references(() => _workflowEventsTable.eventId),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    runIdx: index("workflow_snapshots_run_idx").on(t.runId),
    createdIdx: index("workflow_snapshots_created_idx").on(t.createdAt),
    runCreatedIdx: index("workflow_snapshots_run_created_idx").on(
      t.runId,
      t.createdAt
    ),
    lastEventIdIdx: index("workflow_snapshots_last_event_id_idx").on(
      t.lastEventId
    ),
  })
);

export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type NewWorkflowRun = typeof workflowRuns.$inferInsert;
export type WorkflowEvent = typeof workflowEvents.$inferSelect;
export type NewWorkflowEvent = typeof workflowEvents.$inferInsert;
export type WorkflowSnapshot = typeof workflowSnapshots.$inferSelect;
export type NewWorkflowSnapshot = typeof workflowSnapshots.$inferInsert;
