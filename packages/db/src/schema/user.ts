/**
 * ALFRED User Schema
 * User profiles, preferences, facts, events, autonomy settings, and feedback
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
  vector,
} from "drizzle-orm/pg-core";
import { projects } from "./project";

// Index coverage: migrations 0040+ handle preferences and facts performance indexes.

// Import embedding dimension from embed package (single source of truth)
// KaLM-Embedding-Gemma3-12B-2511 with MRL truncation to 1024 dimensions
import { EMBEDDING_DIM } from "@alfred/embed";

export const VECTOR_DIM = EMBEDDING_DIM;

/**
 * User profiles (extends Better Auth users)
 */
export const profiles = pgTable("user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(), // References better_auth.users
  name: text("name"),
  email: text("email"),
  avatar: text("avatar"),
  timezone: text("timezone").default("UTC"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * User preferences (key-value pairs)
 */
export const preferences = pgTable("user_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(), // References better_auth.users
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  confidence: real("confidence").default(1.0), // Extracted preference confidence
  source: text("source").default("user"), // "user" | "inferred" | "learned"
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Index coverage: user_preferences_user_key_idx (0040)

/**
 * User facts (vectorized for semantic recall)
 */
export const facts = pgTable("user_facts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: VECTOR_DIM }),
  embeddingModelId: text("embedding_model_id"), // FK to embedding_models.id
  category: text("category"), // "personal" | "work" | "technical" | etc.
  confidence: real("confidence").default(1.0),
  source: text("source").default("user"), // "user" | "conversation" | "tool"
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Index coverage: user_facts_embedding_hnsw_idx plus category/timestamp indexes (0040)

/**
 * User events (timeline of significant interactions)
 */
export const events = pgTable("user_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  type: text("type").notNull(), // "conversation" | "tool_use" | "workflow" | "feedback"
  data: jsonb("data").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"),
});

// Index coverage: user_events_user_timestamp_idx and user_events_user_type_idx (0043)

/**
 * User autonomy settings (per-action type)
 */
export const autonomy = pgTable("user_autonomy", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(), // "droid.exec" | "home.control" | "deploy.promote" | etc.
  level: text("level").notNull(), // "read" | "low" | "medium" | "high"
  requireBiometric: boolean("require_biometric").default(false),
  maxToolCalls: integer("max_tool_calls").default(10),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Index coverage: user_autonomy_user_action_idx unique index (0043)

/**
 * User feedback (on agent responses)
 */
export const feedback = pgTable("user_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  conversationId: text("conversation_id"),
  messageId: text("message_id"),
  rating: integer("rating"), // 1-5 stars or thumbs up/down
  comment: text("comment"),
  tags: jsonb("tags"), // Array of tags like ["inaccurate", "helpful", "slow"]
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Domain override thresholds (calibrated per-domain)
 * Reference: alfred-memory-review.md - "Domain-adaptive thresholds improve accuracy"
 *
 * Formula: threshold = base × (1 - error_rate) + min × error_rate
 * Higher error rates result in lower thresholds (more trust in learned knowledge)
 */
export const domainThresholds = pgTable("domain_thresholds", {
  domain: text("domain").primaryKey(),
  threshold: real("threshold").notNull().default(0.8),
  correctionCount: integer("correction_count").notNull().default(0),
  classificationCount: integer("classification_count").notNull().default(0),
  accuracy: real("accuracy"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Phase 14: add feedback analysis for self-improvement.
