import { ragRepo } from "@alfred/db";
import {
  embed as embedLocal,
  embedMany as embedManyLocal,
  EMBEDDING_DIM,
} from "@alfred/embed";
import { extract, toKnowledge, type KnowledgeEntry } from "@alfred/knowledge/extractor";
import { upsertNodes, upsertEdges } from "@alfred/db/repo/graph";

/**
 * ALFRED RAG Document Processing
 */

const MAX_BATCH_SIZE = 1000;

export type EmbeddingProvider = {
  embed: (text: string) => Promise<number[]>;
  embedMany: (texts: string[]) => Promise<number[][]>;
};

const defaultEmbeddingProvider: EmbeddingProvider = {
  embed: embedLocal,
  embedMany: embedManyLocal,
};

let embeddingProvider: EmbeddingProvider = defaultEmbeddingProvider;

export function setEmbeddingProvider(provider?: EmbeddingProvider | null) {
  embeddingProvider = provider ?? defaultEmbeddingProvider;
}

export interface Chunk {
  content: string;
  embedding?: number[];
  order: number;
  metadata?: Record<string, unknown>;
}

function splitSentences(paragraph: string) {
  const sentences = paragraph
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  if (sentences.length === 0) {
    return [paragraph];
  }
  return sentences;
}

function pushBuffer(buffers: string[], buffer: string) {
  const trimmed = buffer.trim();
  if (trimmed.length > 0) {
    buffers.push(trimmed);
  }
}

export async function ingest(
  source: string,
  content: string,
  onProgress?: (processed: number, total: number) => void
): Promise<string> {
  if (!content || content.trim().length === 0) {
    throw new Error("rag_empty_content");
  }

  const document = await ragRepo.createDocument(
    source,
    `Doc @ ${new Date().toISOString()}`
  );
  const pieces = await chunk(content);

  if (pieces.length === 0) {
    return document.id;
  }

  // Process in batches if document is large
  const allEmbeddings: number[][] = [];
  let processed = 0;

  for (let i = 0; i < pieces.length; i += MAX_BATCH_SIZE) {
    const batch = pieces.slice(i, i + MAX_BATCH_SIZE);
    try {
      const batchEmbeddings = await embedMany(batch);
      allEmbeddings.push(...batchEmbeddings);
      processed += batch.length;
      onProgress?.(processed, pieces.length);
    } catch (error) {
      // Log error but continue with remaining batches
      // Note: Using console.error here as this is a pure RAG package without logger dependency
      // In production, this should be handled by the caller's logging infrastructure
      if (
        typeof process !== "undefined" &&
        process.env.NODE_ENV !== "production"
      ) {
        console.error(`Failed to embed batch ${i}-${i + batch.length}:`, error);
      }
      // Fill with empty embeddings for failed batch to maintain array length
      allEmbeddings.push(...batch.map(() => []));
    }
  }

  const chunks = pieces.map((piece, index) => ({
    content: piece,
    order: index,
    embedding:
      allEmbeddings[index]?.length === EMBEDDING_DIM
        ? allEmbeddings[index]
        : undefined,
    metadata: {
      source,
    },
  }));

  await ragRepo.addChunks(document.id, chunks);

  if (process.env.RAG_ENRICH_GRAPH === "1") {
    try {
      await enrichGraphFromChunks({
        documentId: document.id,
        source,
        chunks,
      });
    } catch (error) {
      if (
        typeof process !== "undefined" &&
        process.env.NODE_ENV !== "production"
      ) {
        // Best-effort enrichment; log for debugging but do not fail ingest.
        console.error("Failed to enrich knowledge graph from RAG chunks:", error);
      }
    }
  }

  return document.id;
}

export async function retrieve(
  query: string,
  k = 10,
  threshold = 0.7
): Promise<Chunk[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const vector = await embed(query);
  const fetchLimit = Math.max(k, Math.min(k * 3, 60));
  const rows = await ragRepo.searchChunks(vector, fetchLimit, threshold);

  // Apply an extra defensive threshold filter client-side to ensure
  // correctness even when the underlying repo does not enforce it.
  return rows
    .filter((row) => Number.isFinite(row.score) && row.score >= threshold)
    .slice(0, k)
    .map((row) => {
      const rawMetadata = row.metadata;
      const metadata =
        rawMetadata && typeof rawMetadata === "object"
          ? (rawMetadata as Record<string, unknown>)
          : rawMetadata !== undefined
            ? { value: rawMetadata }
            : undefined;

      return {
        content: row.content,
        order: row.order ?? 0,
        metadata: {
          ...(metadata ?? {}),
          score: row.score,
          documentId: row.documentId,
        },
      };
    });
}

export async function chunk(
  content: string,
  maxChunkSize = 512
): Promise<string[]> {
  const limit =
    Number.isFinite(maxChunkSize) && maxChunkSize > 0
      ? Math.floor(maxChunkSize)
      : 512;

  // Hierarchical separators: try to preserve structure
  // 1. Double newlines (paragraphs)
  // 2. Single newlines (sections)
  // 3. Sentence boundaries
  // 4. Hard character limit

  const paragraphs = content
    .split(/\n{2,}/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (paragraphs.length === 0) {
    const condensed = content.trim();
    return condensed.length === 0 ? [] : [condensed.slice(0, limit)];
  }

  const chunks: string[] = [];
  let buffer = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length <= limit) {
      const candidate =
        buffer.length > 0 ? `${buffer}\n\n${paragraph}` : paragraph;
      if (candidate.length <= limit) {
        buffer = candidate;
        continue;
      }
      pushBuffer(chunks, buffer);
      buffer = paragraph;
      continue;
    }

    // Paragraph too large; try splitting by single newlines first (sections)
    pushBuffer(chunks, buffer);
    buffer = "";

    const sections = paragraph
      .split(/\n+/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    let sectionBuffer = "";

    for (const section of sections) {
      if (section.length <= limit) {
        const candidate =
          sectionBuffer.length > 0 ? `${sectionBuffer}\n${section}` : section;
        if (candidate.length <= limit) {
          sectionBuffer = candidate;
          continue;
        }
        pushBuffer(chunks, sectionBuffer);
        sectionBuffer = section;
        continue;
      }

      // Section still too large; split by sentences
      if (sectionBuffer.length > 0) {
        pushBuffer(chunks, sectionBuffer);
        sectionBuffer = "";
      }

      const sentences = splitSentences(section);
      let sentenceBuffer = "";
      for (const sentence of sentences) {
        if (sentence.length > limit) {
          // Sentence still too large, fallback to hard split
          const parts = sentence.match(new RegExp(`.{1,${limit}}`, "gu")) ?? [
            sentence,
          ];
          for (const part of parts) {
            pushBuffer(chunks, part);
          }
          sentenceBuffer = "";
          continue;
        }
        const candidate =
          sentenceBuffer.length > 0
            ? `${sentenceBuffer} ${sentence}`
            : sentence;
        if (candidate.length <= limit) {
          sentenceBuffer = candidate;
          continue;
        }
        pushBuffer(chunks, sentenceBuffer);
        sentenceBuffer = sentence;
      }
      pushBuffer(chunks, sentenceBuffer);
    }
    pushBuffer(chunks, sectionBuffer);
  }

  pushBuffer(chunks, buffer);
  return chunks;
}

type StoredChunk = {
  content: string;
  order: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
};

async function enrichGraphFromChunks(args: {
  documentId: string;
  source: string;
  chunks: StoredChunk[];
}): Promise<void> {
  if (!process.env.DATABASE_URL) {
    // No backing database configured; skip enrichment.
    return;
  }

  const entries: KnowledgeEntry[] = [];

  // Create a user-scoped document node to anchor provenance links.
  // This keeps RAG provenance visible to Mindscape and runtime graph
  // queries without changing existing rag:<source> enrichment.
  const docResource = "user";
  try {
    await upsertNodes([
      {
        resource: docResource,
        hash: `rag_doc:${args.documentId}`,
        kind: "rag_document",
        label: args.source,
        properties: {
          documentId: args.documentId,
          source: args.source,
          ragResource: `rag:${args.source}`,
        },
      },
    ] as any);
  } catch (error) {
    if (
      typeof process !== "undefined" &&
      process.env.NODE_ENV !== "production"
    ) {
      console.error(
        "Failed to upsert RAG document node for provenance:",
        error
      );
    }
  }

  for (const chunk of args.chunks) {
    const extraction = extract(chunk.content, args.source);
    const knowledge = toKnowledge(extraction);
    if (knowledge.length > 0) {
      entries.push(...knowledge);
    }
  }

  if (entries.length === 0) {
    return;
  }

  const resource = `rag:${args.source}`;
  await persistRagKnowledge(resource, entries);
}

type NodeSeed = {
  resource: string;
  hash: string;
  kind: string;
  label: string;
  properties?: Record<string, unknown>;
};

type EdgeSeed = {
  resource: string;
  hash: string;
  fromId: string;
  toId: string;
  kind: string;
  weight: number;
  metadata?: Record<string, unknown>;
};

function nodeKey(resource: string, hash: string): string {
  return `${resource}:${hash}`;
}

function makeNode(resource: string, entry: KnowledgeEntry): NodeSeed | null {
  const { data, hash } = entry;
  switch (data._) {
    case "fact":
      return {
        resource,
        hash,
        kind: data._,
        label: data.content,
        properties: {
          confidence: data.confidence,
          source: data.source,
          ts: data.ts,
        },
      };
    case "insight":
      return {
        resource,
        hash,
        kind: data._,
        label: data.conclusion,
        properties: {
          derived: data.derived,
          confidence: data.confidence,
        },
      };
    case "pattern":
      return {
        resource,
        hash,
        kind: data._,
        label: data.rule,
        properties: {
          examples: data.examples,
          accuracy: data.accuracy,
        },
      };
    default:
      return null;
  }
}

function makeEdge(
  resource: string,
  entry: KnowledgeEntry,
  nodes: Map<string, { id: string }>
): EdgeSeed | null {
  if (entry.data._ !== "relation") {
    return null;
  }

  const fromHash = String(entry.data.from);
  const toHash = String(entry.data.to);
  const from = nodes.get(nodeKey(resource, fromHash));
  const to = nodes.get(nodeKey(resource, toHash));
  if (!(from && to)) {
    return null;
  }

  return {
    resource,
    hash: entry.hash,
    fromId: from.id,
    toId: to.id,
    kind: entry.data.kind,
    weight: entry.data.weight,
    metadata: {
      from: fromHash,
      to: toHash,
    },
  };
}

async function persistRagKnowledge(
  resource: string,
  entries: KnowledgeEntry[]
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const nodeSeeds: NodeSeed[] = [];
  const edgeSeeds: KnowledgeEntry[] = [];

  for (const entry of entries) {
    const nodeSeed = makeNode(resource, entry);
    if (nodeSeed) {
      nodeSeeds.push(nodeSeed);
    }
    if (entry.data._ === "relation") {
      edgeSeeds.push(entry);
    }
  }

  if (nodeSeeds.length === 0) {
    return;
  }

  const nodeMap = await upsertNodes(nodeSeeds as any);
  if (edgeSeeds.length === 0) {
    return;
  }

  const idMap = new Map<string, { id: string }>();
  for (const row of nodeMap.values()) {
    idMap.set(nodeKey(row.resource, row.hash), { id: row.id });
  }

  const edges: EdgeSeed[] = [];
  for (const relation of edgeSeeds) {
    const seed = makeEdge(resource, relation, idMap);
    if (seed) {
      edges.push(seed);
    }
  }

  if (edges.length === 0) {
    return;
  }

  await upsertEdges(edges as any);
}


export async function embed(text: string): Promise<number[]> {
  const embedding = await embeddingProvider.embed(text);

  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
    throw new Error("rag_embed_invalid_vector");
  }

  return embedding;
}

/**
 * Batch embedding function using local KaLM model for optimized performance.
 * Processes multiple texts via embedding pool.
 */
export async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const embeddings = await embeddingProvider.embedMany(texts);

  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new Error("rag_embed_mismatch");
  }

  return embeddings;
}
