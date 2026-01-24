import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

import * as schema from "./schema";

const DATABASE_NAME = "alfred.db";

const expoDb = openDatabaseSync(DATABASE_NAME);

export const db = drizzle(expoDb, { schema });

export async function initializeDatabase(): Promise<void> {
  expoDb.execSync(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      agent TEXT NOT NULL DEFAULT 'assistant',
      last_message_at INTEGER,
      synced_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT,
      parts TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      synced_at INTEGER,
      pending_sync INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      synced_at INTEGER,
      pending_sync INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT,
      due_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      synced_at INTEGER,
      pending_sync INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS timers (
      id TEXT PRIMARY KEY,
      label TEXT,
      duration_ms INTEGER NOT NULL,
      started_at INTEGER,
      paused_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      synced_at INTEGER,
      pending_sync INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT,
      description TEXT,
      tags TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      synced_at INTEGER,
      pending_sync INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_attempt_at INTEGER,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_pending ON messages(pending_sync) WHERE pending_sync = 1;
    CREATE INDEX IF NOT EXISTS idx_notes_pending ON notes(pending_sync) WHERE pending_sync = 1;
    CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at) WHERE completed_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders(pending_sync) WHERE pending_sync = 1;
    CREATE INDEX IF NOT EXISTS idx_timers_active ON timers(started_at) WHERE completed_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(created_at) WHERE attempts < 5;
  `);
}

export function closeDatabase(): void {
  expoDb.closeSync();
}

export { schema };
