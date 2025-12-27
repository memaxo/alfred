/**
 * ALFRED Task Queue Schema
 * Background task queue for idle-time processing
 */

import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Task queue - tasks to be processed during idle time
 */
export const taskQueue = pgTable("task_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),

  // Task definition
  type: text("type").notNull(), // "reminder" | "webhook" | "improvement" | "consolidation" | "dreaming"
  priority: integer("priority").default(5), // 1-10, higher = more urgent
  payload: jsonb("payload").notNull(), // Task-specific data

  // Source tracking
  source: text("source"), // "reminder" | "linear_webhook" | "github_webhook" | "calendar" | "physiology"
  sourceId: text("source_id"), // Original trigger ID (e.g., reminder ID)

  // Scheduling
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }), // When to process (null = asap)
  blockedBy: uuid("blocked_by"), // Dependency on another task

  // Status
  status: text("status").default("pending"), // "pending" | "running" | "completed" | "failed" | "cancelled"
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  lastError: text("last_error"),

  // Execution tracking
  started: timestamp("started_at", { withTimezone: true }),
  completed: timestamp("completed_at", { withTimezone: true }),

  // Result
  result: jsonb("result"), // Task output/result data

  // Budget estimation
  estimatedTokens: integer("estimated_tokens"), // Pre-estimated token cost
  actualTokens: integer("actual_tokens"), // Actual tokens used
  costCents: integer("cost_cents"), // Actual cost

  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Index coverage: migration 0062 handles status, user_id, priority indexes

/**
 * Task dependencies - many-to-many relationship for complex task chains
 */
export const taskDependencies = pgTable("task_dependencies", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull(), // The task that depends on another
  dependsOnId: uuid("depends_on_id").notNull(), // The task it depends on
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Task execution log - audit trail of task processing
 */
export const taskExecutionLog = pgTable("task_execution_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull(),
  userId: text("user_id").notNull(),

  // Execution details
  attempt: integer("attempt").notNull(),
  status: text("status").notNull(), // "started" | "completed" | "failed"
  error: text("error"),

  // Performance
  durationMs: integer("duration_ms"),
  tokensUsed: integer("tokens_used"),
  costCents: integer("cost_cents"),

  // Model used
  modelRef: text("model_ref"),

  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});
