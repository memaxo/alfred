import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../client";
import { workflowPatterns } from "../schema/pattern";

export type WorkflowPattern = typeof workflowPatterns.$inferSelect;
export type WorkflowPatternInsert = typeof workflowPatterns.$inferInsert;

export async function createPattern(
  data: WorkflowPatternInsert
): Promise<WorkflowPattern> {
  const [row] = await db
    .insert(workflowPatterns)
    .values(data)
    .returning();
  if (!row) throw new Error("Failed to create workflow pattern");
  return row;
}

export async function getPatternById(id: string): Promise<WorkflowPattern | null> {
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
  if (!row) throw new Error("Failed to update workflow pattern");
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

export async function searchPatterns(\n  embedding: number[],\n  limit = 10,\n  threshold = 0.7,\n  projectId?: string\n): Promise<PatternSearchResult[]> {\n  const embeddingArrayExpr = `ARRAY[${embedding.join(\",\")}]`;\n\n  return await db.transaction(async (tx) => {\n    const rows = await tx\n      .select({\n        id: workflowPatterns.id,\n        userId: workflowPatterns.userId,\n        projectId: workflowPatterns.projectId,\n        trigger: workflowPatterns.trigger,\n        planTemplate: workflowPatterns.planTemplate,\n        successRate: workflowPatterns.successRate,\n        avgDurationMs: workflowPatterns.avgDurationMs,\n        usageCount: workflowPatterns.usageCount,\n        knowledgeNodeId: workflowPatterns.knowledgeNodeId,\n        createdAt: workflowPatterns.createdAt,\n        updatedAt: workflowPatterns.updatedAt,\n        embedding: workflowPatterns.embedding,\n        score: projectId\n          ? sql<number>`(1 - (embedding <=> ${sql.raw(embeddingArrayExpr)}::vector)) * (CASE WHEN project_id = ${projectId} THEN 1.0 ELSE 0.8 END)`\n          : sql<number>`1 - (embedding <=> ${sql.raw(embeddingArrayExpr)}::vector)`,\n      })\n      .from(workflowPatterns)\n      .where(\n        and(\n          eq(workflowPatterns.status, \"active\"),\n          isNotNull(workflowPatterns.embedding)\n        )\n      )\n      .orderBy(sql`embedding <=> ${sql.raw(embeddingArrayExpr)}::vector ASC`)\n      .limit(limit * 2);\n\n    const filtered = rows.filter(\n      (row) => Number.isFinite(row.score) && row.score >= threshold\n    );\n\n    return filtered.slice(0, limit) as PatternSearchResult[];\n  });\n}\n