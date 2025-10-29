/**
 * ALFRED RAG Repository
 * Document and chunk operations with vector embeddings
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../index";
import { ragDocuments, ragChunks } from "../schema/rag";

type DocumentInsert = typeof ragDocuments.$inferInsert;
type ChunkInsert = typeof ragChunks.$inferInsert;

// Document operations
export async function createDocument(source: string, title?: string, author?: string, metadata?: unknown) {
  const [row] = await db
    .insert(ragDocuments)
    .values({
      source,
      title: title ?? null,
      author: author ?? null,
      metadata: metadata ?? null,
    })
    .returning();

  return row;
}

export async function getDocument(documentId: string) {
  const rows = await db.select().from(ragDocuments).where(eq(ragDocuments.id, documentId)).limit(1);
  return rows[0] ?? null;
}

export async function listDocuments(limit = 100, offset = 0) {
  return db
    .select()
    .from(ragDocuments)
    .orderBy(desc(ragDocuments.created))
    .limit(limit)
    .offset(offset);
}

export async function deleteDocument(documentId: string) {
  const rows = await db.delete(ragDocuments).where(eq(ragDocuments.id, documentId)).returning({ id: ragDocuments.id });
  return rows.length;
}

// Chunk operations
export async function addChunks(
  documentId: string,
  chunks: Array<{ content: string; order?: number; embedding?: number[]; metadata?: unknown }>,
) {
  if (chunks.length === 0) {
    return [] as Array<typeof ragChunks.$inferSelect>;
  }

  const values = chunks.map<ChunkInsert>((chunk, index) => ({
    documentId,
    content: chunk.content,
    order: chunk.order ?? index,
    embedding: chunk.embedding ?? null,
    metadata: chunk.metadata ?? null,
  }));

  return db.insert(ragChunks).values(values).returning();
}

export async function getChunks(documentId: string) {
  return db
    .select()
    .from(ragChunks)
    .where(eq(ragChunks.documentId, documentId))
    .orderBy(asc(ragChunks.order));
}

export type ChunkSearchResult = (typeof ragChunks.$inferSelect) & { score: number };

export async function searchChunks(
  embedding: number[],
  limit = 10,
  threshold = 0.7,
  documentId?: string,
): Promise<ChunkSearchResult[]> {
  // Format embedding array as PostgreSQL array constructor for vector cast
  const embeddingArrayExpr = `ARRAY[${embedding.join(",")}]`;
  
  // Build query using pgvector <=> operator
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

  // Order by similarity and fetch more than needed for threshold filtering
  const finalQuery = sql`
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

export async function deleteChunk(chunkId: string) {
  const rows = await db.delete(ragChunks).where(eq(ragChunks.id, chunkId)).returning({ id: ragChunks.id });
  return rows.length;
}
