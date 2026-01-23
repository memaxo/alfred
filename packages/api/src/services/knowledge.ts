import { db } from "@alfred/db";
import { upsertEdges, upsertNodes } from "@alfred/db/repo/graph";
import { touchNodes } from "@alfred/db/repo/graph/write";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import type { Knowledge, NodeId } from "@alfred/knowledge/hypergraph";
import { logger } from "@alfred/logger";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

/** Maximum facts to fetch for entity filtering */
const ENTITY_FETCH_LIMIT = 500;

type GraphNodeSeed = {
  resource: string;
  hash: string;
  kind: string;
  label: string;
  properties?: unknown;
  embedding?: number[];
};

type GraphEdgeSeed = {
  resource: string;
  hash: string;
  fromId: string;
  toId: string;
  kind: string;
  weight?: number;
  metadata?: unknown;
};

type VisualizeNode = {
  id: string;
  label: string;
  entityType?: string;
  confidence?: number;
  archived?: string;
  description?: string;
  hgHash?: string;
};

type VisualizeEdge = {
  id: string;
  fromId: string;
  toId: string;
  kind: string;
  weight?: number;
};

type VisualizeResult = {
  nodes: VisualizeNode[];
  edges: VisualizeEdge[];
  meta: {
    resource: string;
    extractedEntities: number;
    nodeCount: number;
    edgeCount: number;
  };
};

function asProps(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function nodeKey(resource: string, hash: string): string {
  return `${resource}:${hash}`;
}

function makeNode(
  resource: string,
  entry: { hash: string; data: Knowledge }
): GraphNodeSeed | null {
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
  entry: { hash: string; data: Knowledge },
  nodes: Map<string, { id: string }>
): GraphEdgeSeed | null {
  if (entry.data._ !== "relation") {
    return null;
  }
  const fromHash = String(entry.data.from as unknown as NodeId);
  const toHash = String(entry.data.to as unknown as NodeId);
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

/**
 * Knowledge domain service
 *
 * Extracts business logic from knowledge router to keep routers thin.
 * Handles knowledge graph visualization, extraction, and persistence.
 */
export async function visualizeKnowledge(input: {
  text: string;
  resource?: string;
  limit?: number;
  userId: string;
}): Promise<VisualizeResult> {
  const resource = input.resource ?? "user";
  const limit = input.limit ?? 20;
  const source = `mindscape:${input.userId}`;

  const { extract, toKnowledge } = await import("@alfred/knowledge/extractor");
  const extraction = extract(input.text, source);
  const entries = toKnowledge(extraction);

  // Persist to DB (facts + entity facts + relation edges) with visible failures (unlike runtime fire-and-forget).
  const nodeSeeds: GraphNodeSeed[] = [];
  const relationEntries: Array<{ hash: string; data: Knowledge }> = [];
  for (const entry of entries) {
    const nodeSeed = makeNode(resource, entry);
    if (nodeSeed) {
      nodeSeeds.push(nodeSeed);
    }
    if (entry.data._ === "relation") {
      relationEntries.push(entry);
    }
  }

  const nodeMap = await upsertNodes(nodeSeeds);

  // Active Recall: Reinforce newly created/updated nodes
  try {
    const nodeIds = Array.from(nodeMap.values()).map((n) => n.id);
    if (nodeIds.length > 0) {
      await touchNodes(nodeIds);
    }
  } catch (error) {
    // Non-blocking: log but don't throw
    logger.debug("active_recall_failed", {
      error: error instanceof Error ? error.message : String(error),
      nodeCount: nodeMap.size,
    });
  }

  if (relationEntries.length > 0) {
    const idMap = new Map<string, { id: string }>();
    for (const row of nodeMap.values()) {
      idMap.set(nodeKey(row.resource, row.hash), { id: row.id });
    }

    const edgeSeeds: GraphEdgeSeed[] = [];
    for (const rel of relationEntries) {
      const seed = makeEdge(resource, rel, idMap);
      if (seed) {
        edgeSeeds.push(seed);
      }
    }
    if (edgeSeeds.length > 0) {
      await upsertEdges(edgeSeeds);
    }
  }

  const extractedEntityLabels = new Set(
    (extraction.entityDetails ?? [])
      .filter((entity) => !entity.isPronoun)
      .map((entity) => entity.label.trim().toLowerCase())
      .filter(Boolean)
  );

  // Pull a bounded window of recent entity fact nodes with SQL-level filtering.
  // Filter by source containing ":entity" at the database level for better performance.
  const recentEntityFacts = await db
    .select()
    .from(memoryNodes)
    .where(
      and(
        eq(memoryNodes.resource, resource),
        eq(memoryNodes.kind, "fact"),
        sql`json_extract(${memoryNodes.properties}, '$.source') LIKE '%:entity%'`
      )
    )
    .orderBy(desc(memoryNodes.created))
    .limit(ENTITY_FETCH_LIMIT);

  const { parseEntityFactLabel } = await import("@alfred/knowledge/entity");

  // Further filter by parsed entity label format and extracted labels
  const entityRows = recentEntityFacts.filter((row) => {
    const parsed = parseEntityFactLabel(row.label);
    if (!parsed) {
      return false;
    }
    if (extractedEntityLabels.size === 0) {
      return true;
    }
    return extractedEntityLabels.has(parsed.label.toLowerCase());
  });

  const picked = entityRows.slice(0, limit);
  const nodeIds = picked.map((row) => row.id);
  const nodeIdSet = new Set(nodeIds);

  const nodes: VisualizeNode[] = picked.map((row) => {
    const props = asProps(row.properties);
    const parsed = parseEntityFactLabel(row.label);
    const confidence =
      typeof props.confidence === "number" ? props.confidence : undefined;
    const archived =
      typeof props.archived === "string" ? props.archived : undefined;
    const description =
      typeof props.description === "string" ? props.description : undefined;

    return {
      id: row.id,
      label: parsed?.label ?? row.label,
      entityType: parsed?.entityType,
      confidence,
      archived,
      description,
      hgHash: row.hash,
    };
  });

  const edges: VisualizeEdge[] =
    nodeIds.length === 0
      ? []
      : (
          await db
            .select()
            .from(memoryEdges)
            .where(
              and(
                eq(memoryEdges.resource, resource),
                or(
                  inArray(memoryEdges.fromId, nodeIds),
                  inArray(memoryEdges.toId, nodeIds)
                )
              )
            )
            .orderBy(desc(memoryEdges.created))
        )
          .filter(
            (edge) => nodeIdSet.has(edge.fromId) && nodeIdSet.has(edge.toId)
          )
          .map((edge) => ({
            id: edge.id,
            fromId: edge.fromId,
            toId: edge.toId,
            kind: edge.kind,
            weight: edge.weight ?? undefined,
          }));

  return {
    nodes,
    edges,
    meta: {
      resource,
      extractedEntities: extractedEntityLabels.size,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
  };
}
