/**
 * ALFRED Review Schema
 * Database tables for swipe-based AI action validation and code review
 */

import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { projects } from "./project";
import { workflowRuns } from "./workflow";

/**
 * Review types for different AI actions
 */
export type ReviewType =
  | "tool_execution"
  | "message"
  | "memory"
  | "workflow"
  | "code";

/**
 * Priority levels for reviews
 */
export type ReviewPriority = "low" | "medium" | "high" | "critical";

/**
 * Review status
 */
export type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "skipped"
  | "expired";

/**
 * Code review source
 */
export type CodeSource = "github_pr" | "local_diff" | "agent_output";

/**
 * Tool execution review subject data
 */
export interface ToolExecutionSubjectData {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: Record<string, unknown>;
  success: boolean;
  reasoning?: string;
  alternativeOptions?: {
    action: string;
    reasoning: string;
  }[];
}

/**
 * Memory review subject data
 */
export interface MemorySubjectData {
  memoryId: string;
  memoryType: "fact" | "preference" | "relation";
  fact: string;
  evidence: string[];
  confidence: number;
  conflictsWith?: string[];
}

/**
 * Message review subject data
 */
export interface MessageSubjectData {
  messageId: string;
  messageContent: string;
  userPrompt: string;
  responseStyle?: "concise" | "detailed" | "technical" | "casual";
  wordCount?: number;
  genUIUsed?: string[];
}

/**
 * Workflow review subject data
 */
export interface WorkflowSubjectData {
  workflowId: string;
  taskDescription: string;
  decision: "escalate" | "continue" | "suspend";
  reasoning: string;
  complexityScore?: number;
  fileCount?: number;
}

/**
 * Code review subject data
 */
export interface CodeReviewSubjectData {
  source: CodeSource;
  prNumber?: number;
  prTitle?: string;
  prUrl?: string;
  author?: string;
  repository?: string;
  files: {
    path: string;
    status: "added" | "modified" | "deleted" | "moved" | "renamed";
    additions: number;
    deletions: number;
    aiSummary?: string;
  }[];
  bugs: {
    id: string;
    file: string;
    line: number;
    severity: "critical" | "warning" | "info";
    category: string;
    message: string;
    suggestion?: string;
    confidence: number;
  }[];
  groups?: {
    name: string;
    description: string;
    priority: "breaking" | "feature" | "refactor" | "style";
    files: string[];
  }[];
  summary?: string;
  qualityScore?: number;
}

/**
 * Union type for all subject data
 */
export type ReviewSubjectData =
  | ToolExecutionSubjectData
  | MemorySubjectData
  | MessageSubjectData
  | WorkflowSubjectData
  | CodeReviewSubjectData;

/**
 * Verdict data for rejected reviews
 */
export interface VerdictData {
  type: "delete" | "edit" | "replace" | "fix";
  data?: unknown;
  feedback?: string;
  selectedIssues?: string[];
}

/**
 * Review queue table
 */
export const reviewQueue = pgTable("review_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),

  // What's being reviewed
  reviewType: text("review_type").notNull().$type<ReviewType>(),
  subjectId: text("subject_id").notNull(),
  subjectData: jsonb("subject_data").notNull().$type<ReviewSubjectData>(),

  // Code review specific
  codeSource: text("code_source").$type<CodeSource>(),
  prNumber: integer("pr_number"),
  prUrl: text("pr_url"),
  repository: text("repository"),
  bugCount: integer("bug_count").default(0),
  qualityScore: real("quality_score"),

  // Context
  conversationId: text("conversation_id"),
  messageId: text("message_id"),
  workflowRunId: uuid("workflow_run_id").references(() => workflowRuns.id, {
    onDelete: "set null",
  }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),

  // Priority and auto-approve
  priority: text("priority")
    .notNull()
    .default("medium")
    .$type<ReviewPriority>(),
  autoApproveEligible: boolean("auto_approve_eligible").default(false),
  confidence: real("confidence").default(0.5),

  // Status
  status: text("status").notNull().default("pending").$type<ReviewStatus>(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  verdictData: jsonb("verdict_data").$type<VerdictData>(),

  // Delegation
  delegatedTo: text("delegated_to"),
  delegatedAt: timestamp("delegated_at", { withTimezone: true }),
  delegatedBy: text("delegated_by"),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

/**
 * Review analytics table
 */
export const reviewAnalytics = pgTable("review_analytics", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),

  // Time period
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),

  // Counts by type
  toolApproved: integer("tool_approved").default(0),
  toolRejected: integer("tool_rejected").default(0),
  memoryApproved: integer("memory_approved").default(0),
  memoryRejected: integer("memory_rejected").default(0),
  messageApproved: integer("message_approved").default(0),
  messageRejected: integer("message_rejected").default(0),
  workflowApproved: integer("workflow_approved").default(0),
  workflowRejected: integer("workflow_rejected").default(0),
  codeApproved: integer("code_approved").default(0),
  codeRejected: integer("code_rejected").default(0),

  // Totals
  totalReviewed: integer("total_reviewed").default(0),
  totalApproved: integer("total_approved").default(0),
  totalRejected: integer("total_rejected").default(0),
  totalSkipped: integer("total_skipped").default(0),

  // Timing
  avgReviewTimeMs: integer("avg_review_time_ms"),

  // Auto-approve stats
  autoApproved: integer("auto_approved").default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Auto-approve patterns table
 */
export const reviewAutoApprovePatterns = pgTable(
  "review_auto_approve_patterns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),

    // Pattern definition
    reviewType: text("review_type").notNull().$type<ReviewType>(),
    patternKey: text("pattern_key").notNull(),
    patternData: jsonb("pattern_data"),

    // Approval history
    approvalCount: integer("approval_count").default(0),
    rejectionCount: integer("rejection_count").default(0),
    lastApprovalAt: timestamp("last_approval_at", { withTimezone: true }),

    // Status
    enabled: boolean("enabled").default(false),
    enabledAt: timestamp("enabled_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  }
);

/**
 * Dependency types
 */
export type BlockedType = "workflow" | "task" | "pr" | "deploy" | "review";
export type DependencyType = "blocks" | "related" | "parent";

/**
 * Review dependencies table - tracks what reviews block
 */
export const reviewDependencies = pgTable("review_dependencies", {
  id: uuid("id").defaultRandom().primaryKey(),

  // The review that is blocking
  reviewId: uuid("review_id")
    .notNull()
    .references(() => reviewQueue.id, { onDelete: "cascade" }),

  // What is blocked
  blockedType: text("blocked_type").notNull().$type<BlockedType>(),
  blockedId: text("blocked_id").notNull(),
  blockedLabel: text("blocked_label"),

  // Dependency metadata
  dependencyType: text("dependency_type")
    .notNull()
    .default("blocks")
    .$type<DependencyType>(),
  isCriticalPath: boolean("is_critical_path").default(false),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

/**
 * Audit action types
 */
export type AuditAction =
  | "created"
  | "approved"
  | "rejected"
  | "skipped"
  | "delegated"
  | "expired"
  | "bulk_approved"
  | "bulk_rejected";

/**
 * Review audit log table - tracks all review actions for compliance
 */
export const reviewAuditLog = pgTable("review_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Review reference
  reviewId: uuid("review_id")
    .notNull()
    .references(() => reviewQueue.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),

  // Action details
  action: text("action").notNull().$type<AuditAction>(),
  actionData: jsonb("action_data"),

  // Context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  // Timestamp
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Review templates - pre-defined rejection/approval responses
 */
export const reviewTemplates = pgTable("review_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),

  // Template definition
  name: text("name").notNull(),
  templateType: text("template_type")
    .notNull()
    .$type<"rejection" | "approval" | "request_changes">(),
  reviewType: text("review_type").$type<ReviewType>(),

  // Content
  title: text("title").notNull(),
  message: text("message").notNull(),
  suggestedCorrection: jsonb("suggested_correction"),

  // Usage tracking
  useCount: integer("use_count").default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

  // Status
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Type exports
export type ReviewQueueRow = typeof reviewQueue.$inferSelect;
export type ReviewQueueInsert = typeof reviewQueue.$inferInsert;
export type ReviewAnalyticsRow = typeof reviewAnalytics.$inferSelect;
export type ReviewAutoApprovePatternRow =
  typeof reviewAutoApprovePatterns.$inferSelect;
export type ReviewDependencyRow = typeof reviewDependencies.$inferSelect;
export type ReviewDependencyInsert = typeof reviewDependencies.$inferInsert;
export type ReviewAuditLogRow = typeof reviewAuditLog.$inferSelect;
export type ReviewAuditLogInsert = typeof reviewAuditLog.$inferInsert;
export type ReviewTemplateRow = typeof reviewTemplates.$inferSelect;
export type ReviewTemplateInsert = typeof reviewTemplates.$inferInsert;
export type TemplateType = "rejection" | "approval" | "request_changes";
