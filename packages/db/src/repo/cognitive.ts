import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "../client";
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

export async function getLatestSnapshot(streamId: string): Promise<typeof cognitiveSnapshots.$inferSelect | undefined> {
  const [snapshot] = await db
    .select()
    .from(cognitiveSnapshots)
    .where(eq(cognitiveSnapshots.streamId, streamId))
    .orderBy(desc(cognitiveSnapshots.createdAt))
    .limit(1);
  return snapshot;
}

export async function getEventsSince(streamId: string, since: Date): Promise<(typeof cognitiveEvents.$inferSelect)[]> {
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
export async function getAllEvents(streamId: string): Promise<(typeof cognitiveEvents.$inferSelect)[]> {
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
export async function findActivePlans(): Promise<(typeof cognitiveSnapshots.$inferSelect)[]> {
  // Get the latest snapshot for each stream
  // distinctOn is available in drizzle-orm/pg-core
  const snapshots = await db
    .select()
    .from(cognitiveSnapshots)
    .orderBy(desc(cognitiveSnapshots.createdAt));

  // Filter for executing state in memory (simpler than complex SQL for now)
  // Group by streamId to get latest
  const latestByStream = new Map<string, (typeof snapshots)[0]>();

  for (const snap of snapshots) {
    if (!latestByStream.has(snap.streamId)) {
      latestByStream.set(snap.streamId, snap);
    }
  }

  return Array.from(latestByStream.values()).filter((snap) => {
    const state = snap.state as any;
    return state._ === "executing";
  });
}
