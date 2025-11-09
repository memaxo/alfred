import {
  enrichReasoningContext,
  extractReasoning,
  toKnowledge,
  type KnowledgeEntry,
} from "@alfred/knowledge/extractor";
import { fact, knowledgeHash } from "@alfred/knowledge/hypergraph";

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

  for (const trace of traces) {
    const extraction = extractReasoning(trace.text, {
      threadId: context?.threadId,
      source: `reasoning:${context?.executionId ?? "unknown"}`,
    });

    const entries = toKnowledge(extraction);
    const enriched = enrichReasoningContext(entries, {
      threadId: context?.threadId,
      sessionId: context?.executionId,
      timestamp: trace.timestamp,
    });

    allEntries.push(...enriched);
  }

  if (allEntries.length === 0) {
    return;
  }

  try {
    await persistKnowledge(resource, allEntries);

    if (traces.length > 1) {
      const nodeSeeds: NodeSeed[] = traces.map((trace, index) => ({
        resource,
        hash: knowledgeHash(
          fact(trace.text, 0.8, "reasoning-trace")
        ),
        kind: "reasoning",
        label: trace.text.substring(0, 100),
        properties: {
          timestamp: trace.timestamp,
          index,
          threadId: context?.threadId,
          executionId: context?.executionId,
          auto: context?.auto,
        },
      }));

      const { upsertNodes, upsertEdges } = await import("@alfred/db/src/repo/graph");
      const nodeMap = await upsertNodes(nodeSeeds as any);
      const nodeList = Array.from(nodeMap.values());

      if (nodeList.length > 1) {
        const edgeSeeds: EdgeSeed[] = [];
        for (let i = 0; i < nodeList.length - 1; i++) {
          const current = nodeList[i];
          const next = nodeList[i + 1];
          if (!current || !next) continue;
          const t0 = traces[i]?.timestamp ?? 0;
          const t1 = traces[i + 1]?.timestamp ?? t0;
          edgeSeeds.push({
            resource,
            hash: `reasoning-seq-${current.hash}-${next.hash}`,
            fromId: current.id,
            toId: next.id,
            kind: "precedes",
            weight: 1,
            metadata: {
              timeDelta: Number(t1) - Number(t0),
            },
          });
        }

        if (edgeSeeds.length > 0) {
          await upsertEdges(edgeSeeds as any);
        }
      }
    }
  } catch (err) {
    console.error("Failed to persist reasoning traces", err);
  }
}
