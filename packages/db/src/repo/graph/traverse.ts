import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, isSqliteDriver } from "../../client";
import { memoryEdges, memoryNodes } from "../../schema/graph";
import { DEFAULT_MIN_SCORE, DEFAULT_TOP_K } from "./scoring";
import type { EdgeRow, NodeRow } from "./types";
import {
  normalizeEdge,
  normalizeNode,
  numberFromProps,
  stringFromProps,
} from "./utils";

/**
 * Options for findNearestConcept with top-K retrieval
 */
export type FindConceptOptions = {
  /** Maximum BFS depth (default: 3) */
  maxDepth?: number;
  /** Resource scope filter */
  resource?: string;
  /** Query embedding for semantic matching */
  embedding?: number[];
  /** Number of candidates to retrieve (default: 20) */
  topK?: number;
  /** Minimum score for final results (default: 0.3) */
  minScore?: number;
  /**
   * @deprecated Use topK and minScore instead
   * Legacy threshold for backwards compatibility
   */
  matchThreshold?: number;
};

// Graph Algorithm: Find Nearest Concept (BFS)
// Optimized to run in SQL for performance
// Now uses top-K retrieval instead of static threshold
export async function findNearestConcept(
  startNodeLabel: string | undefined,
  targetConcepts: string[],
  maxDepth = 3,
  resource?: string,
  embedding?: number[],
  matchThresholdOrOptions: number | FindConceptOptions = {}
): Promise<{ concept: string; path: string[]; node: NodeRow } | null> {
  // Handle backwards compatibility
  const options: FindConceptOptions =
    typeof matchThresholdOrOptions === "number"
      ? {
          maxDepth,
          resource,
          embedding,
          // Convert legacy threshold to top-K parameters
          topK: DEFAULT_TOP_K,
          minScore: Math.max(DEFAULT_MIN_SCORE, 1 - matchThresholdOrOptions),
          matchThreshold: matchThresholdOrOptions,
        }
      : {
          maxDepth: matchThresholdOrOptions.maxDepth ?? maxDepth,
          resource: matchThresholdOrOptions.resource ?? resource,
          embedding: matchThresholdOrOptions.embedding ?? embedding,
          topK: matchThresholdOrOptions.topK ?? DEFAULT_TOP_K,
          minScore: matchThresholdOrOptions.minScore ?? DEFAULT_MIN_SCORE,
          matchThreshold: matchThresholdOrOptions.matchThreshold,
        };

  // Use legacy threshold if explicitly provided, otherwise use top-K approach
  const useTopK = options.matchThreshold === undefined;
  const effectiveThreshold = useTopK
    ? 1 - (options.minScore ?? DEFAULT_MIN_SCORE)
    : (options.matchThreshold ?? 0.5);

  const effectiveMaxDepth = options.maxDepth ?? maxDepth;
  const effectiveResource = options.resource ?? resource;
  const effectiveEmbedding = options.embedding ?? embedding;
  const effectiveTopK = options.topK ?? DEFAULT_TOP_K;

  if (isSqliteDriver()) {
    return findNearestConceptSqlite({
      startNodeLabel,
      targetConcepts,
      maxDepth: effectiveMaxDepth,
      resource: effectiveResource,
      embedding: effectiveEmbedding,
      matchThreshold: effectiveThreshold,
      topK: effectiveTopK,
    });
  }

  // Normalize concepts to lower case for matching
  const targets = targetConcepts.map((c) => c.toLowerCase());
  const start = startNodeLabel || ""; // Handle undefined startNodeLabel

  // Use top-K retrieval: get more candidates, then filter
  const candidateLimit = useTopK ? effectiveTopK : 1;

  const startNodeSelection = effectiveEmbedding
    ? sql`
      SELECT id, 0 as depth, ARRAY[id] as path,
             embedding <=> ${sql.raw(`ARRAY[${effectiveEmbedding.join(",")}]::vector`)} as distance
      FROM memory_nodes
      WHERE embedding IS NOT NULL
        ${effectiveResource ? sql`AND resource = ${effectiveResource}` : sql``}
        AND embedding <=> ${sql.raw(`ARRAY[${effectiveEmbedding.join(",")}]::vector`)} < ${effectiveThreshold}
      ORDER BY embedding <=> ${sql.raw(
        `ARRAY[${effectiveEmbedding.join(",")}]::vector`
      )} ASC
      LIMIT ${candidateLimit}
    `
    : sql`
      SELECT id, 0, ARRAY[id] as path, 0::float as distance
      FROM memory_nodes
      WHERE (
          label = ${start}
          OR (LENGTH(${start}) > 3 AND label ILIKE ${`%${start}%`})
          OR (LENGTH(${start}) > 3 AND ${start} ILIKE '%' || label || '%')
        )
        ${effectiveResource ? sql`AND resource = ${effectiveResource}` : sql``}
      LIMIT ${candidateLimit}
    `;

  // We use a recursive CTE to traverse the graph
  // We match nodes by label (this assumes entity resolution happened during ingestion)
  const query = sql<{
    concept: string;
    depth: number;
    path: string[];
    node: NodeRow;
  }>`
    WITH RECURSIVE traversal (node_id, depth, path, distance) AS (
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
        END,
        traversal.distance
      FROM memory_edges e
      JOIN traversal ON (e.from_id = traversal.node_id OR e.to_id = traversal.node_id)
      WHERE traversal.depth < ${effectiveMaxDepth}
        ${effectiveResource ? sql`AND e.resource = ${effectiveResource}` : sql``}
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

type SqliteTraversalInput = {
  startNodeLabel?: string;
  targetConcepts: string[];
  maxDepth: number;
  resource?: string;
  embedding?: number[];
  matchThreshold: number;
  /** Number of candidates to retrieve (default: 20) */
  topK?: number;
};

async function findNearestConceptSqlite({
  startNodeLabel,
  targetConcepts,
  maxDepth,
  resource,
  embedding,
  matchThreshold,
}: SqliteTraversalInput): Promise<{
  concept: string;
  path: string[];
  node: NodeRow;
} | null> {
  const normalizedTargets = new Set(
    targetConcepts.map((concept) => concept.toLowerCase())
  );
  const context = await loadGraphContext(resource);
  const startNode = embedding
    ? selectStartNodeByEmbedding(context.nodes, embedding, matchThreshold)
    : selectStartNodeByLabel(context.nodes, startNodeLabel);

  if (!startNode) {
    return null;
  }

  const normalizedStart = (startNodeLabel ?? "").trim().toLowerCase();
  const queue: Array<{ node: NodeRow; path: string[]; depth: number }> = [
    { node: startNode, path: [startNode.id], depth: 0 },
  ];
  const visited = new Set<string>([startNode.id]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    const label = (current.node.label ?? "").toLowerCase();
    const isTarget = normalizedTargets.has(label);
    const isStartLabel =
      normalizedStart.length > 0 && label === normalizedStart;

    if (isTarget && (current.depth > 0 || !isStartLabel)) {
      return {
        concept: current.node.label,
        path: current.path,
        node: current.node,
      };
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    const neighbors = context.adjacency.get(current.node.id);
    if (!neighbors) {
      continue;
    }

    for (const neighborId of neighbors) {
      if (visited.has(neighborId)) {
        continue;
      }

      const neighbor = context.nodes.get(neighborId);
      if (!neighbor) {
        continue;
      }

      visited.add(neighborId);
      queue.push({
        node: neighbor,
        depth: current.depth + 1,
        path: [...current.path, neighborId],
      });
    }
  }

  return null;
}

async function loadGraphContext(resource?: string): Promise<{
  nodes: Map<string, NodeRow>;
  adjacency: Map<string, Set<string>>;
}> {
  const nodeQuery = resource
    ? db.select().from(memoryNodes).where(eq(memoryNodes.resource, resource))
    : db.select().from(memoryNodes);
  const nodes = await nodeQuery;
  const nodeMap = new Map<string, NodeRow>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const edgeQuery = resource
    ? db.select().from(memoryEdges).where(eq(memoryEdges.resource, resource))
    : db.select().from(memoryEdges);
  const edges = await edgeQuery;
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    addNeighbor(adjacency, edge.fromId, edge.toId);
    addNeighbor(adjacency, edge.toId, edge.fromId);
  }

  return { nodes: nodeMap, adjacency };
}

function addNeighbor(
  adjacency: Map<string, Set<string>>,
  source: string,
  target: string
): void {
  if (!(source && target)) {
    return;
  }
  const neighbors = adjacency.get(source);
  if (neighbors) {
    neighbors.add(target);
    return;
  }
  adjacency.set(source, new Set([target]));
}

function selectStartNodeByLabel(
  nodes: Map<string, NodeRow>,
  label?: string
): NodeRow | null {
  if (!label) {
    return null;
  }

  const normalized = label.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const node of nodes.values()) {
    if ((node.label ?? "").toLowerCase() === normalized) {
      return node;
    }
  }

  if (normalized.length <= 3) {
    return null;
  }

  for (const node of nodes.values()) {
    const candidate = (node.label ?? "").toLowerCase();
    if (candidate.includes(normalized)) {
      return node;
    }
    if (normalized.includes(candidate) && candidate.length > 0) {
      return node;
    }
  }

  return null;
}

function selectStartNodeByEmbedding(
  nodes: Map<string, NodeRow>,
  embedding: number[] | undefined,
  matchThreshold: number
): NodeRow | null {
  if (!embedding || embedding.length === 0) {
    return null;
  }

  let best: { node: NodeRow; distance: number } | null = null;
  for (const node of nodes.values()) {
    const candidateEmbedding = normalizeEmbedding(node.embedding);
    if (!candidateEmbedding) {
      continue;
    }
    const distance = cosineDistance(embedding, candidateEmbedding);
    if (!Number.isFinite(distance)) {
      continue;
    }
    if (!best || distance < best.distance) {
      best = { node, distance };
    }
  }

  if (!best || best.distance >= matchThreshold) {
    return null;
  }

  return best.node;
}

function normalizeEmbedding(value: unknown): number[] | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    const nums = value
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry));
    return nums.length > 0 ? nums : null;
  }

  if (value instanceof Uint8Array) {
    if (value.byteLength % 4 !== 0) {
      return null;
    }
    const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
    const result: number[] = [];
    for (let offset = 0; offset < view.byteLength; offset += 4) {
      result.push(view.getFloat32(offset, true));
    }
    return result.length > 0 ? result : null;
  }

  if (value instanceof ArrayBuffer) {
    const arr = Array.from(new Float32Array(value));
    return arr.length > 0 ? arr : null;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const nums = parsed
          .map((entry) => Number(entry))
          .filter((entry) => Number.isFinite(entry));
        return nums.length > 0 ? nums : null;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function cosineDistance(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i++) {
    const av = a[i];
    const bv = b[i];
    if (av !== undefined && bv !== undefined) {
      dot += av * bv;
      normA += av * av;
      normB += bv * bv;
    }
  }

  if (normA === 0 || normB === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return 1 - similarity;
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

  // biome-ignore lint/suspicious/noExplicitAny: Internal PG driver row structure
  const nodePath = Array.isArray((row as any).node_path)
    ? // biome-ignore lint/suspicious/noExplicitAny: Internal PG driver row structure
      ((row as any).node_path as string[])
    : [];
  // biome-ignore lint/suspicious/noExplicitAny: Internal PG driver row structure
  const edgePath = Array.isArray((row as any).edge_path)
    ? // biome-ignore lint/suspicious/noExplicitAny: Internal PG driver row structure
      ((row as any).edge_path as string[])
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

/**
 * Get all nodes reachable from a starting node via edges of a specific kind.
 * Returns the transitive closure of dependencies.
 */
export async function getTransitiveClosure(
  nodeId: string,
  kind: string,
  maxDepth = 10,
  resource?: string
): Promise<string[]> {
  if (isSqliteDriver()) {
    return getTransitiveClosureSqlite(nodeId, kind, maxDepth, resource);
  }

  const resourceFilter = resource ? sql`AND e.resource = ${resource}` : sql``;
  const kindFilter = sql`AND e.kind = ${kind}`;

  const query = sql<{ node_id: string }>`
    WITH RECURSIVE closure (node_id, depth) AS (
      SELECT ${nodeId}::uuid AS node_id, 0 AS depth
      
      UNION ALL
      
      SELECT e.to_id, closure.depth + 1
      FROM memory_edges e
      JOIN closure ON closure.node_id = e.from_id
      WHERE closure.depth < ${maxDepth}
        ${kindFilter}
        ${resourceFilter}
    )
    SELECT DISTINCT node_id
    FROM closure
    WHERE node_id != ${nodeId}::uuid
  `;

  const result = await db.execute(query);
  return (result.rows ?? []).map((row) =>
    String((row as { node_id: string }).node_id)
  );
}

async function getTransitiveClosureSqlite(
  nodeId: string,
  kind: string,
  maxDepth: number,
  resource?: string
): Promise<string[]> {
  // Load edges filtered by kind (matching Postgres behavior)
  const edgeQuery = resource
    ? db
        .select()
        .from(memoryEdges)
        .where(
          and(eq(memoryEdges.kind, kind), eq(memoryEdges.resource, resource))
        )
    : db.select().from(memoryEdges).where(eq(memoryEdges.kind, kind));
  const edges = await edgeQuery;

  // Build adjacency map only for edges of the specified kind
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    addNeighbor(adjacency, edge.fromId, edge.toId);
  }

  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [
    { id: nodeId, depth: 0 },
  ];

  visited.add(nodeId);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) {
      continue;
    }

    const neighbors = adjacency.get(current.id);
    if (!neighbors) {
      continue;
    }

    for (const neighborId of neighbors) {
      if (visited.has(neighborId)) {
        continue;
      }

      visited.add(neighborId);
      queue.push({ id: neighborId, depth: current.depth + 1 });
    }
  }

  visited.delete(nodeId);
  return Array.from(visited);
}
