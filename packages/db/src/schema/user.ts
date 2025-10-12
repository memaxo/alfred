/**
 * ALFRED User Schema
 * User profiles, preferences, facts, events, autonomy settings, and feedback
 */

import { pgTable, text, timestamp, uuid, jsonb, real, integer, boolean, vector } from "drizzle-orm/pg-core";

// TODO: [Phase 3] Add proper indexes for performance
// TODO: [Phase 8] Add vector indexes for facts (HNSW)

export const VECTOR_DIM = 1536;

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
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  confidence: real("confidence").default(1.0), // Extracted preference confidence
  source: text("source").default("user"), // "user" | "inferred" | "learned"
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// TODO: [Phase 8] Add unique index on (userId, key)

/**
 * User facts (vectorized for semantic recall)
 */
export const facts = pgTable("user_facts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: VECTOR_DIM }),
  category: text("category"), // "personal" | "work" | "technical" | etc.
  confidence: real("confidence").default(1.0),
  source: text("source").default("user"), // "user" | "conversation" | "tool"
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// TODO: [Phase 8] Add HNSW vector index for facts.embedding

/**
 * User events (timeline of significant interactions)
 */
export const events = pgTable("user_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // "conversation" | "tool_use" | "workflow" | "feedback"
  data: jsonb("data").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"),
});

// TODO: [Phase 8] Add index on (userId, timestamp)
// TODO: [Phase 8] Add index on (userId, type)

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

// TODO: [Phase 9] Add unique index on (userId, action)

/**
 * User feedback (on agent responses)
 */
export const feedback = pgTable("user_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  conversationId: text("conversation_id"),
  messageId: text("message_id"),
  rating: integer("rating"), // 1-5 stars or thumbs up/down
  comment: text("comment"),
  tags: jsonb("tags"), // Array of tags like ["inaccurate", "helpful", "slow"]
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// TODO: [Phase 14] Add feedback analysis for self-improvement
