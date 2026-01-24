import { and, desc, eq } from "drizzle-orm";

import { db } from "../../client";
import { knowledgeCorrections } from "../../schema/graph";

export type CorrectionInsert = typeof knowledgeCorrections.$inferInsert;
export type CorrectionRow = typeof knowledgeCorrections.$inferSelect;

export async function createCorrection(params: {
  userId: string;
  resource: string;
  projectId?: string;
  targetType: "node" | "edge";
  targetId: string;
  operation: "update" | "delete";
  reason: string;
  previous?: unknown;
  patch?: unknown;
}): Promise<CorrectionRow> {
  const record: CorrectionInsert = {
    userId: params.userId,
    resource: params.resource,
    projectId: params.projectId ?? null,
    targetType: params.targetType,
    targetId: params.targetId,
    operation: params.operation,
    reason: params.reason,
    previous: params.previous ?? null,
    patch: params.patch ?? null,
  };

  const [row] = await db
    .insert(knowledgeCorrections)
    .values(record)
    .returning();

  if (!row) {
    throw new Error("knowledge_correction_create_failed");
  }

  return row;
}

export async function getCorrection(id: string): Promise<CorrectionRow | null> {
  const [row] = await db
    .select()
    .from(knowledgeCorrections)
    .where(eq(knowledgeCorrections.id, id))
    .limit(1);

  return row ?? null;
}

export function getCorrectionsForTarget(
  targetType: "node" | "edge",
  targetId: string,
  limit = 50
): Promise<CorrectionRow[]> {
  return db
    .select()
    .from(knowledgeCorrections)
    .where(
      and(
        eq(knowledgeCorrections.targetType, targetType),
        eq(knowledgeCorrections.targetId, targetId)
      )
    )
    .orderBy(desc(knowledgeCorrections.createdAt))
    .limit(limit);
}
