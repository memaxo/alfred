/**
 * ALFRED Graph Memory Repository
 * Node and edge operations for knowledge graph
 */

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../index";
import { memoryNodes, memoryEdges } from "../schema/graph";

type NodeInsert = typeof memoryNodes.$inferInsert;
type NodeRow = typeof memoryNodes.$inferSelect;
type EdgeRow = typeof memoryEdges.$inferSelect;

function sanitize<T extends Record<string, unknown>>(input: Partial<T>): Partial<T> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return next as Partial<T>;
}

function buildEdgeWhere(
  field: typeof memoryEdges.fromId | typeof memoryEdges.toId,
  nodeId: string,
  kind?: string,
) {
  return kind ? and(eq(field, nodeId), eq(memoryEdges.kind, kind)) : eq(field, nodeId);
}

// Node operations
export async function createNode(
  kind: string,
  label: string,
  properties?: unknown,
): Promise<NodeRow> {
  const [row] = await db
    .insert(memoryNodes)
    .values({
      kind,
      label,
      properties: properties ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create graph node");
  }

  return row;
}

export async function getNode(nodeId: string): Promise<NodeRow | null> {
  const [row] = await db
    .select()
    .from(memoryNodes)
    .where(eq(memoryNodes.id, nodeId))
    .limit(1);

  return row ?? null;
}

export async function updateNode(
  nodeId: string,
  updates: Partial<NodeInsert>,
): Promise<NodeRow | null> {
  const payload = sanitize<NodeInsert>(updates);
  if (Object.keys(payload).length === 0) {
    return getNode(nodeId);
  }

  (payload as Partial<NodeInsert> & { updated?: Date }).updated = sql`NOW()` as unknown as Date;

  const [row] = await db
    .update(memoryNodes)
    .set(payload)
    .where(eq(memoryNodes.id, nodeId))
    .returning();

  return row ?? null;
}

export async function deleteNode(nodeId: string): Promise<number> {
  const rows = await db
    .delete(memoryNodes)
    .where(eq(memoryNodes.id, nodeId))
    .returning({ id: memoryNodes.id });

  return rows.length;
}

export async function findNodesByKind(
  kind: string,
  limit = 100,
  offset = 0,
): Promise<NodeRow[]> {
  return db
    .select()
    .from(memoryNodes)
    .where(eq(memoryNodes.kind, kind))
    .orderBy(desc(memoryNodes.created))
    .limit(limit)
    .offset(offset);
}

// Edge operations
export async function createEdge(
  fromId: string,
  toId: string,
  kind: string,
  weight = 1.0,
  metadata?: unknown,
): Promise<EdgeRow> {
  const [row] = await db
    .insert(memoryEdges)
    .values({
      fromId,
      toId,
      kind,
      weight,
      metadata: metadata ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create graph edge");
  }

  return row;
}

export async function getEdge(edgeId: string): Promise<EdgeRow | null> {
  const [row] = await db
    .select()
    .from(memoryEdges)
    .where(eq(memoryEdges.id, edgeId))
    .limit(1);

  return row ?? null;
}

export async function deleteEdge(edgeId: string): Promise<number> {
  const rows = await db
    .delete(memoryEdges)
    .where(eq(memoryEdges.id, edgeId))
    .returning({ id: memoryEdges.id });

  return rows.length;
}

export async function getOutboundEdges(nodeId: string, kind?: string): Promise<EdgeRow[]> {
  return db
    .select()
    .from(memoryEdges)
    .where(buildEdgeWhere(memoryEdges.fromId, nodeId, kind))
    .orderBy(desc(memoryEdges.created));
}

export async function getInboundEdges(nodeId: string, kind?: string): Promise<EdgeRow[]> {
  return db
    .select()
    .from(memoryEdges)
    .where(buildEdgeWhere(memoryEdges.toId, nodeId, kind))
    .orderBy(desc(memoryEdges.created));
}

// Graph traversal helpers
export async function getNeighbors(
  nodeId: string,
  direction: "out" | "in" | "both" = "both",
  kind?: string,
): Promise<NodeRow[]> {
  const ids = new Set<string>();

  if (direction === "out" || direction === "both") {
    const edges = await getOutboundEdges(nodeId, kind);
    for (const edge of edges) {
      ids.add(edge.toId);
    }
  }

  if (direction === "in" || direction === "both") {
    const edges = await getInboundEdges(nodeId, kind);
    for (const edge of edges) {
      ids.add(edge.fromId);
    }
  }

  if (ids.size === 0) {
    return [];
  }

  return db
    .select()
    .from(memoryNodes)
    .where(inArray(memoryNodes.id, Array.from(ids)))
    .orderBy(desc(memoryNodes.created));
}

export async function findPath(
  fromId: string,
  toId: string,
  maxDepth = 5,
): Promise<{ nodeId: string; via: string[] }[]> {
  if (fromId === toId) {
    return [{ nodeId: fromId, via: [] }];
  }

  const query = sql<
    {
      node_path: string[];
      edge_path: string[];
    }
  >`
    WITH RECURSIVE traversal (node_id, node_path, edge_path, depth) AS (
      SELECT
        id,
        ARRAY[id] AS node_path,
        ARRAY[]::uuid[] AS edge_path,
        0 AS depth
      FROM memory_nodes
      WHERE id = ${fromId}::uuid
      UNION ALL
      SELECT
        e.to_id,
        traversal.node_path || e.to_id,
        traversal.edge_path || e.id,
        traversal.depth + 1
      FROM memory_edges e
      JOIN traversal ON traversal.node_id = e.from_id
      WHERE traversal.depth < ${maxDepth}
        AND NOT (e.to_id = ANY(traversal.node_path))
    )
    SELECT node_path, edge_path
    FROM traversal
    WHERE node_id = ${toId}::uuid
    ORDER BY array_length(edge_path, 1) ASC
    LIMIT 1;
  `;

  const result = await db.execute(query);
  const row = result.rows?.[0];
  if (!row) {
    return [];
  }

  const nodePath = Array.isArray((row as any).node_path)
    ? ((row as any).node_path as string[])
    : [];
  const edgePath = Array.isArray((row as any).edge_path)
    ? ((row as any).edge_path as string[])
    : [];

  if (nodePath.length === 0) {
    return [];
  }

  return nodePath.map((nodeId, idx) => ({
    nodeId,
    via: edgePath.slice(0, idx),
  }));
}

export async function getSubgraph(nodeIds: string[]): Promise<{
  nodes: NodeRow[];
  edges: EdgeRow[];
}> {
  if (nodeIds.length === 0) {
    return { nodes: [], edges: [] };
  }

  const uniqueIds = Array.from(new Set(nodeIds));

  const nodes = await db
    .select()
    .from(memoryNodes)
    .where(inArray(memoryNodes.id, uniqueIds));

  const edges = await db
    .select()
    .from(memoryEdges)
    .where(
      or(
        inArray(memoryEdges.fromId, uniqueIds),
        inArray(memoryEdges.toId, uniqueIds),
      ),
    )
    .orderBy(desc(memoryEdges.created));

  return { nodes, edges };
}
