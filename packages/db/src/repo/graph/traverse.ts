import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, isSqliteDriver } from "../../client";
import { memoryEdges, memoryNodes } from "../../schema/graph";
import type { EdgeRow, NodeRow } from "./types";
import {
  normalizeEdge,
  normalizeNode,
  numberFromProps,
  stringFromProps,
} from "./utils";

// Graph Algorithm: Find Nearest Concept (BFS)
// Optimized to run in SQL for performance
export async function findNearestConcept(
  startNodeLabel: string | undefined,
  targetConcepts: string[],
  maxDepth = 3,
  resource?: string,
  embedding?: number[],
  matchThreshold = 0.5 // Cosine distance threshold (lower is better)
): Promise<{ concept: string; path: string[]; node: NodeRow } | null> {
  // Normalize concepts to lower case for matching
  const targets = targetConcepts.map((c) => c.toLowerCase());
  const start = startNodeLabel || ""; // Handle undefined startNodeLabel

  const startNodeSelection = embedding
    ? sql`
      SELECT id, 0 as depth, ARRAY[id] as path
      FROM memory_nodes
      WHERE embedding IS NOT NULL
        ${resource ? sql`AND resource = ${resource}` : sql``}
        AND embedding <=> ${sql.raw(`ARRAY[${embedding.join(",")}]::vector`)} < ${matchThreshold}
      ORDER BY embedding <=> ${sql.raw(
        `ARRAY[${embedding.join(",")}]::vector`
      )} ASC
      LIMIT 1
    `
    : sql`
      SELECT id, 0, ARRAY[id] as path
      FROM memory_nodes
      WHERE (
          label = ${start}
          OR (LENGTH(${start}) > 3 AND label ILIKE ${"%" + start + "%"})
          OR (LENGTH(${start}) > 3 AND ${start} ILIKE '%' || label || '%')
        )
        ${resource ? sql`AND resource = ${resource}` : sql``}
      LIMIT 1
    `;

  // We use a recursive CTE to traverse the graph
  // We match nodes by label (this assumes entity resolution happened during ingestion)
  const query = sql<{
    concept: string;
    depth: number;
    path: string[];
    node: NodeRow;
  }>`
    WITH RECURSIVE traversal (node_id, depth, path) AS (
      -- Base case: find the start node by label (Exact Match OR Substring Match if length > 3)
      (${startNodeSelection})
      
      UNION ALL
      
      -- Recursive step: traverse edges
      SELECT
        CASE
          WHEN e.from_id = traversal.node_id THEN e.to_id
          ELSE e.from_id
        END,
        traversal.depth + 1,
        traversal.path || CASE
          WHEN e.from_id = traversal.node_id THEN e.to_id
          ELSE e.from_id
        END
      FROM memory_edges e
      JOIN traversal ON (e.from_id = traversal.node_id OR e.to_id = traversal.node_id)
      WHERE traversal.depth < ${maxDepth}
        ${resource ? sql`AND e.resource = ${resource}` : sql``}
        AND NOT (
          CASE
            WHEN e.from_id = traversal.node_id THEN e.to_id
            ELSE e.from_id
          END = ANY(traversal.path)
        )
    )
    SELECT mn.*, t.depth, t.path
    FROM traversal t
    JOIN memory_nodes mn ON mn.id = t.node_id
    WHERE LOWER(mn.label) = ANY(ARRAY[${sql.join(
      targets.map((t) => t),
      sql`, `
    )}])
    -- Exclude the start node itself if it matches the target concept (unless depth > 0)
    AND (t.depth > 0 OR LOWER(mn.label) != LOWER(${start}))
    ORDER BY t.depth ASC, mn.created_at ASC
    LIMIT 1;
  `;

  const result = await db.execute(query);
  const row = result.rows?.[0] as
    | (NodeRow & { depth: number; path: string[] })
    | undefined;

  return row ? { node: row, concept: row.label, path: row.path } : null;
}

export async function findPath(
  fromId: string,
  toId: string,
  maxDepth = 5,
  resource?: string
): Promise<{ nodeId: string; via: string[] }[]> {
  if (fromId === toId) {
    return [{ nodeId: fromId, via: [] }];
  }

  // Recursive CTE for path finding - using raw SQL as Drizzle doesn't support recursive CTEs well
  const resourceNode = resource ? sql`AND resource = ${resource}` : sql``;
  const resourceEdge = resource ? sql`AND e.resource = ${resource}` : sql``;
  const query = sql<{
    node_path: string[];
    edge_path: string[];
  }>`
    WITH RECURSIVE traversal (node_id, node_path, edge_path, depth) AS (
      SELECT
        id,
        ARRAY[id] AS node_path,
        ARRAY[]::uuid[] AS edge_path,
        0 AS depth
      FROM memory_nodes
      WHERE id = ${fromId}::uuid
        ${resourceNode}
      UNION ALL
      SELECT
        e.to_id,
        traversal.node_path || e.to_id,
        traversal.edge_path || e.id,
        traversal.depth + 1
      FROM memory_edges e
      JOIN traversal ON traversal.node_id = e.from_id
      WHERE traversal.depth < ${maxDepth}
        ${resourceEdge}
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

export async function getSubgraph(
  nodeIds: string[],
  resource?: string
): Promise<{
  nodes: NodeRow[];
  edges: EdgeRow[];
}> {
  if (nodeIds.length === 0) {
    return { nodes: [], edges: [] };
  }

  const uniqueIds = Array.from(new Set(nodeIds));

  const nodePredicates = [inArray(memoryNodes.id, uniqueIds)];
  if (resource) {
    nodePredicates.push(eq(memoryNodes.resource, resource));
  }

  const nodes = await db
    .select()
    .from(memoryNodes)
    .where(and(...nodePredicates));

  const edgePredicates = [
    or(
      inArray(memoryEdges.fromId, uniqueIds),
      inArray(memoryEdges.toId, uniqueIds)
    ),
  ];
  if (resource) {
    edgePredicates.push(eq(memoryEdges.resource, resource));
  }

  const edges = await db
    .select()
    .from(memoryEdges)
    .where(and(...edgePredicates))
    .orderBy(desc(memoryEdges.created));

  return { nodes, edges };
}

export async function getReasoningChain(args: {
  resource: string;
  executionId?: string | null;
  since?: number;
  limit?: number;
}): Promise<{
  nodes: NodeRow[];
  edges: EdgeRow[];
}> {
  const limit = Math.min(Math.max(args.limit ?? 200, 1), 2000);
  if (isSqliteDriver()) {
    const rawNodes = await db
      .select()
      .from(memoryNodes)
      .where(
        and(
          eq(memoryNodes.resource, args.resource),
          eq(memoryNodes.kind, "reasoning")
        )
      )
      .orderBy(memoryNodes.created)
      .limit(Math.max(limit * 4, limit));

    const normalizedNodes = rawNodes.map(normalizeNode);

    const filteredNodes = normalizedNodes
      .filter((node) => {
        if (!args.executionId) {
          return true;
        }
        return (
          stringFromProps(
            node.properties as Record<string, unknown>,
            "executionId"
          ) === args.executionId
        );
      })
      .filter((node) => {
        if (typeof args.since !== "number" || !Number.isFinite(args.since)) {
          return true;
        }
        const ts = numberFromProps(
          node.properties as Record<string, unknown>,
          "timestamp",
          Number.NEGATIVE_INFINITY
        );
        return ts >= (args.since ?? Number.NEGATIVE_INFINITY);
      })
      .sort((a, b) => {
        const aIndex = numberFromProps(
          a.properties as Record<string, unknown>,
          "sequenceIndex",
          Number.MAX_SAFE_INTEGER
        );
        const bIndex = numberFromProps(
          b.properties as Record<string, unknown>,
          "sequenceIndex",
          Number.MAX_SAFE_INTEGER
        );
        if (aIndex !== bIndex) {
          return aIndex - bIndex;
        }
        const aTs = numberFromProps(
          a.properties as Record<string, unknown>,
          "timestamp",
          Number.MAX_SAFE_INTEGER
        );
        const bTs = numberFromProps(
          b.properties as Record<string, unknown>,
          "timestamp",
          Number.MAX_SAFE_INTEGER
        );
        return aTs - bTs;
      })
      .slice(0, limit);

    const nodeIds = filteredNodes.map((node) => node.id);
    if (nodeIds.length === 0) {
      return { nodes: filteredNodes, edges: [] };
    }

    const rawEdges = await db
      .select()
      .from(memoryEdges)
      .where(
        and(
          inArray(memoryEdges.fromId, nodeIds),
          eq(memoryEdges.kind, "precedes")
        )
      );

    const normalizedEdges = rawEdges.map(normalizeEdge).sort((a, b) => {
      const aIndex = numberFromProps(
        a.metadata as Record<string, unknown>,
        "fromIndex",
        0
      );
      const bIndex = numberFromProps(
        b.metadata as Record<string, unknown>,
        "fromIndex",
        0
      );
      return aIndex - bIndex;
    });

    return { nodes: filteredNodes, edges: normalizedEdges };
  }

  const conditions = [
    eq(memoryNodes.resource, args.resource),
    eq(memoryNodes.kind, "reasoning"),
  ];

  if (args.executionId) {
    conditions.push(
      sql`COALESCE(properties->>'executionId', '') = ${args.executionId}`
    );
  }

  if (typeof args.since === "number" && Number.isFinite(args.since)) {
    conditions.push(
      sql`COALESCE((properties->>'timestamp')::numeric, 0) >= ${args.since}`
    );
  }

  const nodes = await db
    .select()
    .from(memoryNodes)
    .where(and(...conditions))
    .orderBy(
      sql`COALESCE((properties->>'sequenceIndex')::int, (properties->>'index')::int, 0),
          COALESCE((properties->>'timestamp')::numeric, 0)`
    )
    .limit(limit);

  const normalizedNodes = nodes.map(normalizeNode);

  const nodeIds = normalizedNodes.map((node) => node.id);

  if (nodeIds.length === 0) {
    return { nodes: normalizedNodes, edges: [] };
  }

  const edges = await db
    .select()
    .from(memoryEdges)
    .where(
      and(
        inArray(memoryEdges.fromId, nodeIds),
        eq(memoryEdges.kind, "precedes")
      )
    )
    .orderBy(sql`COALESCE((metadata->>'fromIndex')::int, 0)`);

  const normalizedEdges = edges.map(normalizeEdge);

  return { nodes: normalizedNodes, edges: normalizedEdges };
}
