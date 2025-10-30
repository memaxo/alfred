import { upsertEdges, upsertNodes } from "@alfred/db/src/repo/graph";
import type { KnowledgeEntry } from "@alfred/knowledge/extractor";

type NodeSeed = Parameters<typeof upsertNodes>[0][number];
type EdgeSeed = Parameters<typeof upsertEdges>[0][number];

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
  nodes: Map<string, { id: string }>,
): EdgeSeed | null {
  if (entry.data._ !== "relation") {
    return null;
  }

  const fromHash = String(entry.data.from);
  const toHash = String(entry.data.to);
  const from = nodes.get(nodeKey(resource, fromHash));
  const to = nodes.get(nodeKey(resource, toHash));
  if (!from || !to) {
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

export async function persistKnowledge(resource: string, entries: KnowledgeEntry[]): Promise<void> {
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
    const nodeMap = await upsertNodes(nodeSeeds);
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

    await upsertEdges(edges);
  } catch (err) {
    console.error("Failed to persist knowledge graph", err);
  }
}
