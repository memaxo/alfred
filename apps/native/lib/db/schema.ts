import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  title: text("title"),
  agent: text("agent").notNull().default("assistant"),
  lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content"),
  parts: text("parts", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
  pendingSync: integer("pending_sync", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
  pendingSync: integer("pending_sync", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  dueAt: integer("due_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
  pendingSync: integer("pending_sync", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const timers = sqliteTable("timers", {
  id: text("id").primaryKey(),
  label: text("label"),
  durationMs: integer("duration_ms").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }),
  pausedAt: integer("paused_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
  pendingSync: integer("pending_sync", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
  pendingSync: integer("pending_sync", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const preferences = sqliteTable("preferences", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const syncQueue = sqliteTable("sync_queue", {
  id: text("id").primaryKey(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  action: text("action").notNull(), // 'create' | 'update' | 'delete'
  payload: text("payload", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: integer("last_attempt_at", { mode: "timestamp" }),
  error: text("error"),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type Timer = typeof timers.$inferSelect;
export type NewTimer = typeof timers.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type Preference = typeof preferences.$inferSelect;
export type SyncQueueItem = typeof syncQueue.$inferSelect;
export type NewSyncQueueItem = typeof syncQueue.$inferInsert;
