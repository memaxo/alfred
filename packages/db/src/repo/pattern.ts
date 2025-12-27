import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../client";
import { workflowPatterns } from "../schema/pattern";

export type WorkflowPattern = typeof workflowPatterns.$inferSelect;
export type WorkflowPatternInsert = typeof workflowPatterns.$inferInsert;

export async function createPattern(
  data: WorkflowPatternInsert
): Promise<WorkflowPattern> {
  const [row] = await db.insert(workflowPatterns).values(data).returning();
  if (!row) {
    throw new Error("Failed to create workflow pattern");
  }
  return row;
}

export async function getPatternById(
  id: string
): Promise<WorkflowPattern | null> {
  const [row] = await db
    .select()
    .from(workflowPatterns)
    .where(eq(workflowPatterns.id, id))
    .limit(1);
  return row ?? null;
}

export async function updatePattern(
  id: string,
  patch: Partial<WorkflowPatternInsert>
): Promise<WorkflowPattern> {
  const [row] = await db
    .update(workflowPatterns)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(eq(workflowPatterns.id, id))
    .returning();
  if (!row) {
    throw new Error("Failed to update workflow pattern");
  }
  return row;
}

export async function listPatternsByUserId(
  userId: string
): Promise<WorkflowPattern[]> {
  return db
    .select()
    .from(workflowPatterns)
    .where(eq(workflowPatterns.userId, userId));
}

export async function listAllPatterns(): Promise<WorkflowPattern[]> {
  return db.select().from(workflowPatterns);
}

export type PatternSearchResult = WorkflowPattern & {
  score: number;
};

export async function searchPatterns(
  embedding: number[],
  limit = 10,
  threshold = 0.7,
  projectId?: string
): Promise<PatternSearchResult[]> {
  const embeddingArrayExpr = `ARRAY[${embedding.join(",")}]`;

  return await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: workflowPatterns.id,
        userId: workflowPatterns.userId,
        projectId: workflowPatterns.projectId,
        trigger: workflowPatterns.trigger,
        planTemplate: workflowPatterns.planTemplate,
        successRate: workflowPatterns.successRate,
        avgDurationMs: workflowPatterns.avgDurationMs,
        usageCount: workflowPatterns.usageCount,
        knowledgeNodeId: workflowPatterns.knowledgeNodeId,
        createdAt: workflowPatterns.createdAt,
        updatedAt: workflowPatterns.updatedAt,
        embedding: workflowPatterns.embedding,
        score: projectId
          ? sql<number>`(1 - (embedding <=> ${sql.raw(embeddingArrayExpr)}::vector)) * (CASE WHEN project_id = ${projectId} THEN 1.0 ELSE 0.8 END)`
          : sql<number>`1 - (embedding <=> ${sql.raw(embeddingArrayExpr)}::vector)`,
      })
      .from(workflowPatterns)
      .where(
        and(
          eq(workflowPatterns.status, "active"),
          isNotNull(workflowPatterns.embedding)
        )
      )
      .orderBy(sql`embedding <=> ${sql.raw(embeddingArrayExpr)}::vector ASC`)
      .limit(limit * 2);

    const filtered = rows.filter(
      (row) => Number.isFinite(row.score) && row.score >= threshold
    );

    return filtered.slice(0, limit) as PatternSearchResult[];
  });
}
