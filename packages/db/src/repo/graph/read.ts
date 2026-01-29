import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { EdgeRow, NodeRow } from "./types";

import { db } from "../../client";
import { measureGraphQuery } from "../../metrics";
import { memoryEdges, memoryNodes } from "../../schema/graph";
import { buildEdgeWhere } from "./utils";

/**
 * Record access to a node, incrementing access_count and updating last_accessed_at.
 * Used for adaptive decay: effective_half_life = base_half_life × (1 + log(1 + access_count))
 *
 * @param nodeId - ID of the node being accessed
 * @returns The updated node or null if not found
 */
export async function recordAccess(nodeId: string): Promise<NodeRow | null> {
  return await measureGraphQuery("recordAccess", async () => {
    const [row] = await db
      .update(memoryNodes)
      .set({
        accessCount: sql`${memoryNodes.accessCount} + 1`,
        lastAccessedAt: new Date(),
      })
      .where(eq(memoryNodes.id, nodeId))
      .returning();

    return row ?? null;
  });
}

/**
 * Record access to multiple nodes in a single batch operation.
 * More efficient for recording access to many nodes at once.
 *
 * @param nodeIds - Array of node IDs being accessed
 * @returns Number of nodes updated
 */
export async function recordAccessBatch(nodeIds: string[]): Promise<number> {
  if (nodeIds.length === 0) {
    return 0;
  }

  return await measureGraphQuery("recordAccessBatch", async () => {
    const result = await db
      .update(memoryNodes)
      .set({
        accessCount: sql`${memoryNodes.accessCount} + 1`,
        lastAccessedAt: new Date(),
      })
      .where(inArray(memoryNodes.id, nodeIds));

    return result.rowCount ?? 0;
  });
}

/**
 * Find cold nodes (rarely accessed) that are candidates for more aggressive decay.
 * Cold nodes have low access counts and haven't been accessed recently.
 *
 * @param accessThreshold - Maximum access_count to consider "cold" (default: 5)
 * @param daysUnaccessed - Minimum days since last access (default: 30)
 * @param limit - Maximum nodes to return
 */
export async function findColdNodes(
  accessThreshold = 5,
  daysUnaccessed = 30,
  limit = 1000
): Promise<NodeRow[]> {
  const threshold = new Date(Date.now() - daysUnaccessed * 24 * 60 * 60 * 1000);

  return await db
    .select()
    .from(memoryNodes)
    .where(
      and(
        sql`${memoryNodes.accessCount} < ${accessThreshold}`,
        sql`(${memoryNodes.lastAccessedAt} IS NULL OR ${memoryNodes.lastAccessedAt} < ${threshold.toISOString()}::timestamp)`,
        sql`${memoryNodes.resource} != 'ontology'`,
        sql`properties->>'archived' IS NULL`
      )
    )
    .orderBy(memoryNodes.accessCount, memoryNodes.lastAccessedAt)
    .limit(limit);
}

/**
 * Find hot nodes (frequently accessed) that should have extended retention.
 *
 * @param accessThreshold - Minimum access_count to consider "hot" (default: 10)
 * @param limit - Maximum nodes to return
 */
export async function findHotNodes(
  accessThreshold = 10,
  limit = 100
): Promise<NodeRow[]> {
  return await db
    .select()
    .from(memoryNodes)
    .where(
      and(
        sql`${memoryNodes.accessCount} >= ${accessThreshold}`,
        sql`properties->>'archived' IS NULL`
      )
    )
    .orderBy(desc(memoryNodes.accessCount), desc(memoryNodes.lastAccessedAt))
    .limit(limit);
}

export async function getNode(nodeId: string): Promise<NodeRow | null> {
  const [row] = await db
    .select()
    .from(memoryNodes)
    .where(eq(memoryNodes.id, nodeId))
    .limit(1);

  return row ?? null;
}

export async function findNodeByHash(
  resource: string,
  hash: string
): Promise<NodeRow | null> {
  const [row] = await db
    .select()
    .from(memoryNodes)
    .where(and(eq(memoryNodes.resource, resource), eq(memoryNodes.hash, hash)))
    .limit(1);

  return row ?? null;
}

export async function getEdge(edgeId: string): Promise<EdgeRow | null> {
  const [row] = await db
    .select()
    .from(memoryEdges)
    .where(eq(memoryEdges.id, edgeId))
    .limit(1);

  return row ?? null;
}

export async function findNodesByKind(
  kind: string,
  limit = 100,
  offset = 0
): Promise<NodeRow[]> {
  return await db
    .select()
    .from(memoryNodes)
    .where(eq(memoryNodes.kind, kind))
    .orderBy(desc(memoryNodes.created))
    .limit(limit)
    .offset(offset);
}

export async function getOutboundEdges(
  nodeId: string,
  kind?: string
): Promise<EdgeRow[]> {
  return await db
    .select()
    .from(memoryEdges)
    .where(buildEdgeWhere(memoryEdges.fromId, nodeId, kind))
    .orderBy(desc(memoryEdges.created));
}

export async function getInboundEdges(
  nodeId: string,
  kind?: string
): Promise<EdgeRow[]> {
  return await db
    .select()
    .from(memoryEdges)
    .where(buildEdgeWhere(memoryEdges.toId, nodeId, kind))
    .orderBy(desc(memoryEdges.created));
}

export async function getNeighbors(
  nodeId: string,
  options?: {
    resource?: string;
    direction?: "out" | "in" | "both";
    kind?: string;
    limit?: number;
  }
): Promise<{ edge: EdgeRow; otherNodeId: string }[]> {
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
  const results: { edge: EdgeRow; otherNodeId: string }[] = [];
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

export async function findRagDocumentNode(
  documentId: string,
  projectId?: string
): Promise<NodeRow | null> {
  const rows = await db
    .select()
    .from(memoryNodes)
    .where(
      and(
        eq(memoryNodes.kind, "rag_document"),
        sql`COALESCE(properties->>'documentId', '') = ${documentId}`,
        projectId ? eq(memoryNodes.projectId, projectId) : sql`true`
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findStaleNodes(
  olderThanMs: number,
  kind?: string,
  limit = 1000
): Promise<NodeRow[]> {
  const threshold = new Date(Date.now() - olderThanMs);

  return await db
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

export async function findNodesForDecay(
  olderThanMs: number,
  limit = 1000,
  projectIds?: string[]
): Promise<NodeRow[]> {
  if (projectIds && projectIds.length === 0) {
    return [];
  }

  const threshold = new Date(Date.now() - olderThanMs);

  return await db
    .select()
    .from(memoryNodes)
    .where(
      and(
        sql`${memoryNodes.updated} < ${threshold.toISOString()}::timestamp`,
        sql`properties->>'archived' IS NULL`,
        sql`${memoryNodes.resource} != 'ontology'`,
        projectIds ? inArray(memoryNodes.projectId, projectIds) : sql`true`
      )
    )
    .orderBy(memoryNodes.updated)
    .limit(limit);
}

export async function findNodesByConfidence(
  minConfidence: number,
  maxConfidence: number,
  kind?: string,
  limit = 1000
): Promise<NodeRow[]> {
  const query = await db
    .select()
    .from(memoryNodes)
    .where(
      and(
        sql`
          CASE
            WHEN properties ? 'confidence' 
             AND (properties->>'confidence') ~ '^[0-9]+(\\.[0-9]+)?$'
            THEN (properties->>'confidence')::numeric BETWEEN ${minConfidence} AND ${maxConfidence}
            ELSE false
          END
        `,
        kind ? eq(memoryNodes.kind, kind) : sql`true`
      )
    )
    .orderBy(desc(memoryNodes.created))
    .limit(limit);

  return query;
}

/**
 * Domain association result type
 */
export interface DomainAssociation {
  domain: string;
  confidence: number;
  source: "learned" | "seed";
}

/**
 * Find domain associations for text using FTS and keyword matching.
 * Returns learned domain classifications with confidence scores.
 *
 * @param text - Text to find domain associations for
 * @param resource - Resource scope (default: "user")
 * @param limit - Maximum results to return (default: 5)
 */
export async function findDomainAssociations(
  text: string,
  resource = "user",
  limit = 5
): Promise<DomainAssociation[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const normalizedText = text.trim();

  // Query domain_association nodes using FTS
  const ftsQuery = sql<{
    label: string;
    properties: Record<string, unknown> | null;
    rankScore: number | string | null;
  }>`
    WITH search AS (
      SELECT plainto_tsquery('english', ${normalizedText}) AS query
    )
    SELECT
      mn.label,
      mn.properties,
      ts_rank(mn.label_tsvector, search.query) AS "rankScore"
    FROM memory_nodes mn,
      search
    WHERE mn.kind = 'domain_association'
      AND mn.sanitized = true
      AND (mn.resource = ${resource} OR mn.resource = 'ontology')
      AND mn.label_tsvector @@ search.query
    ORDER BY "rankScore" DESC NULLS LAST, mn.created_at DESC NULLS LAST
    LIMIT ${limit * 2}
  `;

  const result = await db.execute(ftsQuery);
  const rows = (result.rows ?? []) as {
    label: string;
    properties: Record<string, unknown> | null;
    rankScore: number | string | null;
  }[];

  const associations: DomainAssociation[] = [];
  const seenDomains = new Set<string>();

  for (const row of rows) {
    const props = row.properties ?? {};
    const domain = typeof props.domain === "string" ? props.domain : null;
    const confidence =
      typeof props.confidence === "number" ? props.confidence : 0.5;
    const source = props.source === "seed" ? "seed" : "learned";

    if (domain && !seenDomains.has(domain)) {
      seenDomains.add(domain);
      associations.push({
        domain,
        confidence,
        source: source as "learned" | "seed",
      });
    }

    if (associations.length >= limit) {
      break;
    }
  }

  return associations;
}
