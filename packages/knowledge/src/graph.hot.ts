import { db, graphSchema } from "@alfred/db";
import { desc, inArray } from "drizzle-orm";

/**
 * Type guard for JSONB properties object.
 * Fast path: no allocations, pure type narrowing.
 */
function isPropertiesObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

/**
 * Extract title from properties with type safety.
 * Returns label fallback if title not found.
 */
function extractTitle(
  properties: unknown,
  label: string
): string {
  if (!isPropertiesObject(properties)) {
    return label;
  }
  const title = properties.title;
  return typeof title === "string" && title.length > 0 ? title : label;
}

/**
 * Extract properties object with type safety.
 * Returns empty object if invalid.
 */
function extractProperties(
  properties: unknown
): Record<string, unknown> {
  if (!isPropertiesObject(properties)) {
    return {};
  }
  return properties;
}

/**
 * Performance-critical graph retrieval for initial render.
 * Returns raw node/edge data optimized for visualization.
 */
export async function fast_getGraphSnapshot(
  _userId: string,
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
  const nodeIds = nodes.map((n) => n.id);

  let edges: (typeof graphSchema.memoryEdges.$inferSelect)[] = [];

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
    nodes: nodes.map((n) => {
      const props = extractProperties(n.properties);
      return {
        id: n.id,
        type: n.kind, // memoryNodes uses 'kind', mapped to 'type' for UI
        x: Math.random() * 1000 - 500, // Initial random layout
        y: Math.random() * 1000 - 500,
        data: {
          label: n.label, // Use 'label' column directly
          title: extractTitle(n.properties, n.label),
          ...props,
        },
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.fromId,
      target: e.toId,
      data: { weight: e.weight },
    })),
  };
}
