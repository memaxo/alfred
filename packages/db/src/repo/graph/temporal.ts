/**
 * Bi-Temporal Graph Query Utilities
 *
 * Provides helpers for querying the graph at different points in time
 * using the bi-temporal model (valid_from, valid_to).
 *
 * Reference: alfred-memory-review.md - "Bi-temporal edges for non-lossy updates"
 */

import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../../client";
import { memoryEdges, memoryNodes } from "../../schema/graph";
import type { EdgeRow, NodeRow } from "./types";

/**
 * Temporal query options
 */
export type TemporalOptions = {
  /** Point in time to query (default: now) */
  asOf?: Date;
  /** Include edges that were superseded (soft-deleted) */
  includeSuperseded?: boolean;
};

/**
 * Get edges that are valid at a specific point in time.
 *
 * @param asOf - Point in time to query (default: now)
 */
export function getValidEdges(asOf: Date = new Date()): Promise<EdgeRow[]> {
  return db
    .select()
    .from(memoryEdges)
    .where(
      and(
        // valid_from is NULL or <= asOf
        or(
          isNull(memoryEdges.validFrom),
          sql`${memoryEdges.validFrom} <= ${asOf.toISOString()}::timestamp`
        ),
        // valid_to is NULL or > asOf
        or(
          isNull(memoryEdges.validTo),
          sql`${memoryEdges.validTo} > ${asOf.toISOString()}::timestamp`
        )
      )
    );
}

/**
 * Get edges from a specific node that are valid at a point in time.
 */
export function getValidOutboundEdges(
  nodeId: string,
  kind?: string,
  options: TemporalOptions = {}
): Promise<EdgeRow[]> {
  const asOf = options.asOf ?? new Date();

  const predicates = [
    eq(memoryEdges.fromId, nodeId),
    // Temporal validity
    or(
      isNull(memoryEdges.validFrom),
      sql`${memoryEdges.validFrom} <= ${asOf.toISOString()}::timestamp`
    ),
  ];

  // Include currently valid edges by default
  if (!options.includeSuperseded) {
    predicates.push(
      or(
        isNull(memoryEdges.validTo),
        sql`${memoryEdges.validTo} > ${asOf.toISOString()}::timestamp`
      )
    );
  }

  if (kind) {
    predicates.push(eq(memoryEdges.kind, kind));
  }

  return db
    .select()
    .from(memoryEdges)
    .where(and(...predicates));
}

/**
 * Get edges to a specific node that are valid at a point in time.
 */
export function getValidInboundEdges(
  nodeId: string,
  kind?: string,
  options: TemporalOptions = {}
): Promise<EdgeRow[]> {
  const asOf = options.asOf ?? new Date();

  const predicates = [
    eq(memoryEdges.toId, nodeId),
    or(
      isNull(memoryEdges.validFrom),
      sql`${memoryEdges.validFrom} <= ${asOf.toISOString()}::timestamp`
    ),
  ];

  if (!options.includeSuperseded) {
    predicates.push(
      or(
        isNull(memoryEdges.validTo),
        sql`${memoryEdges.validTo} > ${asOf.toISOString()}::timestamp`
      )
    );
  }

  if (kind) {
    predicates.push(eq(memoryEdges.kind, kind));
  }

  return db
    .select()
    .from(memoryEdges)
    .where(and(...predicates));
}

/**
 * Soft-delete an edge by setting valid_to to the current time.
 * This preserves the edge for historical queries.
 *
 * @param edgeId - ID of the edge to soft-delete
 * @param validTo - End of validity (default: now)
 * @returns The updated edge, or null if not found
 */
export async function softDeleteEdge(
  edgeId: string,
  validTo: Date = new Date()
): Promise<EdgeRow | null> {
  const [row] = await db
    .update(memoryEdges)
    .set({ validTo })
    .where(
      and(
        eq(memoryEdges.id, edgeId),
        // Only soft-delete currently valid edges
        isNull(memoryEdges.validTo)
      )
    )
    .returning();

  return row ?? null;
}

/**
 * Create a new version of an edge (supersede the old one).
 * Sets valid_to on the old edge and creates a new edge with updated data.
 *
 * @param oldEdgeId - ID of the edge to supersede
 * @param updates - Partial edge data to update
 * @returns The new edge, or null if old edge not found
 */
export async function supersededEdge(
  oldEdgeId: string,
  updates: Partial<Pick<EdgeRow, "weight" | "metadata" | "kind">>
): Promise<EdgeRow | null> {
  // Get the old edge
  const [oldEdge] = await db
    .select()
    .from(memoryEdges)
    .where(eq(memoryEdges.id, oldEdgeId))
    .limit(1);

  if (!oldEdge) {
    return null;
  }

  const now = new Date();

  // Soft-delete the old edge
  await db
    .update(memoryEdges)
    .set({ validTo: now })
    .where(eq(memoryEdges.id, oldEdgeId));

  // Create new edge with updated data
  const [newEdge] = await db
    .insert(memoryEdges)
    .values({
      fromId: oldEdge.fromId,
      toId: oldEdge.toId,
      kind: updates.kind ?? oldEdge.kind,
      weight: updates.weight ?? oldEdge.weight,
      metadata: updates.metadata ?? oldEdge.metadata,
      resource: oldEdge.resource,
      hash: `${oldEdge.hash}_${now.getTime()}`, // New hash for new version
      validFrom: now,
      validTo: null, // Currently valid
    })
    .returning();

  return newEdge ?? null;
}

/**
 * Get the history of an edge (all versions).
 *
 * @param fromId - Source node ID
 * @param toId - Target node ID
 * @param kind - Edge type
 * @returns All versions of the edge, ordered by creation time
 */
export function getEdgeHistory(
  fromId: string,
  toId: string,
  kind: string
): Promise<EdgeRow[]> {
  return db
    .select()
    .from(memoryEdges)
    .where(
      and(
        eq(memoryEdges.fromId, fromId),
        eq(memoryEdges.toId, toId),
        eq(memoryEdges.kind, kind)
      )
    )
    .orderBy(memoryEdges.created);
}

/**
 * Get a snapshot of the graph at a specific point in time.
 * Returns all nodes and edges that were valid at that time.
 *
 * @param asOf - Point in time to query
 * @param resource - Optional resource scope
 */
export async function getGraphSnapshot(
  asOf: Date,
  resource?: string
): Promise<{ nodes: NodeRow[]; edges: EdgeRow[] }> {
  // Get all nodes (nodes don't have temporal validity yet)
  const nodePredicates = resource ? [eq(memoryNodes.resource, resource)] : [];

  const nodes = await db
    .select()
    .from(memoryNodes)
    .where(
      and(
        ...nodePredicates,
        sql`${memoryNodes.created} <= ${asOf.toISOString()}::timestamp`
      )
    );

  // Get temporally valid edges
  const edgePredicates = [
    or(
      isNull(memoryEdges.validFrom),
      sql`${memoryEdges.validFrom} <= ${asOf.toISOString()}::timestamp`
    ),
    or(
      isNull(memoryEdges.validTo),
      sql`${memoryEdges.validTo} > ${asOf.toISOString()}::timestamp`
    ),
  ];

  if (resource) {
    edgePredicates.push(eq(memoryEdges.resource, resource));
  }

  const edges = await db
    .select()
    .from(memoryEdges)
    .where(and(...edgePredicates));

  return { nodes, edges };
}

/**
 * Check if an edge is currently valid.
 */
export function isEdgeValid(edge: EdgeRow, asOf: Date = new Date()): boolean {
  const validFrom = edge.validFrom ? new Date(edge.validFrom) : null;
  const validTo = edge.validTo ? new Date(edge.validTo) : null;

  const afterValidFrom = !validFrom || validFrom <= asOf;
  const beforeValidTo = !validTo || validTo > asOf;

  return afterValidFrom && beforeValidTo;
}

/**
 * Get superseded (soft-deleted) edges for a node pair.
 */
export function getSupersededEdges(
  fromId: string,
  toId: string,
  kind?: string
): Promise<EdgeRow[]> {
  const predicates = [
    eq(memoryEdges.fromId, fromId),
    eq(memoryEdges.toId, toId),
    // Only superseded edges (valid_to is set)
    sql`${memoryEdges.validTo} IS NOT NULL`,
  ];

  if (kind) {
    predicates.push(eq(memoryEdges.kind, kind));
  }

  return db
    .select()
    .from(memoryEdges)
    .where(and(...predicates))
    .orderBy(memoryEdges.validTo);
}
