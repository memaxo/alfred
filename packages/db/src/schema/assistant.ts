/**
 * ALFRED Assistant Schema
 * Tasks, notes, events, reminders, bookmarks, and timers
 */

import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// TODO: [Phase 5] Add proper indexes for performance

/**
 * Tasks (work items tracked by Assistant)
 */
export const tasks = pgTable("assistant_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // "pending" | "in_progress" | "completed" | "cancelled"
  priority: integer("priority").default(0), // Higher = more important
  due: timestamp("due_at", { withTimezone: true }),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  completed: timestamp("completed_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
});

// TODO: [Phase 5] Add index on (userId, status) for filtering
// TODO: [Phase 5] Add index on (userId, due) for due date queries

/**
 * Notes (freeform user notes)
 */
export const notes = pgTable("assistant_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  tags: jsonb("tags"), // Array of tag strings
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"),
});

// TODO: [Phase 5] Add full-text search index on content
// TODO: [Phase 8] Optionally embed notes for semantic search

/**
 * Events (calendar-like events)
 */
export const events = pgTable("assistant_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  start: timestamp("start_at", { withTimezone: true }).notNull(),
  end: timestamp("end_at", { withTimezone: true }),
  location: text("location"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"),
});

// TODO: [Phase 6] Add index on (userId, start) for calendar queries

/**
 * Reminders (time-based notifications)
 */
export const reminders = pgTable("assistant_reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  due: timestamp("due_at", { withTimezone: true }).notNull(),
  fired: boolean("fired").default(false),
  firedAt: timestamp("fired_at", { withTimezone: true }),
  recurring: text("recurring"), // "daily" | "weekly" | "monthly" | cron expression
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"),
});

// TODO: [Phase 6] Add index on (userId, due, fired) for scheduler queries
// TODO: [Phase 6] Add recurring reminder logic in scheduler

/**
 * Bookmarks (saved URLs and resources)
 */
export const bookmarks = pgTable("assistant_bookmarks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  tags: jsonb("tags"), // Array of tag strings
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"),
});

// TODO: [Phase 5] Add index on (userId, url) for deduplication

/**
 * Timers (active countdown timers)
 */
export const timers = pgTable("assistant_timers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label"),
  duration: integer("duration_seconds").notNull(), // Duration in seconds
  start: timestamp("start_at", { withTimezone: true }).notNull(),
  end: timestamp("end_at", { withTimezone: true }).notNull(), // start + duration
  cancelled: boolean("cancelled").default(false),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// TODO: [Phase 6] Add index on (userId, end, completed) for active timer queries
