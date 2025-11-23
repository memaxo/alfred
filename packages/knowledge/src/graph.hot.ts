import { db, graphSchema } from "@alfred/db";
import { desc, inArray } from "drizzle-orm";

/**
 * Performance-critical graph retrieval for initial render.
 * Returns raw node/edge data optimized for visualization.
 */
export async function fast_getGraphSnapshot(
  userId: string,
  options: { limit?: number } = {}
) {
  const { limit = 1000 } = options;
  
  // Direct Drizzle query for maximum performance
  const nodes = await db
    .select()
    .from(graphSchema.memoryNodes)
    .orderBy(desc(graphSchema.memoryNodes.created))
    .limit(limit);
  
  // Fetch edges only for retrieved nodes to maintain graph integrity
  const nodeIds = nodes.map(n => n.id);
  
  let edges: typeof graphSchema.memoryEdges.$inferSelect[] = [];
  
  if (nodeIds.length > 0) {
    edges = await db
      .select()
      .from(graphSchema.memoryEdges)
      .where(inArray(graphSchema.memoryEdges.fromId, nodeIds));
      // Note: We primarily care about outbound edges for structure, 
      // but could also fetch inbound if needed. For a "snapshot", 
      // outbound from the set + any edges connecting two nodes in the set is good.
      // Simplest is "edges starting from these nodes".
  }
  
  return {
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.kind, // memoryNodes uses 'kind', mapped to 'type' for UI
      x: Math.random() * 1000 - 500, // Initial random layout
      y: Math.random() * 1000 - 500,
      data: { 
        label: n.label, // Use 'label' column directly
        title: (n.properties as any)?.title ?? n.label,
        ...((n.properties as any) ?? {})
      }
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.fromId,
      target: e.toId,
      data: { weight: e.weight }
    }))
  };
}
