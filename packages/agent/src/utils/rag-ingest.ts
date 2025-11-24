import { ragRepo } from "@alfred/db";
import { upsertEdges, upsertNodes } from "@alfred/db/repo/graph";
import {
  extract,
  type KnowledgeEntry,
  toKnowledge,
} from "@alfred/knowledge/extractor";
import { chunk, EMBEDDING_DIM, embed, embedMany } from "@alfred/rag";

/**
 * RAG Ingestion Utility
 * Orchestrates Document/Code ingestion into Vector DB + Graph
 */

const MAX_BATCH_SIZE = 1000;

export type CodeFile = {
  path: string;
  content: string;
  startLine?: number;
  endLine?: number;
  tokens?: number;
};

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
    } catch (_error) {
      // Log error but continue with remaining batches
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
    } catch (_error) {
      // Fail silently on enrichment
    }
  }

  return document.id;
}

export async function ingestCodeFiles(
  source: string,
  files: CodeFile[]
): Promise<string | null> {
  if (!Array.isArray(files) || files.length === 0) {
    return null;
  }

  const prepared = files.filter(
    (file) => typeof file.content === "string" && file.content.trim().length > 0
  );
  if (prepared.length === 0) {
    return null;
  }

  const document = await ragRepo.createDocument(
    source,
    `Code context ${new Date().toISOString()}`,
    undefined,
    {
      kind: "code",
    }
  );
  const documentId = document?.id;
  if (!documentId) {
    return null;
  }

  const chunks: Array<{
    content: string;
    order: number;
    embedding: number[];
    metadata: Record<string, unknown>;
  }> = [];

  let order = 0;
  for (const file of prepared) {
    const header = file.path ? `// ${file.path}\n` : "";
    const chunkContent = `${header}${file.content}`;
    let vector: number[];
    try {
      vector = await embed(chunkContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`rag_code_embed_failed:${file.path}:${message}`);
    }

    const metadata: Record<string, unknown> = {
      path: file.path,
      source,
    };
    if (typeof file.startLine === "number") {
      metadata.startLine = file.startLine;
    }
    if (typeof file.endLine === "number") {
      metadata.endLine = file.endLine;
    }
    if (typeof file.tokens === "number") {
      metadata.tokens = file.tokens;
    }

    chunks.push({
      content: chunkContent,
      order: order++,
      embedding: vector,
      metadata,
    });
  }

  if (chunks.length === 0) {
    return documentId;
  }

  await ragRepo.addChunks(documentId, chunks);

  return documentId;
}

// Helper functions for Graph Enrichment

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
  } catch (_error) {
    // Ignore
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

  await upsertEdges(edges as any);
}
