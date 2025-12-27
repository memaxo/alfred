/**
 * ALFRED Budget Schema
 * User budget limits and usage tracking for cost management
 */

import {
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * User budgets - daily/request limits and model preferences
 */
export const userBudgets = pgTable("user_budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(), // References better_auth.users

  // Daily limits (null = unlimited)
  dailyDollarLimit: real("daily_dollar_limit"), // In dollars
  dailyTokenLimit: integer("daily_token_limit"), // Total tokens per day

  // Per-request limits
  maxLatencyMs: integer("max_latency_ms"), // Maximum acceptable latency
  maxTokensPerRequest: integer("max_tokens_per_request"), // Max tokens per single request

  // Model preferences per role (Record<ModelRole, ModelRefString>)
  // e.g., { "chat": "cerebras:llama3.1-70b", "background": "cerebras:llama3.1-8b" }
  modelPreferences: jsonb("model_preferences"),

  // Priority settings: how to balance cost vs quality
  // "minimize" = always use cheapest, "balanced" = default, "maximize_quality" = prefer best models
  costPriority: text("cost_priority").default("balanced"),

  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Usage tracking - daily aggregates for budget enforcement
 */
export const usageTracking = pgTable("usage_tracking", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(), // Truncated to day (00:00:00)

  // Token counts
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  cachedTokens: integer("cached_tokens").default(0),

  // Cost tracking (in cents for precision)
  totalCostCents: integer("total_cost_cents").default(0),

  // Per-provider breakdown
  // Record<provider, { inputTokens, outputTokens, costCents }>
  providerBreakdown: jsonb("provider_breakdown"),

  // Per-role breakdown
  // Record<role, { inputTokens, outputTokens, costCents }>
  roleBreakdown: jsonb("role_breakdown"),

  // Request counts
  requestCount: integer("request_count").default(0),
  blockedCount: integer("blocked_count").default(0), // Requests blocked due to budget

  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Index coverage: migration 0062 handles user_id + date composite index

/**
 * Usage events - individual request logging for detailed analytics
 */
export const usageEvents = pgTable("usage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),

  // Request details
  modelRef: text("model_ref").notNull(), // e.g., "cerebras:llama3.1-70b"
  provider: text("provider").notNull(), // "cerebras" | "openrouter"
  role: text("role").notNull(), // "chat" | "orchestrator" | "planner" | etc.

  // Token usage
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  cachedTokens: integer("cached_tokens").default(0),

  // Cost (in cents)
  costCents: integer("cost_cents").notNull(),

  // Performance
  latencyMs: integer("latency_ms"),

  // Context
  workflowRunId: text("workflow_run_id"),
  conversationId: text("conversation_id"),

  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

// Index coverage: migration 0062 handles timestamp and user_id indexes
