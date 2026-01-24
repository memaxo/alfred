import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../client";
import {
  type FocusCommitment,
  type FocusCommitmentStatus,
  type FocusLane,
  type FocusSet,
  type FocusSetStatus,
  focusCommitments,
  focusSets,
  type NewFocusCommitment,
  type NewFocusSet,
} from "../schema/focus";

export async function createFocusSet(data: NewFocusSet): Promise<FocusSet> {
  const [row] = await db.insert(focusSets).values(data).returning();
  if (!row) {
    throw new Error("focus_set_create_failed");
  }
  return row;
}

export async function getFocusSetById(id: string): Promise<FocusSet | null> {
  const [row] = await db
    .select()
    .from(focusSets)
    .where(eq(focusSets.id, id))
    .limit(1);
  return row ?? null;
}

export async function listFocusSets(args: {
  userId: string;
  status?: FocusSetStatus;
  limit?: number;
  offset?: number;
}): Promise<FocusSet[]> {
  const limit = args.limit ?? 20;
  const offset = args.offset ?? 0;

  const where = args.status
    ? and(eq(focusSets.userId, args.userId), eq(focusSets.status, args.status))
    : eq(focusSets.userId, args.userId);

  return await db
    .select()
    .from(focusSets)
    .where(where)
    .orderBy(desc(focusSets.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function touchFocusSet(id: string): Promise<void> {
  await db
    .update(focusSets)
    .set({
      lastTouchedAt: sql`NOW()` as unknown as Date,
      updatedAt: sql`NOW()` as unknown as Date,
    })
    .where(eq(focusSets.id, id));
}

export async function updateFocusSet(
  id: string,
  data: Partial<Omit<FocusSet, "id" | "userId" | "createdAt">>
): Promise<FocusSet> {
  const [row] = await db
    .update(focusSets)
    .set({
      ...data,
      updatedAt: sql`NOW()` as unknown as Date,
    })
    .where(eq(focusSets.id, id))
    .returning();

  if (!row) {
    throw new Error("focus_set_update_failed");
  }
  return row;
}

export async function createCommitment(
  data: NewFocusCommitment
): Promise<FocusCommitment> {
  const [row] = await db.insert(focusCommitments).values(data).returning();
  if (!row) {
    throw new Error("focus_commitment_create_failed");
  }
  return row;
}

export async function getCommitmentById(
  id: string
): Promise<FocusCommitment | null> {
  const [row] = await db
    .select()
    .from(focusCommitments)
    .where(eq(focusCommitments.id, id))
    .limit(1);
  return row ?? null;
}

export async function listCommitments(args: {
  userId: string;
  focusSetId?: string;
  status?: FocusCommitmentStatus;
  lane?: FocusLane;
  limit?: number;
  offset?: number;
}): Promise<FocusCommitment[]> {
  const limit = args.limit ?? 50;
  const offset = args.offset ?? 0;

  let where = eq(focusCommitments.userId, args.userId);
  if (args.focusSetId) {
    where = and(where, eq(focusCommitments.focusSetId, args.focusSetId))!;
  }
  if (args.status) {
    where = and(where, eq(focusCommitments.status, args.status))!;
  }
  if (args.lane) {
    where = and(where, eq(focusCommitments.lane, args.lane))!;
  }

  return await db
    .select()
    .from(focusCommitments)
    .where(where)
    .orderBy(desc(focusCommitments.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function touchCommitment(id: string): Promise<void> {
  await db
    .update(focusCommitments)
    .set({
      lastTouchedAt: sql`NOW()` as unknown as Date,
      updatedAt: sql`NOW()` as unknown as Date,
    })
    .where(eq(focusCommitments.id, id));
}

export async function updateCommitment(
  id: string,
  data: Partial<Omit<FocusCommitment, "id" | "userId" | "createdAt">>
): Promise<FocusCommitment> {
  const [row] = await db
    .update(focusCommitments)
    .set({
      ...data,
      updatedAt: sql`NOW()` as unknown as Date,
    })
    .where(eq(focusCommitments.id, id))
    .returning();

  if (!row) {
    throw new Error("focus_commitment_update_failed");
  }
  return row;
}
