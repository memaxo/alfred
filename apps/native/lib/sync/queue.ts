import { eq, lt, and } from "drizzle-orm";

import {
  db,
  syncQueue,
  type NewSyncQueueItem,
  type SyncQueueItem,
} from "../db";

const MAX_ATTEMPTS = 5;

export type SyncAction = "create" | "update" | "delete";

export async function enqueue(
  tableName: string,
  recordId: string,
  action: SyncAction,
  payload?: unknown
): Promise<void> {
  const id = `${tableName}-${recordId}-${Date.now()}`;

  await db.insert(syncQueue).values({
    id,
    tableName,
    recordId,
    action,
    payload: payload ?? null,
    attempts: 0,
  });
}

export async function getPendingItems(limit = 50): Promise<SyncQueueItem[]> {
  return db
    .select()
    .from(syncQueue)
    .where(lt(syncQueue.attempts, MAX_ATTEMPTS))
    .orderBy(syncQueue.createdAt)
    .limit(limit);
}

export async function markAttempted(id: string, error?: string): Promise<void> {
  const item = await db
    .select()
    .from(syncQueue)
    .where(eq(syncQueue.id, id))
    .limit(1);

  if (item.length === 0) {
    return;
  }

  const newAttempts = (item[0].attempts ?? 0) + 1;

  if (newAttempts >= MAX_ATTEMPTS) {
    await db
      .update(syncQueue)
      .set({
        attempts: newAttempts,
        lastAttemptAt: new Date(),
        error: error ?? "Max attempts reached",
      })
      .where(eq(syncQueue.id, id));
  } else {
    await db
      .update(syncQueue)
      .set({
        attempts: newAttempts,
        lastAttemptAt: new Date(),
        error: error ?? null,
      })
      .where(eq(syncQueue.id, id));
  }
}

export async function markCompleted(id: string): Promise<void> {
  await db.delete(syncQueue).where(eq(syncQueue.id, id));
}

export async function getQueueCount(): Promise<number> {
  const result = await db
    .select()
    .from(syncQueue)
    .where(lt(syncQueue.attempts, MAX_ATTEMPTS));
  return result.length;
}

export async function clearQueue(): Promise<void> {
  await db.delete(syncQueue);
}

export async function getFailedItems(): Promise<SyncQueueItem[]> {
  return db
    .select()
    .from(syncQueue)
    .where(and(eq(syncQueue.attempts, MAX_ATTEMPTS)));
}

export async function retryFailed(): Promise<void> {
  await db
    .update(syncQueue)
    .set({ attempts: 0, error: null })
    .where(eq(syncQueue.attempts, MAX_ATTEMPTS));
}
