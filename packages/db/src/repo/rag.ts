/**
 * ALFRED RAG Repository
 * Document and chunk operations with vector embeddings
 */

import { rerank } from "@alfred/rag";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../index";
import { ragChunks, ragDocuments } from "../schema/rag";

type DocumentInsert = typeof ragDocuments.$inferInsert;
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

  // Build query using pgvector <=> operator with LOCAL ef_search
  let baseQuery = sql`
    SELECT 
      id,
      document_id as "documentId",
      content,
      "order",
      metadata,
      created_at as "created",
      1 - (embedding <=> ${sql.raw(embeddingArrayExpr)}::vector) AS score
    FROM rag_chunks
    WHERE embedding IS NOT NULL
  `;

  if (documentId) {
    baseQuery = sql`${baseQuery} AND document_id = ${documentId}`;
  }

  // Use LOCAL ef_search for HNSW index tuning (higher = better recall, slower)
  const finalQuery = sql`
    SET LOCAL hnsw.ef_search = ${ef};
    ${baseQuery}
    ORDER BY embedding <=> ${sql.raw(embeddingArrayExpr)}::vector ASC
    LIMIT ${limit * 3}
  `;

  const result = await db.execute(finalQuery);

  // Filter by threshold and limit (pgvector doesn't support WHERE on similarity)
  return (result.rows as Array<ChunkSearchResult>)
    .filter((row) => Number.isFinite(row.score) && row.score >= threshold)
    .slice(0, limit);
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
  useReranking?: boolean;
  rerankModel?:
    | "rerank-v3.5"
    | "rerank-english-v3.0"
    | "rerank-multilingual-v3.0";
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
  useReranking = false,
  rerankModel = "rerank-v3.5",
}: HybridSearchOptions): Promise<ChunkSearchResult[]> {
  const embeddingArrayExpr = `ARRAY[${embedding.join(",")}]`;
  const ef = efSearch;

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

  // Sparse full-text search using tsvector
  let sparseQuery = sql`
    SELECT 
      id,
      document_id as "documentId",
      content,
      "order",
      metadata,
      created_at as "created",
      ts_rank(content_tsvector, plainto_tsquery('english', ${query})) AS sparse_score
    FROM rag_chunks
    WHERE content_tsvector @@ plainto_tsquery('english', ${query})
  `;

  if (documentId) {
    sparseQuery = sql`${sparseQuery} AND document_id = ${documentId}`;
  }

  // Combine dense and sparse scores with weighted fusion
  const hybridQuery = sql`
    SET LOCAL hnsw.ef_search = ${ef};
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

  const result = await db.execute(hybridQuery);
  let hybridResults = (result.rows as Array<ChunkSearchResult>)
    .filter((row) => Number.isFinite(row.score) && row.score >= threshold)
    .slice(0, limit);

  // Apply reranking if enabled
  if (useReranking && hybridResults.length > 0) {
    try {
      const rerankResults = await rerank({
        query,
        documents: hybridResults.map((row) => ({
          id: row.id,
          text: row.content,
        })),
        topN: limit,
        model: rerankModel,
      });

      // Create a map of rerank scores by chunk ID
      const rerankScoreMap = new Map(
        rerankResults.map((item) => [item.id, item.score])
      );

      // Apply weighted fusion: finalScore = hybridScore * 0.7 + rerankScore * 0.3
      hybridResults = hybridResults.map((row) => {
        const rerankScore = rerankScoreMap.get(row.id) ?? 0;
        const finalScore = row.score * 0.7 + rerankScore * 0.3;
        return {
          ...row,
          score: finalScore,
        };
      });

      // Re-sort by final score
      hybridResults.sort((a, b) => b.score - a.score);
    } catch (error) {
      // Log error but continue with hybrid results
      console.error("Reranking failed in hybrid search:", error);
    }
  }

  return hybridResults.slice(0, limit);
}

export async function deleteChunk(chunkId: string): Promise<number> {
  const rows = await db
    .delete(ragChunks)
    .where(eq(ragChunks.id, chunkId))
    .returning({ id: ragChunks.id });
  return rows.length;
}
