import { and, asc, desc, eq, gt, sql } from "drizzle-orm";

import { db, getDbDriver } from "../client";
import { cognitiveEvents, cognitiveSnapshots } from "../schema/cognitive";

let lamportClock = 0;

function nextLamport(): number {
  // SQLite fallback uses CURRENT_TIMESTAMP (seconds), so we need a stable
  // monotonic tiebreaker for ordering snapshots/events within the same ms.
  const now = Date.now();
  lamportClock = now > lamportClock ? now : lamportClock + 1;
  return lamportClock;
}

/**
 * Cognitive Event Repository
 *
 * Implements event sourcing for the cognitive architecture.
 * - Append-only event log
 * - Periodic snapshotting
 * - State hydration
 */

export async function appendEvent(
  streamId: string,
  type: string,
  payload: Record<string, unknown>,
  options?: {
    parentId?: string | null;
    seq?: number | null;
  }
): Promise<typeof cognitiveEvents.$inferSelect> {
  const [event] = await db
    .insert(cognitiveEvents)
    .values({
      streamId,
      type,
      payload,
      parentId: options?.parentId ?? null,
      seq: options?.seq ?? null,
      lamport: nextLamport(),
    })
    .returning();
  if (!event) {
    throw new Error("Failed to append cognitive event");
  }
  return event;
}

export async function saveSnapshot(
  streamId: string,
  state: Record<string, unknown>,
  lastEventId: string
): Promise<void> {
  await db.insert(cognitiveSnapshots).values({
    streamId,
    state,
    lastEventId,
  });
}

export async function getLatestSnapshot(
  streamId: string
): Promise<typeof cognitiveSnapshots.$inferSelect | undefined> {
  const [row] = await db
    .select({ snapshot: cognitiveSnapshots, lastEvent: cognitiveEvents })
    .from(cognitiveSnapshots)
    .leftJoin(
      cognitiveEvents,
      eq(cognitiveEvents.id, cognitiveSnapshots.lastEventId)
    )
    .where(eq(cognitiveSnapshots.streamId, streamId))
    .orderBy(desc(cognitiveEvents.lamport), desc(cognitiveSnapshots.createdAt))
    .limit(1);
  return row?.snapshot;
}

export async function getEventsSince(
  streamId: string,
  since: Date
): Promise<(typeof cognitiveEvents.$inferSelect)[]> {
  return await db
    .select()
    .from(cognitiveEvents)
    .where(
      and(
        eq(cognitiveEvents.streamId, streamId),
        gt(cognitiveEvents.createdAt, since)
      )
    )
    .orderBy(asc(cognitiveEvents.createdAt), asc(cognitiveEvents.lamport));
}

/**
 * Load all events for a stream to rebuild state
 * In a production system, this would combine snapshot + subsequent events
 */
export async function getAllEvents(
  streamId: string
): Promise<(typeof cognitiveEvents.$inferSelect)[]> {
  return await db
    .select()
    .from(cognitiveEvents)
    .where(eq(cognitiveEvents.streamId, streamId))
    .orderBy(asc(cognitiveEvents.createdAt), asc(cognitiveEvents.lamport));
}

export async function getLatestEvents(
  streamId: string,
  limit: number
): Promise<(typeof cognitiveEvents.$inferSelect)[]> {
  const safeLimit = Math.max(1, Math.min(200, limit));
  return await db
    .select()
    .from(cognitiveEvents)
    .where(eq(cognitiveEvents.streamId, streamId))
    .orderBy(desc(cognitiveEvents.createdAt), desc(cognitiveEvents.lamport))
    .limit(safeLimit);
}

/**
 * Find streams that were in the middle of execution
 * Returns the latest snapshot for streams in 'executing' state
 */
export async function findActivePlans(): Promise<
  (typeof cognitiveSnapshots.$inferSelect)[]
> {
  const driver = getDbDriver();
  const executing = "executing";

  const latestByStream = db
    .select({
      streamId: cognitiveSnapshots.streamId,
      createdAt: sql`max(${cognitiveSnapshots.createdAt})`.as("created_at"),
    })
    .from(cognitiveSnapshots)
    .groupBy(cognitiveSnapshots.streamId)
    .as("latest");

  const statePredicate =
    driver === "postgres"
      ? sql`${cognitiveSnapshots.state} ->> '_' = ${executing}`
      : sql`json_extract(${cognitiveSnapshots.state}, '$._') = ${executing}`;

  return await db
    .select({
      id: cognitiveSnapshots.id,
      streamId: cognitiveSnapshots.streamId,
      state: cognitiveSnapshots.state,
      lastEventId: cognitiveSnapshots.lastEventId,
      createdAt: cognitiveSnapshots.createdAt,
    })
    .from(cognitiveSnapshots)
    .innerJoin(
      latestByStream,
      and(
        eq(cognitiveSnapshots.streamId, latestByStream.streamId),
        eq(cognitiveSnapshots.createdAt, latestByStream.createdAt)
      )
    )
    .where(statePredicate)
    .orderBy(desc(cognitiveSnapshots.createdAt));
}
