/**
 * ALFRED Policy Schema
 * Audit logs and approval queue
 */

import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

// TODO: [Phase 9] Add proper indexes for policy queries

/**
 * Audit logs (policy decisions and enforcement)
 */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  traceId: text("trace_id"), // For correlating related actions
  action: text("action").notNull(), // "droid.exec" | "home.control" | "deploy.promote" | etc.
  resource: text("resource").notNull(), // Resource identifier
  decision: text("decision").notNull(), // "allow" | "deny"
  obligations: jsonb("obligations"), // Array of obligations like ["require_biometric"]
  context: jsonb("context"), // Request context (IP, user-agent, mfa status, etc.)
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

// TODO: [Phase 9] Add index on (userId, timestamp) for user audit trail
// TODO: [Phase 9] Add index on (traceId) for correlated actions
// TODO: [Phase 9] Add index on (action) for filtering by action type
// TODO: [Phase 9] Add retention policy (e.g., 90 days)

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

// TODO: [Phase 9] Add index on (userId, status) for pending approval queries
// TODO: [Phase 9] Add index on (expiresAt, status) for expiry cleanup
// TODO: [Phase 9] Add approval notification system
