import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../../client";
import { memoryEdges, memoryNodes } from "../../schema/graph";
import { sanitizeContextText, sanitizeGraphValue } from "../sanitize";
import { getNode } from "./read";
import type { EdgeRow, EdgeSeed, NodeInsert, NodeRow, NodeSeed } from "./types";
import { sanitize, uniqSeeds } from "./utils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createNode(
  resource: string,
  hash: string,
  kind: string,
  label: string,
  properties?: unknown
): Promise<NodeRow> {
  const safeLabel = sanitizeContextText(label);
  const safeProps =
    properties === undefined || properties === null
      ? null
      : sanitizeGraphValue(properties);

  const [row] = await db
    .insert(memoryNodes)
    .values({
      resource,
      hash,
      kind,
      label: safeLabel,
      properties: safeProps,
      sanitized: true,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create graph node");
  }

  return row;
}

export async function updateNode(
  nodeId: string,
  updates: Partial<NodeInsert>
): Promise<NodeRow | null> {
  const payload = sanitize<NodeInsert>(updates);
  if (typeof payload.label === "string") {
    payload.label = sanitizeContextText(payload.label);
  }
  if (payload.properties !== undefined && payload.properties !== null) {
    payload.properties = sanitizeGraphValue(payload.properties);
  }
  if (
    payload.label !== undefined ||
    payload.properties !== undefined ||
    payload.embedding !== undefined
  ) {
    payload.sanitized = true;
  }
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

export async function upsertNodes(
  seeds: NodeSeed[]
): Promise<Map<string, NodeRow>> {
  const deduped = uniqSeeds(seeds);
  if (deduped.length === 0) {
    return new Map();
  }

  const values = deduped.map((seed) => ({
    resource: seed.resource,
    hash: seed.hash,
    kind: seed.kind,
    label: sanitizeContextText(seed.label),
    properties:
      seed.properties === undefined || seed.properties === null
        ? null
        : sanitizeGraphValue(seed.properties),
    embedding: seed.embedding ?? null,
    sanitized: true,
  }));
  // console.log("DEBUG: Upserting values", values[0]);

  const rows = await db
    .insert(memoryNodes)
    .values(values)
    .onConflictDoUpdate({
      target: [memoryNodes.resource, memoryNodes.hash],
      set: {
        label: sql`excluded.label`,
        properties: sql`excluded.properties`,
        embedding: sql`excluded.embedding`,
        sanitized: sql`excluded.sanitized`,
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

export async function deleteEdge(edgeId: string): Promise<number> {
  const rows = await db
    .delete(memoryEdges)
    .where(eq(memoryEdges.id, edgeId))
    .returning({ id: memoryEdges.id });

  return rows.length;
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
          }::text)
          ELSE properties || jsonb_build_object('archived', NOW()::text, 'archiveReason', ${
            reason ?? "pruned"
          }::text)
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
          WHEN properties IS NULL THEN jsonb_build_object('confidence', ${clamped}::double precision)
          ELSE jsonb_set(properties, '{confidence}', to_jsonb(${clamped}::double precision))
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

  // Clamp + validate upfront to avoid writing invalid JSON values.
  const safeUpdates: Array<{ id: string; confidence: number }> = [];
  for (const update of updates) {
    if (!UUID_RE.test(update.id)) {
      continue;
    }
    const confidence = Number(update.confidence);
    if (!Number.isFinite(confidence)) {
      continue;
    }
    safeUpdates.push({
      id: update.id,
      confidence: Math.max(0, Math.min(1, confidence)),
    });
  }

  if (safeUpdates.length === 0) {
    return 0;
  }

  // Keep the query size bounded to avoid huge statements and parameter limits.
  const CHUNK = 5000;
  let updated = 0;

  for (let i = 0; i < safeUpdates.length; i += CHUNK) {
    const chunk = safeUpdates.slice(i, i + CHUNK);

    // Postgres bulk update pattern:
    // UPDATE memory_nodes
    // SET properties = ..., updated = NOW()
    // FROM (VALUES (...), (...)) AS v(id, confidence)
    // WHERE memory_nodes.id = v.id
    // RETURNING memory_nodes.id
    const values = sql`(VALUES ${sql.join(
      chunk.map((u) => sql`(${u.id}::uuid, ${u.confidence}::double precision)`),
      sql`, `
    )}) AS v(id, confidence)`;

    const rows = await db
      .update(memoryNodes)
      .set({
        properties: sql`
          CASE
            WHEN ${memoryNodes.properties} IS NULL THEN jsonb_build_object('confidence', v.confidence)
            ELSE jsonb_set(${memoryNodes.properties}, '{confidence}', to_jsonb(v.confidence))
          END
        `,
        updated: sql`NOW()`,
      })
      .from(values)
      .where(sql`${memoryNodes.id} = v.id`)
      .returning({ id: memoryNodes.id });

    updated += rows.length;
  }

  return updated;
}

export async function touchNodes(nodeIds: string[]): Promise<number> {
  if (nodeIds.length === 0) {
    return 0;
  }

  const BOOT_FACTOR = 0.05;

  const result = await db
    .update(memoryNodes)
    .set({
      properties: sql`
        CASE
          WHEN properties IS NULL THEN jsonb_build_object('confidence', 1.0)
          ELSE jsonb_set(
            properties, 
            '{confidence}', 
            LEAST(
              1.0, 
              COALESCE((properties->>'confidence')::numeric, 1.0) + ${BOOT_FACTOR}
            )::text::jsonb
          )
        END
      `,
      updated: sql`NOW()`,
    })
    .where(inArray(memoryNodes.id, nodeIds))
    .returning({ id: memoryNodes.id });

  return result.length;
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
