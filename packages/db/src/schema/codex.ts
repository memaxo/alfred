import {
  type AnyPgColumn,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

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

export const codexRuns = pgTable(
  "codex_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    sessionId: varchar("session_id", { length: 255 }),
    threadId: varchar("thread_id", { length: 255 }),
    parentRunId: uuid("parent_run_id").references((): AnyPgColumn => codexRuns.id, {
      onDelete: "set null",
    }),
    resumeCount: integer("resume_count").notNull().default(0),
    schemaVersion: integer("schema_version").notNull().default(1),

    status: text("status").notNull().default("running"),
    exitCode: integer("exit_code"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    auto: text("auto"),
    model: text("model"),
    profile: text("profile"),

    environmentKind: text("environment_kind").notNull().default("host"),
    workingDirectory: text("working_directory"),
    workspaceRoot: text("workspace_root"),

    dockerContainerId: text("docker_container_id"),
    dockerImage: text("docker_image"),

    poofUpperDir: text("poof_upper_dir"),
    poofProfile: text("poof_profile"),

    outputSchema: jsonb("output_schema"),
    structuredOutput: jsonb("structured_output"),
    structuredOutputStatus: text("structured_output_status"),

    artifacts: jsonb("artifacts"),
    resultText: text("result_text"),

    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userStartedIdx: index("codex_runs_user_started_idx").on(
      table.userId,
      table.startedAt
    ),
    userSessionStartedIdx: index("codex_runs_user_session_started_idx").on(
      table.userId,
      table.sessionId,
      table.startedAt
    ),
    threadIdx: index("codex_runs_thread_idx").on(table.threadId),
    parentIdx: index("codex_runs_parent_idx").on(table.parentRunId),
  })
);

export type CodexRunRow = typeof codexRuns.$inferSelect;
export type NewCodexRunRow = typeof codexRuns.$inferInsert;

export const codexEvents = pgTable(
  "codex_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => codexRuns.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    eventType: text("event_type").notNull(),
    eventData: jsonb("event_data"),
    text: text("text"),
    contentTsvector: tsvector("content_tsvector"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    runSeqUnique: uniqueIndex("codex_events_run_seq_idx").on(
      table.runId,
      table.seq
    ),
    runCreatedIdx: index("codex_events_run_created_idx").on(
      table.runId,
      table.createdAt
    ),
    typeCreatedIdx: index("codex_events_type_created_idx").on(
      table.eventType,
      table.createdAt
    ),
  })
);

export type CodexEventRow = typeof codexEvents.$inferSelect;
export type NewCodexEventRow = typeof codexEvents.$inferInsert;
