import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  type AttentionItem,
  type AttentionStatus,
  type AttentionUrgency,
  type NewAttentionItem,
  attentionItems,
} from "../schema/attention";

export async function createAttentionItem(
  data: NewAttentionItem
): Promise<AttentionItem> {
  const [row] = await db.insert(attentionItems).values(data).returning();
  if (!row) {
    throw new Error("attention_item_create_failed");
  }
  return row;
}

export async function getAttentionItemById(
  id: string
): Promise<AttentionItem | null> {
  const [row] = await db
    .select()
    .from(attentionItems)
    .where(eq(attentionItems.id, id))
    .limit(1);
  return row ?? null;
}

export async function listAttentionItems(args: {
  userId: string;
  kind?: string;
  status?: AttentionStatus;
  urgency?: AttentionUrgency;
  focusSetId?: string;
  commitmentId?: string;
  workflowRunId?: string;
  limit?: number;
  offset?: number;
}): Promise<AttentionItem[]> {
  const limit = args.limit ?? 50;
  const offset = args.offset ?? 0;

  let where = eq(attentionItems.userId, args.userId);
  if (args.kind) {
    where = and(where, eq(attentionItems.kind, args.kind))!;
  }
  if (args.status) {
    where = and(where, eq(attentionItems.status, args.status))!;
  }
  if (args.urgency) {
    where = and(where, eq(attentionItems.urgency, args.urgency))!;
  }
  if (args.focusSetId) {
    where = and(where, eq(attentionItems.focusSetId, args.focusSetId))!;
  }
  if (args.commitmentId) {
    where = and(where, eq(attentionItems.commitmentId, args.commitmentId))!;
  }
  if (args.workflowRunId) {
    where = and(where, eq(attentionItems.workflowRunId, args.workflowRunId))!;
  }

  return await db
    .select()
    .from(attentionItems)
    .where(where)
    .orderBy(desc(attentionItems.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function updateAttentionItem(
  id: string,
  data: Partial<Omit<AttentionItem, "id" | "userId" | "createdAt">>
): Promise<AttentionItem> {
  const [row] = await db
    .update(attentionItems)
    .set({
      ...data,
      updatedAt: sql`NOW()` as unknown as Date,
    })
    .where(eq(attentionItems.id, id))
    .returning();

  if (!row) {
    throw new Error("attention_item_update_failed");
  }
  return row;
}

