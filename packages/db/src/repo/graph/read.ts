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
