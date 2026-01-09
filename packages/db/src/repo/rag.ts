/**
 * ALFRED RAG Repository
 * Document and chunk operations with vector embeddings
 */

import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../client";
import { projectRagDocuments, ragChunks, ragDocuments } from "../schema/rag";

// type DocumentInsert = typeof ragDocuments.$inferInsert;
type DocumentRow = typeof ragDocuments.$inferSelect;
type ChunkInsert = typeof ragChunks.$inferInsert;
type ChunkRow = typeof ragChunks.$inferSelect;

// Document operations
export async function createDocument(
  source: string,
  title?: string,
  author?: string,
  metadata?: unknown
): Promise<DocumentRow> {
  const [row] = await db
    .insert(ragDocuments)
    .values({
      source,
      title: title ?? null,
      author: author ?? null,
      metadata: metadata ?? null,
    })
    .returning();

  return row as DocumentRow;
}

export async function getDocument(
  documentId: string
): Promise<DocumentRow | null> {
  const rows = await db
    .select()
    .from(ragDocuments)
    .where(eq(ragDocuments.id, documentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listDocuments(
  limit = 100,
  offset = 0
): Promise<DocumentRow[]> {
  return db
    .select()
    .from(ragDocuments)
    .orderBy(desc(ragDocuments.created))
    .limit(limit)
    .offset(offset);
}

export async function deleteDocument(documentId: string): Promise<number> {
  const rows = await db
    .delete(ragDocuments)
    .where(eq(ragDocuments.id, documentId))
    .returning({ id: ragDocuments.id });
  return rows.length;
}

export async function attachDocumentToProject(
  projectId: string,
  documentId: string
): Promise<void> {
  await db
    .insert(projectRagDocuments)
    .values({ projectId, documentId })
    .onConflictDoNothing({
      target: [projectRagDocuments.projectId, projectRagDocuments.documentId],
    });
}

export async function detachDocumentFromProject(
  projectId: string,
  documentId: string
): Promise<number> {
  const rows = await db
    .delete(projectRagDocuments)
    .where(
      and(
        eq(projectRagDocuments.projectId, projectId),
        eq(projectRagDocuments.documentId, documentId)
      )
    )
    .returning({ projectId: projectRagDocuments.projectId });

  return rows.length;
}

export async function listDocumentsForProject(
  projectId: string,
  limit = 100,
  offset = 0
): Promise<DocumentRow[]> {
  return db
    .select({
      id: ragDocuments.id,
      source: ragDocuments.source,
      title: ragDocuments.title,
      author: ragDocuments.author,
      created: ragDocuments.created,
      updated: ragDocuments.updated,
      metadata: ragDocuments.metadata,
    })
    .from(ragDocuments)
    .innerJoin(
      projectRagDocuments,
      eq(projectRagDocuments.documentId, ragDocuments.id)
    )
    .where(eq(projectRagDocuments.projectId, projectId))
    .orderBy(desc(ragDocuments.updated))
    .limit(limit)
    .offset(offset) as Promise<DocumentRow[]>;
}

// Chunk operations
export async function addChunks(
  documentId: string,
  chunks: Array<{
    content: string;
    order?: number;
    embedding?: number[];
    metadata?: unknown;
  }>
): Promise<ChunkRow[]> {
  if (chunks.length === 0) {
    return [] as ChunkRow[];
  }

  const values = chunks.map<ChunkInsert>((chunk, index) => ({
    documentId,
    content: chunk.content,
    order: chunk.order ?? index,
    embedding: chunk.embedding ?? null,
    metadata: chunk.metadata ?? null,
  }));

  return db.insert(ragChunks).values(values).returning() as Promise<ChunkRow[]>;
}

export async function getChunks(documentId: string): Promise<ChunkRow[]> {
  return db
    .select()
    .from(ragChunks)
    .where(eq(ragChunks.documentId, documentId))
    .orderBy(asc(ragChunks.order));
}

export type ChunkSearchResult = typeof ragChunks.$inferSelect & {
  score: number;
};

export async function searchChunks(
  embedding: number[],
  limit = 10,
  threshold = 0.7,
  documentId?: string,
  efSearch?: number
): Promise<ChunkSearchResult[]> {
  // Set LOCAL ef_search for query-time recall tuning (default: 40 for <1ms latency)
  const ef = efSearch ?? 40;
  const embeddingArrayExpr = `ARRAY[${embedding.join(",")}]`;

  // Use transaction for SET LOCAL
  // Note: SET commands don't support parameterized values, must use sql.raw()
  return await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL hnsw.ef_search = ${ef}`));

    const rows = await tx
      .select({
        id: ragChunks.id,
        documentId: ragChunks.documentId,
        content: ragChunks.content,
        order: ragChunks.order,
        metadata: ragChunks.metadata,
        created: ragChunks.created,
        embedding: ragChunks.embedding,
        score: sql<number>`1 - (embedding <=> ${sql.raw(embeddingArrayExpr)}::vector)`,
      })
      .from(ragChunks)
      .where(
        documentId
          ? and(
              isNotNull(ragChunks.embedding),
              eq(ragChunks.documentId, documentId)
            )
          : isNotNull(ragChunks.embedding)
      )
      .orderBy(sql`embedding <=> ${sql.raw(embeddingArrayExpr)}::vector ASC`)
      .limit(limit * 3);

    // Filter by threshold and limit (pgvector doesn't support WHERE on similarity)
    return rows
      .filter((row) => Number.isFinite(row.score) && row.score >= threshold)
      .slice(0, limit);
  });
}

export type HybridSearchOptions = {
  embedding: number[];
  query: string;
  limit?: number;
  threshold?: number;
  documentId?: string;
  denseWeight?: number;
  sparseWeight?: number;
  efSearch?: number;
  boostConcepts?: string[]; // Concepts to boost (e.g. "Coding", "Security")
};

export async function searchChunksHybrid({
  embedding,
  query,
  limit = 10,
  threshold = 0.7,
  documentId,
  denseWeight = 0.7,
  sparseWeight = 0.3,
  efSearch = 40,
  boostConcepts = [],
}: HybridSearchOptions): Promise<ChunkSearchResult[]> {
  const embeddingArrayExpr = `ARRAY[${embedding.join(",")}]`;
  const ef = efSearch;

  // Boost Query construction:
  // If boostConcepts are present, we construct a combined tsquery using OR (||)
  // We use plainto_tsquery for each concept to handle natural language input safely
  let boostRankExpression = sql`0`;

  if (boostConcepts.length > 0) {
    const conceptQueries = boostConcepts.map(
      (c) => sql`plainto_tsquery('english', ${c})`
    );
    const combinedQuery = sql.join(conceptQueries, sql` || `);
    boostRankExpression = sql`(CASE WHEN content_tsvector @@ (${combinedQuery}) THEN 0.2 ELSE 0 END)`;
  }

  // Use transaction for SET LOCAL
  // Note: SET commands don't support parameterized values, must use sql.raw()
  return await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL hnsw.ef_search = ${ef}`));

    // Dense vector similarity search
    let denseQuery = sql`
      SELECT 
        id,
        document_id as "documentId",
        content,
        "order",
        metadata,
        created_at as "created",
        1 - (embedding <=> ${sql.raw(embeddingArrayExpr)}::vector) AS dense_score
      FROM rag_chunks
      WHERE embedding IS NOT NULL
    `;

    if (documentId) {
      denseQuery = sql`${denseQuery} AND document_id = ${documentId}`;
    }

    // Sparse full-text search using tsvector with Boosting
    // We add a boost component to the rank if the concepts match
    const rankExpression = sql`
          ts_rank(content_tsvector, plainto_tsquery('english', ${query})) + ${boostRankExpression}
        `;

    let sparseQuery = sql`
      SELECT 
        id,
        document_id as "documentId",
        content,
        "order",
        metadata,
        created_at as "created",
        ${rankExpression} AS sparse_score
      FROM rag_chunks
      WHERE content_tsvector @@ plainto_tsquery('english', ${query})
    `;

    if (documentId) {
      sparseQuery = sql`${sparseQuery} AND document_id = ${documentId}`;
    }

    // Combine dense and sparse scores with weighted fusion
    const hybridQuery = sql`
      WITH dense_results AS (
        ${denseQuery}
        ORDER BY embedding <=> ${sql.raw(embeddingArrayExpr)}::vector ASC
        LIMIT ${limit * 3}
      ),
      sparse_results AS (
        ${sparseQuery}
        ORDER BY sparse_score DESC
        LIMIT ${limit * 3}
      )
      SELECT DISTINCT
        COALESCE(d.id, s.id) as id,
        COALESCE(d."documentId", s."documentId") as "documentId",
        COALESCE(d.content, s.content) as content,
        COALESCE(d."order", s."order") as "order",
        COALESCE(d.metadata, s.metadata) as metadata,
        COALESCE(d."created", s."created") as "created",
        (COALESCE(d.dense_score, 0) * ${denseWeight} + COALESCE(s.sparse_score, 0) * ${sparseWeight}) AS score
      FROM dense_results d
      FULL OUTER JOIN sparse_results s ON d.id = s.id
      WHERE COALESCE(d.dense_score, 0) * ${denseWeight} + COALESCE(s.sparse_score, 0) * ${sparseWeight} >= ${threshold}
      ORDER BY score DESC
      LIMIT ${limit}
    `;

    const result = await tx.execute(hybridQuery);
    const hybridResults = (result.rows as ChunkSearchResult[])
      .filter((row) => Number.isFinite(row.score) && row.score >= threshold)
      .slice(0, limit);

    return hybridResults.slice(0, limit);
  });
}

export async function deleteChunk(chunkId: string): Promise<number> {
  const rows = await db
    .delete(ragChunks)
    .where(eq(ragChunks.id, chunkId))
    .returning({ id: ragChunks.id });
  return rows.length;
}
