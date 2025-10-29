/**
 * ALFRED RAG Repository
 * Document and chunk operations with vector embeddings
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../index";
import { ragDocuments, ragChunks } from "../schema/rag";

type DocumentInsert = typeof ragDocuments.$inferInsert;
type ChunkInsert = typeof ragChunks.$inferInsert;

function cosineSimilarity(a: number[], b: number[]) {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dot = 0;
  let sumA = 0;
  let sumB = 0;

  for (let i = 0; i < len; i += 1) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    sumA += ai * ai;
    sumB += bi * bi;
  }

  if (sumA === 0 || sumB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(sumA) * Math.sqrt(sumB));
}

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

export async function searchChunks(embedding: number[], limit = 10, threshold = 0.7, documentId?: string) {
  let where = sql`embedding IS NOT NULL` as any;
  if (documentId) {
    where = and(where, eq(ragChunks.documentId, documentId));
  }

  const rows = await db
    .select({
      id: ragChunks.id,
      documentId: ragChunks.documentId,
      content: ragChunks.content,
      order: ragChunks.order,
      embedding: ragChunks.embedding,
      metadata: ragChunks.metadata,
      created: ragChunks.created,
    })
    .from(ragChunks)
    .where(where);

  return rows
    .map(row => {
      const vector = Array.isArray(row.embedding) ? (row.embedding as number[]) : [];
      const score = cosineSimilarity(vector, embedding);
      return {
        ...row,
        score,
      } as ChunkSearchResult;
    })
    .filter(row => Number.isFinite(row.score) && row.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function deleteChunk(chunkId: string) {
  const rows = await db.delete(ragChunks).where(eq(ragChunks.id, chunkId)).returning({ id: ragChunks.id });
  return rows.length;
}
