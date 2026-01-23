import * as graphRepo from "@alfred/db/repo/graph/index";
import { findRagDocumentNode } from "@alfred/db/repo/graph/read";
import { touchNodes } from "@alfred/db/repo/graph/write";
import * as ragRepo from "@alfred/db/repo/rag";
import type { ChunkSearchResult } from "@alfred/db/repo/rag";
import {
  EMBEDDING_DIM,
  type EmbeddingInput,
  embed as embedLocal,
  embedMany as embedManyLocal,
  getRegistry,
  MODEL_IDS,
} from "@alfred/embed";
import {
  extract,
  type KnowledgeEntry,
  toKnowledge,
} from "@alfred/knowledge/extractor";

/**
 * ALFRED RAG Document Processing
 */

const MAX_BATCH_SIZE = 1000;

export type EmbeddingProvider = {
  embed: (text: string) => Promise<number[]>;
  embedMany: (texts: string[]) => Promise<number[][]>;
  /** Model ID for tracking which model generated embeddings */
  modelId?: string;
};

const defaultEmbeddingProvider: EmbeddingProvider = {
  embed: embedLocal,
  embedMany: embedManyLocal,
  modelId: MODEL_IDS.KALM_12B, // Default to KaLM for backwards compatibility
};

let embeddingProvider: EmbeddingProvider = defaultEmbeddingProvider;

/**
 * Set the embedding provider for RAG operations
 * @param provider - Custom provider or null to reset to default
 */
export function setEmbeddingProvider(
  provider?: EmbeddingProvider | null
): void {
  embeddingProvider = provider ?? defaultEmbeddingProvider;
}

/**
 * Get the current embedding model ID
 * Checks registry first, falls back to provider's modelId
 */
export function getCurrentModelId(): string {
  try {
    const registry = getRegistry();
    const defaultId = registry.getDefaultId();
    if (defaultId) {
      return defaultId;
    }
  } catch {
    // Registry not initialized
  }
  return embeddingProvider.modelId ?? MODEL_IDS.KALM_12B;
}

export type Chunk = {
  content: string;
  embedding?: number[];
  order: number;
  metadata?: Record<string, unknown>;
};

function splitSentences(paragraph: string): string[] {
  const sentences = paragraph
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  if (sentences.length === 0) {
    return [paragraph];
  }
  return sentences;
}

function pushBuffer(buffers: string[], buffer: string): void {
  const trimmed = buffer.trim();
  if (trimmed.length > 0) {
    buffers.push(trimmed);
  }
}

export type IngestOptions = {
  /** Source identifier for the document */
  source: string;
  /** Text content to ingest */
  content: string;
  /** Optional image URL for multimodal embedding */
  imageUrl?: string;
  /** Progress callback */
  onProgress?: (processed: number, total: number) => void;
};

export async function ingest(
  source: string,
  content: string,
  onProgress?: (processed: number, total: number) => void
): Promise<string> {
  return ingestWithOptions({ source, content, onProgress });
}

/**
 * Ingest a document with optional multimodal support
 */
export async function ingestWithOptions(
  options: IngestOptions
): Promise<string> {
  const { source, content, imageUrl, onProgress } = options;

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

  // Get current model ID for tracking
  const modelId = getCurrentModelId();

  // Process in batches if document is large
  const allEmbeddings: number[][] = [];
  let processed = 0;

  for (let i = 0; i < pieces.length; i += MAX_BATCH_SIZE) {
    const batch = pieces.slice(i, i + MAX_BATCH_SIZE);
    try {
      // Use multimodal embedding if imageUrl is provided
      const batchEmbeddings = imageUrl
        ? await embedManyMultimodal(batch, imageUrl)
        : await embedMany(batch);
      allEmbeddings.push(...batchEmbeddings);
      processed += batch.length;
      onProgress?.(processed, pieces.length);
    } catch (_error) {
      // Log error but continue with remaining batches
      if (
        typeof process !== "undefined" &&
        process.env.NODE_ENV !== "production"
      ) {
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
    embeddingModelId:
      allEmbeddings[index]?.length === EMBEDDING_DIM ? modelId : undefined,
    metadata: {
      source,
      ...(imageUrl ? { imageUrl } : {}),
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
    } catch (_error) {
      if (
        typeof process !== "undefined" &&
        process.env.NODE_ENV !== "production"
      ) {
      }
    }
  }

  return document.id;
}

export type RetrieveOptions = {
  /** Search query */
  query: string;
  /** Number of results to return */
  k?: number;
  /** Minimum similarity threshold */
  threshold?: number;
  /** Filter by document ID */
  documentId?: string;
  /** Filter by embedding model ID (defaults to current model) */
  modelId?: string;
};

export async function retrieve(
  query: string,
  k = 10,
  threshold = 0.7
): Promise<Chunk[]> {
  return retrieveWithOptions({ query, k, threshold });
}

/**
 * Retrieve chunks with model-aware filtering
 */
export async function retrieveWithOptions(
  options: RetrieveOptions
): Promise<Chunk[]> {
  const { query, k = 10, threshold = 0.7, documentId, modelId } = options;

  if (!query || query.trim().length === 0) {
    return [];
  }

  // Use current model ID if not specified
  const effectiveModelId = modelId ?? getCurrentModelId();

  const vector = await embed(query);
  const fetchLimit = Math.max(k, Math.min(k * 3, 60));
  const rows = await ragRepo.searchChunks(
    vector,
    fetchLimit,
    threshold,
    documentId,
    undefined, // efSearch
    effectiveModelId
  );

  // Apply an extra defensive threshold filter client-side to ensure
  // correctness even when the underlying repo does not enforce it.
  const chunks = rows
    .filter((row: ChunkSearchResult) => Number.isFinite(row.score) && row.score >= threshold)
    .slice(0, k)
    .map((row: ChunkSearchResult) => {
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
          modelId: (row as any).embeddingModelId,
        },
      };
    });

  // Active Recall: Reinforce document nodes for retrieved chunks
  const documentIds = Array.from(
    new Set(
      chunks
        .map((c: Chunk) => c.metadata?.documentId)
        .filter((id: unknown): id is string => typeof id === "string")
    )
  );

  if (documentIds.length > 0) {
    // Fire-and-forget to avoid latency
    void (async () => {
      try {
        // Find memory nodes corresponding to these documents
        const nodeIds: string[] = [];
        for (const docId of documentIds) {
          const node = await findRagDocumentNode(docId);
          if (node) {
            nodeIds.push(node.id);
          }
        }
        if (nodeIds.length > 0) {
          await touchNodes(nodeIds);
        }
      } catch (_err) {
        // Non-blocking: failures don't affect retrieval
      }
    })();
  }

  return chunks;
}

export async function chunk(
  content: string,
  maxChunkSize = 512
): Promise<string[]> {
  const limit =
    Number.isFinite(maxChunkSize) && maxChunkSize > 0
      ? Math.floor(maxChunkSize)
      : 512;

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

      if (sectionBuffer.length > 0) {
        pushBuffer(chunks, sectionBuffer);
        sectionBuffer = "";
      }

      const sentences = splitSentences(section);
      let sentenceBuffer = "";
      for (const sentence of sentences) {
        if (sentence.length > limit) {
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
    return;
  }

  const entries: KnowledgeEntry[] = [];

  const docResource = "user";
  try {
    await graphRepo.upsertNodes([
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
  } catch (_error) {
    if (
      typeof process !== "undefined" &&
      process.env.NODE_ENV !== "production"
    ) {
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

  const nodeMap = await graphRepo.upsertNodes(nodeSeeds as any);
  if (edgeSeeds.length === 0) {
    return;
  }

  const idMap = new Map<string, { id: string }>();
  for (const row of nodeMap.values()) {
    const nodeRow = row as { resource: string; hash: string; id: string };
    idMap.set(nodeKey(nodeRow.resource, nodeRow.hash), { id: nodeRow.id });
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

  await graphRepo.upsertEdges(edges as any);
}

export async function embed(text: string): Promise<number[]> {
  const embedding = await embeddingProvider.embed(text);

  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
    throw new Error("rag_embed_invalid_vector");
  }

  return embedding;
}

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

/**
 * Embed text with an associated image (multimodal)
 * Uses the registry to find a provider that supports mixed inputs
 */
export async function embedManyMultimodal(
  texts: string[],
  imageUrl: string
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  try {
    const registry = getRegistry();
    const provider = registry.findByCapability("mixed");

    if (provider) {
      // Use multimodal provider
      const inputs: EmbeddingInput[] = texts.map((text) => ({
        type: "mixed" as const,
        text,
        imageUrl,
      }));
      return provider.embedMany(inputs);
    }
  } catch {
    // Registry not initialized or no multimodal provider
  }
  return embedMany(texts);
}
