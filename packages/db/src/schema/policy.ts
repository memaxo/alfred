/**
 * ALFRED Policy Schema
 * Audit logs and approval queue
 */

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./project";

// Index coverage: migrations 0041+ provide audit log and approval indexes.

/**
 * Audit logs (policy decisions and enforcement)
 */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  traceId: text("trace_id"), // For correlating related actions
  action: text("action").notNull(), // "droid.exec" | "home.control" | "deploy.promote" | etc.
  resource: text("resource").notNull(), // Resource identifier
  decision: text("decision").notNull(), // "allow" | "deny"
  obligations: jsonb("obligations"), // Array of obligations like ["require_biometric"]
  context: jsonb("context"), // Request context (IP, user-agent, mfa status, etc.)
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

// Index coverage: audit_logs_* indexes added in 0041; still need retention policy follow-up.

/**
 * Approvals (manual approval queue for high-risk actions)
 */
export const approvals = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  traceId: text("trace_id"), // Link to audit log
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  context: jsonb("context"), // Request context for approval review
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "denied"
  approvedBy: text("approved_by"), // User who approved/denied
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // Auto-deny after expiry
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"),
});

// Index coverage: approvals_* indexes from 0041; still need notification system.
