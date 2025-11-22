import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const cognitiveEvents = pgTable(
  "cognitive_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streamId: varchar("stream_id", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    streamIdx: index("cognitive_events_stream_idx").on(t.streamId),
    createdIdx: index("cognitive_events_created_idx").on(t.createdAt),
    // Compound index for range queries: getEventsSince(streamId, since)
    streamCreatedIdx: index("cognitive_events_stream_created_idx").on(
      t.streamId,
      t.createdAt
    ),
  })
);

export const cognitiveSnapshots = pgTable(
  "cognitive_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streamId: varchar("stream_id", { length: 255 }).notNull(),
    state: jsonb("state").notNull(),
    lastEventId: uuid("last_event_id").notNull(),
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
  })
);
