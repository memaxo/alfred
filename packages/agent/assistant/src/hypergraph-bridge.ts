import type { Hypergraph } from "@alfred/knowledge/hypergraph";
import {
  loadHypergraph as hydrateHypergraph,
  persistHypergraph as persistInKnowledge,
  type HypergraphLoader,
  type NodeRecord,
  type RelationRecord,
} from "@alfred/knowledge/persist";
import { persistKnowledge } from "./graphstore";
import { db } from "@alfred/db";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import { eq } from "drizzle-orm";

type EdgeRow = typeof memoryEdges.$inferSelect;

type NodeRow = typeof memoryNodes.$inferSelect;

export async function persistHypergraphToDb(
  graph: Hypergraph,
  resource: string
): Promise<void> {
  await persistInKnowledge(graph, resource, persistKnowledge);
}

export async function loadHypergraphFromDb(
  resource: string,
  graph: Hypergraph
): Promise<void> {
  const loader: HypergraphLoader = {
    loadNodes: async () => selectNodes(resource),
    loadRelations: async () => selectRelations(resource),
  };

  await hydrateHypergraph(resource, graph, loader);
}

async function selectNodes(resource: string): Promise<NodeRecord[]> {
  const rows = await db
    .select()
    .from(memoryNodes)
    .where(eq(memoryNodes.resource, resource));

  return rows.map((row: NodeRow) => ({
    hash: row.hash,
    kind: row.kind as NodeRecord["kind"],
    label: row.label,
    properties: (row.properties as Record<string, unknown> | null) ?? null,
  }));
}

async function selectRelations(resource: string): Promise<RelationRecord[]> {
  const rows = await db
    .select()
    .from(memoryEdges)
    .where(eq(memoryEdges.resource, resource));

  const relations: RelationRecord[] = [];
  for (const row of rows as EdgeRow[]) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const fromHash = typeof metadata.from === "string" ? metadata.from : null;
    const toHash = typeof metadata.to === "string" ? metadata.to : null;
    if (!(fromHash && toHash)) {
      continue;
    }
    relations.push({
      hash: row.hash,
      fromHash,
      toHash,
      kind: row.kind,
      weight: row.weight,
    });
  }
  return relations;
}
