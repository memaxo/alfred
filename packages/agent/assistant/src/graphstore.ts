import {
  enrichReasoningContext,
  extractReasoning,
  toKnowledge,
  type KnowledgeEntry,
} from "@alfred/knowledge/extractor";
import { createHash } from "node:crypto";

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

function reasoningNodeHash(
  resource: string,
  executionId: string | undefined,
  index: number,
  timestamp: number,
  text: string
): string {
  const hash = createHash("sha256");
  hash.update(resource);
  hash.update("|");
  hash.update(executionId ?? "unknown");
  hash.update("|");
  hash.update(index.toString());
  hash.update("|");
  hash.update(timestamp.toString());
  hash.update("|");
  hash.update(text);
  return hash.digest("hex");
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

export async function persistKnowledge(
  resource: string,
  entries: KnowledgeEntry[]
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  if (!process.env.DATABASE_URL) {
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

  try {
    const { upsertNodes, upsertEdges } = await import("@alfred/db/src/repo/graph");
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
  } catch (err) {
    console.error("Failed to persist knowledge graph", err);
  }
}

/**
 * Persist reasoning traces to knowledge graph
 * Creates temporal chain of reasoning nodes with metadata
 */
export async function persistReasoning(
  resource: string,
  traces: Array<{ text: string; timestamp: number }>,
  context?: {
    threadId?: string;
    executionId?: string;
    auto?: string;
  }
): Promise<void> {
  if (traces.length === 0) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    return;
  }

  const allEntries: KnowledgeEntry[] = [];
  const executionKey = context?.executionId ?? context?.threadId ?? resource;

  for (const trace of traces) {
    const extraction = extractReasoning(trace.text, {
      threadId: context?.threadId,
      source: `reasoning:${executionKey}`,
    });

    const entries = toKnowledge(extraction);
    const enriched = enrichReasoningContext(entries, {
      threadId: context?.threadId,
      sessionId: executionKey,
      timestamp: trace.timestamp,
    });

    allEntries.push(...enriched);
  }

  if (allEntries.length === 0) {
    return;
  }

  try {
    await persistKnowledge(resource, allEntries);

    if (traces.length === 0) {
      return;
    }

    const nodeSeeds: NodeSeed[] = traces.map((trace, index) => {
      const hash = reasoningNodeHash(
        resource,
        context?.executionId,
        index,
        trace.timestamp,
        trace.text
      );

      return {
        resource,
        hash,
        kind: "reasoning",
        label: trace.text.substring(0, 100),
        properties: {
          timestamp: trace.timestamp,
          index,
          sequenceIndex: index,
          threadId: context?.threadId,
          executionId: executionKey,
          auto: context?.auto,
        },
      };
    });

    for (let i = 0; i < nodeSeeds.length; i++) {
      const current = nodeSeeds[i];
      if (!current) continue;
      const properties = (current.properties ??= {});
      const previous = nodeSeeds[i - 1];
      const next = nodeSeeds[i + 1];
      if (previous) {
        (properties as Record<string, unknown>).previousHash = previous.hash;
      }
      if (next) {
        (properties as Record<string, unknown>).nextHash = next.hash;
      }
    }

    const { upsertNodes, upsertEdges } = await import("@alfred/db/src/repo/graph");
    const nodeMap = await upsertNodes(nodeSeeds as any);
    const hashToRow = new Map<string, { id: string; hash: string }>();
    for (const row of nodeMap.values()) {
      hashToRow.set(row.hash, { id: row.id, hash: row.hash });
    }

    if (nodeSeeds.length > 1) {
      const edgeSeeds: EdgeSeed[] = [];
      for (let i = 0; i < nodeSeeds.length - 1; i++) {
        const currentSeed = nodeSeeds[i];
        const nextSeed = nodeSeeds[i + 1];
        if (!currentSeed || !nextSeed) continue;
        const currentRow = hashToRow.get(currentSeed.hash);
        const nextRow = hashToRow.get(nextSeed.hash);
        if (!currentRow || !nextRow) continue;

        const delta =
          (traces[i + 1]?.timestamp ?? traces[i]?.timestamp ?? 0) -
          (traces[i]?.timestamp ?? 0);
          const edgeHash = createHash("sha256")
          .update(resource)
          .update("|")
          .update(currentSeed.hash)
          .update("|")
          .update(nextSeed.hash)
          .digest("hex");

        edgeSeeds.push({
          resource,
          hash: edgeHash,
          fromId: currentRow.id,
          toId: nextRow.id,
          kind: "precedes",
          weight: 1,
          metadata: {
            timeDelta: delta,
            fromIndex: currentSeed.properties?.sequenceIndex ?? i,
            toIndex: nextSeed.properties?.sequenceIndex ?? i + 1,
          },
        });
      }

      if (edgeSeeds.length > 0) {
        await upsertEdges(edgeSeeds as any);
      }
    }
  } catch (err) {
    console.error("Failed to persist reasoning traces", err);
  }
}
