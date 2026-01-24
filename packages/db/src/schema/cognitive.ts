import type { AnyPgColumn } from "drizzle-orm/pg-core";

import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Self-referential table for cognitive events
const _cognitiveEventsTable = pgTable(
  "cognitive_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streamId: varchar("stream_id", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Debugger fields
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => _cognitiveEventsTable.id
    ),
    seq: integer("seq"),
    lamport: bigint("lamport", { mode: "number" }),
  },
  (t) => ({
    streamIdx: index("cognitive_events_stream_idx").on(t.streamId),
    createdIdx: index("cognitive_events_created_idx").on(t.createdAt),
    // Compound index for range queries: getEventsSince(streamId, since)
    streamCreatedIdx: index("cognitive_events_stream_created_idx").on(
      t.streamId,
      t.createdAt
    ),
    streamSeqIdx: index("cognitive_events_stream_seq_idx").on(
      t.streamId,
      t.seq
    ),
    parentIdIdx: index("cognitive_events_parent_id_idx").on(t.parentId),
    lamportIdx: index("cognitive_events_lamport_idx").on(t.lamport),
  })
);

export const cognitiveEvents = _cognitiveEventsTable;

export const cognitiveSnapshots = pgTable(
  "cognitive_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streamId: varchar("stream_id", { length: 255 }).notNull(),
    state: jsonb("state").notNull(),
    lastEventId: uuid("last_event_id")
      .notNull()
      .references(() => _cognitiveEventsTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    streamIdx: index("cognitive_snapshots_stream_idx").on(t.streamId),
    createdIdx: index("cognitive_snapshots_created_idx").on(t.createdAt),
    // Compound index for fetching latest: getLatestSnapshot(streamId)
    streamCreatedIdx: index("cognitive_snapshots_stream_created_idx").on(
      t.streamId,
      t.createdAt
    ),
    lastEventIdIdx: index("cognitive_snapshots_last_event_id_idx").on(
      t.lastEventId
    ),
  })
);
