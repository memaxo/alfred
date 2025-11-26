import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const codexSessions = pgTable(
  "codex_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: varchar("session_id", { length: 255 }).notNull(),
    threadId: varchar("thread_id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    workingDirectory: text("working_directory").notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    linearIssueId: varchar("linear_issue_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    sessionUnique: uniqueIndex("codex_sessions_session_id_key").on(
      table.sessionId
    ),
    userIdx: index("codex_sessions_user_idx").on(table.userId),
    expiresIdx: index("codex_sessions_expires_idx").on(table.expiresAt),
  })
);

export type CodexSessionRow = typeof codexSessions.$inferSelect;
export type NewCodexSessionRow = typeof codexSessions.$inferInsert;
