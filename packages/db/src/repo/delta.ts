import { and, desc, eq } from "drizzle-orm";
import { db } from "../client";
import {
  type DeltaBrief,
  type DeltaBriefScope,
  deltaBriefs,
  type NewDeltaBrief,
} from "../schema/delta";

export async function createDeltaBrief(
  data: NewDeltaBrief
): Promise<DeltaBrief> {
  const [row] = await db.insert(deltaBriefs).values(data).returning();
  if (!row) {
    throw new Error("delta_brief_create_failed");
  }
  return row;
}

export async function listDeltaBriefs(args: {
  userId: string;
  scope?: DeltaBriefScope;
  focusSetId?: string;
  commitmentId?: string;
  workflowRunId?: string;
  limit?: number;
  offset?: number;
}): Promise<DeltaBrief[]> {
  const limit = args.limit ?? 50;
  const offset = args.offset ?? 0;

  let where = eq(deltaBriefs.userId, args.userId);
  if (args.scope) {
    where = and(where, eq(deltaBriefs.scope, args.scope))!;
  }
  if (args.focusSetId) {
    where = and(where, eq(deltaBriefs.focusSetId, args.focusSetId))!;
  }
  if (args.commitmentId) {
    where = and(where, eq(deltaBriefs.commitmentId, args.commitmentId))!;
  }
  if (args.workflowRunId) {
    where = and(where, eq(deltaBriefs.workflowRunId, args.workflowRunId))!;
  }

  return await db
    .select()
    .from(deltaBriefs)
    .where(where)
    .orderBy(desc(deltaBriefs.createdAt))
    .limit(limit)
    .offset(offset);
}
