/**
 * ALFRED Graph Memory Repository
 * Node and edge operations for knowledge graph
 */

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { isSqliteDriver } from "../client";
import { db } from "../index";
import { memoryEdges, memoryNodes } from "../schema/graph";

type NodeInsert = typeof memoryNodes.$inferInsert;
type NodeRow = typeof memoryNodes.$inferSelect;
type EdgeRow = typeof memoryEdges.$inferSelect;
type NodeSeed = {
  resource: string;
  hash: string;
  kind: string;
  label: string;
  properties?: unknown;
};
type EdgeSeed = {
  resource: string;
  hash: string;
  fromId: string;
  toId: string;
  kind: string;
  weight?: number;
  metadata?: unknown;
};

function sanitize<T extends Record<string, unknown>>(
  input: Partial<T>
): Partial<T> {
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
  kind?: string
) {
  return kind
    ? and(eq(field, nodeId), eq(memoryEdges.kind, kind))
    : eq(field, nodeId);
}

function uniqSeeds<T extends { resource: string; hash: string }>(
  seeds: T[]
): T[] {
  if (seeds.length === 0) {
    return seeds;
  }
  const seen = new Set<string>();
  const list: T[] = [];
  for (const seed of seeds) {
    const key = `${seed.resource}:${seed.hash}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    list.push(seed);
  }
  return list;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeNode(row: NodeRow): NodeRow {
  const props = parseJsonRecord(row.properties);
  return props === row.properties ? row : { ...row, properties: props };
}

function normalizeEdge(row: EdgeRow): EdgeRow {
  const metadata = parseJsonRecord(row.metadata);
  return metadata === row.metadata ? row : { ...row, metadata };
}

const numberFromProps = (
  props: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number
): number => {
  if (!props) {
    return fallback;
  }
  const value = props[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const stringFromProps = (
  props: Record<string, unknown> | null | undefined,
  key: string
): string | null => {
  if (!props) {
    return null;
  }
  const value = props[key];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return null;
};

export async function upsertNodes(
  seeds: NodeSeed[]
): Promise<Map<string, NodeRow>> {
  const deduped = uniqSeeds(seeds);
  if (deduped.length === 0) {
    return new Map();
  }

  const rows = await db
    .insert(memoryNodes)
    .values(
      deduped.map((seed) => ({
        resource: seed.resource,
        hash: seed.hash,
        kind: seed.kind,
        label: seed.label,
        properties: seed.properties ?? null,
      }))
    )
    .onConflictDoUpdate({
      target: [memoryNodes.resource, memoryNodes.hash],
      set: {
        label: sql`excluded.label`,
        properties: sql`excluded.properties`,
        updated: sql`NOW()`,
      },
    })
    .returning();

  const map = new Map<string, NodeRow>();
  for (const row of rows) {
    map.set(`${row.resource}:${row.hash}`, row);
  }

  if (rows.length !== deduped.length) {
    const filters = deduped.map((seed) =>
      and(
        eq(memoryNodes.resource, seed.resource),
        eq(memoryNodes.hash, seed.hash)
      )
    );
    const fetched = await db
      .select()
      .from(memoryNodes)
      .where(filters.length === 1 ? filters[0] : or(...filters));
    for (const row of fetched) {
      const key = `${row.resource}:${row.hash}`;
      if (!map.has(key)) {
        map.set(key, row);
      }
    }
  }

  return map;
}

export async function upsertEdges(seeds: EdgeSeed[]): Promise<EdgeRow[]> {
  const deduped = uniqSeeds(seeds);
  if (deduped.length === 0) {
    return [];
  }

  return db
    .insert(memoryEdges)
    .values(
      deduped.map((seed) => ({
        resource: seed.resource,
        hash: seed.hash,
        fromId: seed.fromId,
        toId: seed.toId,
        kind: seed.kind,
        weight: seed.weight ?? 1,
        metadata: seed.metadata ?? null,
      }))
    )
    .onConflictDoUpdate({
      target: [memoryEdges.resource, memoryEdges.hash],
      set: {
        fromId: sql`excluded.from_id`,
        toId: sql`excluded.to_id`,
        kind: sql`excluded.kind`,
        weight: sql`excluded.weight`,
        metadata: sql`excluded.metadata`,
      },
    })
    .returning();
}

// Node operations
export async function createNode(
  resource: string,
  hash: string,
  kind: string,
  label: string,
  properties?: unknown
): Promise<NodeRow> {
  const [row] = await db
    .insert(memoryNodes)
    .values({
      resource,
      hash,
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
  updates: Partial<NodeInsert>
): Promise<NodeRow | null> {
  const payload = sanitize<NodeInsert>(updates);
  if (Object.keys(payload).length === 0) {
    return getNode(nodeId);
  }

  (payload as Partial<NodeInsert> & { updated?: Date }).updated =
    sql`NOW()` as unknown as Date;

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
  offset = 0
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
  resource: string,
  hash: string,
  fromId: string,
  toId: string,
  kind: string,
  weight = 1.0,
  metadata?: unknown
): Promise<EdgeRow> {
  const [row] = await db
    .insert(memoryEdges)
    .values({
      resource,
      hash,
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

export async function getOutboundEdges(
  nodeId: string,
  kind?: string
): Promise<EdgeRow[]> {
  return db
    .select()
    .from(memoryEdges)
    .where(buildEdgeWhere(memoryEdges.fromId, nodeId, kind))
    .orderBy(desc(memoryEdges.created));
}

export async function getInboundEdges(
  nodeId: string,
  kind?: string
): Promise<EdgeRow[]> {
  return db
    .select()
    .from(memoryEdges)
    .where(buildEdgeWhere(memoryEdges.toId, nodeId, kind))
    .orderBy(desc(memoryEdges.created));
}

// Graph traversal helpers
export async function getNeighbors(
  nodeId: string,
  options?: {
    resource?: string;
    direction?: "out" | "in" | "both";
    kind?: string;
    limit?: number;
  }
): Promise<Array<{ edge: EdgeRow; otherNodeId: string }>> {
  const direction = options?.direction ?? "both";
  const kind = options?.kind;
  const resource = options?.resource;
  const limit = options?.limit ?? 100;

  const edges: EdgeRow[] = [];

  const loadEdges = async (
    column: typeof memoryEdges.fromId | typeof memoryEdges.toId,
    value: string
  ) => {
    const predicates = [eq(column, value)];
    if (kind) {
      predicates.push(eq(memoryEdges.kind, kind));
    }
    if (resource) {
      predicates.push(eq(memoryEdges.resource, resource));
    }

    const rows = await db
      .select()
      .from(memoryEdges)
      .where(and(...predicates))
      .orderBy(desc(memoryEdges.created))
      .limit(limit);

    edges.push(...rows);
  };

  if (direction === "out" || direction === "both") {
    await loadEdges(memoryEdges.fromId, nodeId);
  }
  if (direction === "in" || direction === "both") {
    await loadEdges(memoryEdges.toId, nodeId);
  }

  const seen = new Set<string>();
  const results: Array<{ edge: EdgeRow; otherNodeId: string }> = [];
  for (const edge of edges) {
    if (seen.has(edge.id)) {
      continue;
    }
    seen.add(edge.id);
    const otherNodeId = edge.fromId === nodeId ? edge.toId : edge.fromId;
    results.push({ edge, otherNodeId });
    if (results.length >= limit) {
      break;
    }
  }

  return results;
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

export async function archiveNodes(
  nodeIds: string[],
  reason?: string
): Promise<number> {
  if (nodeIds.length === 0) {
    return 0;
  }

  const result = await db
    .update(memoryNodes)
    .set({
      properties: sql`
        CASE 
          WHEN properties IS NULL THEN jsonb_build_object('archived', NOW()::text, 'archiveReason', ${
            reason ?? "pruned"
          })
          ELSE properties || jsonb_build_object('archived', NOW()::text, 'archiveReason', ${
            reason ?? "pruned"
          })
        END
      `,
      updated: sql`NOW()`,
    })
    .where(inArray(memoryNodes.id, nodeIds))
    .returning({ id: memoryNodes.id });

  return result.length;
}

export async function deleteArchivedNodes(
  olderThanMs: number
): Promise<number> {
  const threshold = new Date(Date.now() - olderThanMs);

  const result = await db
    .delete(memoryNodes)
    .where(
      sql`
        properties->>'archived' IS NOT NULL 
        AND (properties->>'archived')::timestamp < ${threshold.toISOString()}::timestamp
      `
    )
    .returning({ id: memoryNodes.id });

  return result.length;
}

export async function updateNodeConfidence(
  nodeId: string,
  newConfidence: number
): Promise<NodeRow | null> {
  const clamped = Math.max(0, Math.min(1, newConfidence));

  const [row] = await db
    .update(memoryNodes)
    .set({
      properties: sql`
        CASE
          WHEN properties IS NULL THEN jsonb_build_object('confidence', ${clamped})
          ELSE jsonb_set(properties, '{confidence}', ${clamped}::text::jsonb)
        END
      `,
      updated: sql`NOW()`,
    })
    .where(eq(memoryNodes.id, nodeId))
    .returning();

  return row ?? null;
}

export async function updateNodeConfidenceBatch(
  updates: Array<{ id: string; confidence: number }>
): Promise<number> {
  if (updates.length === 0) {
    return 0;
  }

  let count = 0;
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    for (const update of batch) {
      const result = await updateNodeConfidence(update.id, update.confidence);
      if (result) {
        count++;
      }
    }
  }

  return count;
}

export async function deleteNodesBatch(nodeIds: string[]): Promise<number> {
  if (nodeIds.length === 0) {
    return 0;
  }

  let totalDeleted = 0;
  for (let i = 0; i < nodeIds.length; i += 500) {
    const chunk = nodeIds.slice(i, i + 500);
    const result = await db
      .delete(memoryNodes)
      .where(inArray(memoryNodes.id, chunk))
      .returning({ id: memoryNodes.id });
    totalDeleted += result.length;
  }

  return totalDeleted;
}

export async function findNodesByConfidence(
  minConfidence: number,
  maxConfidence: number,
  kind?: string,
  limit = 1000
): Promise<NodeRow[]> {
  const query = db
    .select()
    .from(memoryNodes)
    .where(
      and(
        sql`
          CASE
            WHEN properties ? 'confidence' 
            THEN (properties->>'confidence')::numeric BETWEEN ${minConfidence} AND ${maxConfidence}
            ELSE true
          END
        `,
        kind ? eq(memoryNodes.kind, kind) : sql`true`
      )
    )
    .orderBy(desc(memoryNodes.created))
    .limit(limit);

  return query;
}

export async function findStaleNodes(
  olderThanMs: number,
  kind?: string,
  limit = 1000
): Promise<NodeRow[]> {
  const threshold = new Date(Date.now() - olderThanMs);

  return db
    .select()
    .from(memoryNodes)
    .where(
      and(
        sql`created < ${threshold.toISOString()}::timestamp`,
        kind ? eq(memoryNodes.kind, kind) : sql`true`,
        sql`properties->>'archived' IS NULL`
      )
    )
    .orderBy(desc(memoryNodes.created))
    .limit(limit);
}

export async function findRagDocumentNode(
  documentId: string
): Promise<NodeRow | null> {
  const rows = await db
    .select()
    .from(memoryNodes)
    .where(
      and(
        eq(memoryNodes.kind, "rag_document"),
        sql`COALESCE(properties->>'documentId', '') = ${documentId}`
      )
    )
    .limit(1);

  return rows[0] ?? null;
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
