import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../client";
import { memoryEdges, memoryNodes } from "../../schema/graph";
import type { EdgeRow, NodeRow } from "./types";
import { buildEdgeWhere } from "./utils";

export async function getNode(nodeId: string): Promise<NodeRow | null> {
  const [row] = await db
    .select()
    .from(memoryNodes)
    .where(eq(memoryNodes.id, nodeId))
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
  return db
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

export async function findNodesForDecay(
  olderThanMs: number,
  limit = 1000
): Promise<NodeRow[]> {
  const threshold = new Date(Date.now() - olderThanMs);

  return db
    .select()
    .from(memoryNodes)
    .where(
      and(
        sql`${memoryNodes.updated} < ${threshold.toISOString()}::timestamp`,
        sql`properties->>'archived' IS NULL`,
        sql`${memoryNodes.resource} != 'ontology'`
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
  const query = db
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
export type DomainAssociation = {
  domain: string;
  confidence: number;
  source: "learned" | "seed";
};

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
  const rows = (result.rows ?? []) as Array<{
    label: string;
    properties: Record<string, unknown> | null;
    rankScore: number | string | null;
  }>;

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
