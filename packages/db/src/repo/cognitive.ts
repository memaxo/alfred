import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { db, getDbDriver } from "../client";
import { cognitiveEvents, cognitiveSnapshots } from "../schema/cognitive";

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
  payload: Record<string, unknown>
): Promise<typeof cognitiveEvents.$inferSelect> {
  const [event] = await db
    .insert(cognitiveEvents)
    .values({
      streamId,
      type,
      payload,
    })
    .returning();
  return event!;
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
  const [snapshot] = await db
    .select()
    .from(cognitiveSnapshots)
    .where(eq(cognitiveSnapshots.streamId, streamId))
    .orderBy(desc(cognitiveSnapshots.createdAt))
    .limit(1);
  return snapshot;
}

export async function getEventsSince(
  streamId: string,
  since: Date
): Promise<(typeof cognitiveEvents.$inferSelect)[]> {
  return db
    .select()
    .from(cognitiveEvents)
    .where(
      and(
        eq(cognitiveEvents.streamId, streamId),
        gt(cognitiveEvents.createdAt, since)
      )
    )
    .orderBy(asc(cognitiveEvents.createdAt));
}

/**
 * Load all events for a stream to rebuild state
 * In a production system, this would combine snapshot + subsequent events
 */
export async function getAllEvents(
  streamId: string
): Promise<(typeof cognitiveEvents.$inferSelect)[]> {
  return db
    .select()
    .from(cognitiveEvents)
    .where(eq(cognitiveEvents.streamId, streamId))
    .orderBy(asc(cognitiveEvents.createdAt));
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

  return db
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
