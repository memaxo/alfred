/**
 * ALFRED Assistant Schema
 * Tasks, notes, events, reminders, bookmarks, and timers
 */

import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Index coverage is handled in migrations 0003, 0007, and 0039 for the assistant tables.

const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * Tasks (work items tracked by Assistant)
 */
export const tasks: any = pgTable("assistant_tasks", {
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

// Index coverage: assistant_tasks_user_status_idx, assistant_tasks_user_due_idx (0039)

/**
 * Notes (freeform user notes)
 */
export const notes: any = pgTable("assistant_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  contentTsvector: tsvector("content_tsvector"),
  tags: jsonb("tags"), // Array of tag strings
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"),
});

// TODO: [Phase 8] Optionally embed notes for semantic search

/**
 * Events (calendar-like events)
 */
export const events: any = pgTable("assistant_events", {
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

// Index coverage: assistant_events_user_id_start_idx (0003)

/**
 * Reminders (time-based notifications)
 */
export const reminders: any = pgTable("assistant_reminders", {
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

// Index coverage: assistant_reminders_user_due_fired_idx (0039)
// TODO: [Phase 6] Add recurring reminder logic in scheduler

/**
 * Bookmarks (saved URLs and resources)
 */
export const bookmarks: any = pgTable("assistant_bookmarks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  tags: jsonb("tags"), // Array of tag strings
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"),
});

// Index coverage: assistant_bookmarks_user_url_idx (0039)

/**
 * Timers (active countdown timers)
 */
export const timers: any = pgTable("assistant_timers", {
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

// Index coverage: assistant_timers_user_start_idx and assistant_timers_active_idx (0039)
