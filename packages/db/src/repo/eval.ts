/**
 * ALFRED Eval Repository
 * Definitions, datasets, datapoints, runs, and score persistence.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  evalDatasets,
  evalDefs,
  evalPoints,
  evalRuns,
  evalScores,
} from "../schema/eval";

export type EvalDefRow = typeof evalDefs.$inferSelect;
export type EvalDatasetRow = typeof evalDatasets.$inferSelect;
export type EvalPointRow = typeof evalPoints.$inferSelect;
export type EvalRunRow = typeof evalRuns.$inferSelect;
export type EvalScoreRow = typeof evalScores.$inferSelect;

export type EvalRunWithRelations = {
  run: EvalRunRow;
  def: EvalDefRow;
  dataset: EvalDatasetRow;
};

function chunkArray<T>(items: T[], size = 100) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function upsertEvalDef(input: {
  slug: string;
  agent: string;
  title?: string;
  description?: string;
  config?: unknown;
}): Promise<typeof evalDefs.$inferSelect> {
  const payload = {
    slug: input.slug,
    agent: input.agent,
    title: input.title ?? null,
    description: input.description ?? null,
    config: input.config ?? null,
  };

  const [row] = await db
    .insert(evalDefs)
    .values(payload)
    .onConflictDoUpdate({
      target: evalDefs.slug,
      set: {
        agent: payload.agent,
        title: payload.title,
        description: payload.description,
        config: payload.config,
        updatedAt: sql`NOW()`,
      },
    })
    .returning();

  return row!;
}

export async function listEvalDefs(limit = 50, offset = 0): Promise<(typeof evalDefs.$inferSelect)[]> {
  return db
    .select()
    .from(evalDefs)
    .orderBy(desc(evalDefs.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function getEvalDefBySlug(slug: string): Promise<typeof evalDefs.$inferSelect | null> {
  const rows = await db
    .select()
    .from(evalDefs)
    .where(eq(evalDefs.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function getEvalDefById(id: string): Promise<typeof evalDefs.$inferSelect | null> {
  const rows = await db
    .select()
    .from(evalDefs)
    .where(eq(evalDefs.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createDataset(input: {
  defId: string;
  name: string;
  source: string;
  description?: string;
}): Promise<typeof evalDatasets.$inferSelect> {
  const [row] = await db
    .insert(evalDatasets)
    .values({
      defId: input.defId,
      name: input.name,
      source: input.source,
      description: input.description ?? null,
    })
    .returning();
  return row!;
}

export async function listDatasets(defId: string, limit = 50, offset = 0): Promise<(typeof evalDatasets.$inferSelect)[]> {
  return db
    .select()
    .from(evalDatasets)
    .where(eq(evalDatasets.defId, defId))
    .orderBy(desc(evalDatasets.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getDatasetById(id: string): Promise<typeof evalDatasets.$inferSelect | null> {
  const rows = await db
    .select()
    .from(evalDatasets)
    .where(eq(evalDatasets.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function addPoints(
  datasetId: string,
  points: Array<{ input: unknown; target?: unknown; metadata?: unknown }>
): Promise<number> {
  if (points.length === 0) {
    return 0;
  }
  const rows = points.map((point) => ({
    datasetId,
    input: point.input,
    target: point.target ?? null,
    metadata: point.metadata ?? null,
  }));

  let inserted = 0;
  for (const chunk of chunkArray(rows)) {
    const result = await db
      .insert(evalPoints)
      .values(chunk)
      .returning({ id: evalPoints.id });
    inserted += result.length;
  }
  return inserted;
}

export async function getPointsForDataset(datasetId: string): Promise<(typeof evalPoints.$inferSelect)[]> {
  return db
    .select()
    .from(evalPoints)
    .where(eq(evalPoints.datasetId, datasetId))
    .orderBy(asc(evalPoints.createdAt));
}

export async function createRun(input: {
  defId: string;
  datasetId: string;
  variant?: string;
}): Promise<typeof evalRuns.$inferSelect> {
  const [row] = await db
    .insert(evalRuns)
    .values({
      defId: input.defId,
      datasetId: input.datasetId,
      variant: input.variant ?? null,
    })
    .returning();
  return row!;
}

export async function updateRun(
  runId: string,
  patch: Partial<{
    status: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    stats: unknown;
    laminarEvalId: string | null;
  }>
): Promise<number> {
  const updates: Partial<typeof evalRuns.$inferInsert> = {};
  if (patch.status !== undefined) {
    updates.status = patch.status;
  }
  if (patch.startedAt !== undefined) {
    updates.startedAt = patch.startedAt;
  }
  if (patch.finishedAt !== undefined) {
    updates.finishedAt = patch.finishedAt;
  }
  if (patch.stats !== undefined) {
    updates.stats = patch.stats ?? null;
  }
  if (patch.laminarEvalId !== undefined) {
    updates.laminarEvalId = patch.laminarEvalId ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return 0;
  }

  const result = await db
    .update(evalRuns)
    .set(updates)
    .where(eq(evalRuns.id, runId))
    .returning({ id: evalRuns.id });

  return result.length;
}

export async function insertScores(
  runId: string,
  scores: Array<{
    pointId: string;
    scorer: string;
    score: number;
    reason?: unknown;
    metadata?: unknown;
  }>
): Promise<number> {
  if (scores.length === 0) {
    return 0;
  }
  const rows = scores.map((score) => ({
    runId,
    pointId: score.pointId,
    scorer: score.scorer,
    score: score.score,
    reason: score.reason ?? null,
    metadata: score.metadata ?? null,
  }));

  let inserted = 0;
  for (const chunk of chunkArray(rows)) {
    const result = await db
      .insert(evalScores)
      .values(chunk)
      .returning({ id: evalScores.id });
    inserted += result.length;
  }
  return inserted;
}

export async function getRun(
  runId: string
): Promise<EvalRunWithRelations | null> {
  const rows = await db
    .select({
      run: evalRuns,
      def: evalDefs,
      dataset: evalDatasets,
    })
    .from(evalRuns)
    .innerJoin(evalDefs, eq(evalRuns.defId, evalDefs.id))
    .innerJoin(evalDatasets, eq(evalRuns.datasetId, evalDatasets.id))
    .where(eq(evalRuns.id, runId))
    .limit(1);

  return rows[0] ?? null;
}

export async function listRuns(
  input: { defSlug?: string; limit?: number; offset?: number } = {}
): Promise<EvalRunWithRelations[]> {
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const baseQuery = db
    .select({
      run: evalRuns,
      def: evalDefs,
      dataset: evalDatasets,
    })
    .from(evalRuns)
    .innerJoin(evalDefs, eq(evalRuns.defId, evalDefs.id))
    .innerJoin(evalDatasets, eq(evalRuns.datasetId, evalDatasets.id));

  const filteredQuery = input.defSlug
    ? baseQuery.where(eq(evalDefs.slug, input.defSlug))
    : baseQuery;

  return filteredQuery
    .orderBy(desc(evalRuns.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function listRunScores(runId: string, limit = 100, offset = 0): Promise<{ score: typeof evalScores.$inferSelect; point: typeof evalPoints.$inferSelect }[]> {
  return db
    .select({
      score: evalScores,
      point: evalPoints,
    })
    .from(evalScores)
    .innerJoin(evalPoints, eq(evalScores.pointId, evalPoints.id))
    .where(eq(evalScores.runId, runId))
    .orderBy(desc(evalScores.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getRunScoreStats(runId: string): Promise<{ scorer: string | null; count: number; mean: number | null; min: number | null; max: number | null }[]> {
  return db
    .select({
      scorer: evalScores.scorer,
      count: sql<number>`COUNT(*)`,
      mean: sql<number>`AVG(${evalScores.score})`,
      min: sql<number>`MIN(${evalScores.score})`,
      max: sql<number>`MAX(${evalScores.score})`,
    })
    .from(evalScores)
    .where(eq(evalScores.runId, runId))
    .groupBy(evalScores.scorer);
}

export async function verifyRunDataset(runId: string, datasetId: string): Promise<boolean> {
  const rows = await db
    .select({ id: evalRuns.id })
    .from(evalRuns)
    .where(and(eq(evalRuns.id, runId), eq(evalRuns.datasetId, datasetId)))
    .limit(1);
  return rows.length > 0;
}
