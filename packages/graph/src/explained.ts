import { db } from "@alfred/db";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import { and, eq, inArray } from "drizzle-orm";

export async function getExplainingDocuments(reasoningNodeId: string) {
  const edges = await db
    .select()
    .from(memoryEdges)
    .where(
      and(
        eq(memoryEdges.kind, "explains"),
        eq(memoryEdges.toId, reasoningNodeId),
        eq(memoryEdges.resource, "user"),
      ),
    );

  if (edges.length === 0) {
    return { nodes: [], edges: [] as typeof edges };
  }

  const fromIds = edges.map((edge) => edge.fromId);

  const nodes = await db
    .select()
    .from(memoryNodes)
    .where(
      and(
        eq(memoryNodes.kind, "rag_document"),
        eq(memoryNodes.resource, "user"),
        inArray(memoryNodes.id, fromIds),
      ),
    );

  return { nodes, edges };
}
