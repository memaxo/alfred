import { db } from "@alfred/db";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import { logger } from "@alfred/logger";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  graphContextDurationSeconds,
  graphRagEmptyTotal,
  graphRagHitsTotal,
} from "../metrics";

export type EdgeRow = typeof memoryEdges.$inferSelect;

function asProps(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Graph domain service
 *
 * Extracts complex graph query logic from graph router to keep routers thin.
 */

export async function executeContextQuery(
  nodeId: string,
  text: string,
  topK: number | undefined,
  resource: string
): Promise<{
  nodes: Array<{
    id: { uiId: string };
    kind: string;
    label: string;
    properties: Record<string, unknown>;
  }>;
  edges: EdgeRow[];
  meta: {
    graphCount: number;
    ragCount: number;
  };
}> {
  let stopContextTimer: (() => void) | null = null;
  try {
    stopContextTimer = graphContextDurationSeconds.startTimer();
  } catch {
    /* ignore */
  }

  // 1. Graph Traversal (1-hop neighbors)
  const edgesPromise = db
    .select()
    .from(memoryEdges)
    .where(
      and(
        eq(memoryEdges.resource, resource),
        or(
          eq(memoryEdges.fromId, nodeId),
          eq(memoryEdges.toId, nodeId)
        )
      )
    );

  // 2. Vector RAG
  const { runQuery: runUnifiedQuery } = await import("@alfred/graph");
  const ragInput = {
    kind: "semantic" as const,
    text,
    topK: topK ?? 10,
    preferRag: true,
    resource,
  };
  const ragPromise = runUnifiedQuery(ragInput, { resource });

  const [edges, ragResult] = await Promise.all([edgesPromise, ragPromise]);

  // 1. Identify 1-hop neighbors
  const neighborIds = new Set<string>();
  for (const edge of edges) {
    if (edge.fromId !== nodeId) {
      neighborIds.add(edge.fromId);
    }
    if (edge.toId !== nodeId) {
      neighborIds.add(edge.toId);
    }
  }

  // 2. Deep RAG: If 1-hop is sparse (< 3) and we have neighbors, go deeper (2-hop)
  let deepEdges: EdgeRow[] = [];
  const oneHopIds = Array.from(neighborIds);

  if (edges.length < 3 && oneHopIds.length > 0) {
    try {
      deepEdges = await db
        .select()
        .from(memoryEdges)
        .where(
          and(
            eq(memoryEdges.resource, resource),
            or(
              inArray(memoryEdges.fromId, oneHopIds),
              inArray(memoryEdges.toId, oneHopIds)
            )
          )
        )
        .limit(10);

      // Filter edges connecting back to start node
      deepEdges = deepEdges.filter(
        (e) => e.fromId !== nodeId && e.toId !== nodeId
      );

      // Add 2-hop neighbors to ID set for label fetching
      for (const e of deepEdges) {
        if (!neighborIds.has(e.fromId)) {
          neighborIds.add(e.fromId);
        }
        if (!neighborIds.has(e.toId)) {
          neighborIds.add(e.toId);
        }
      }
    } catch (error) {
      // Ignore deep RAG failures, fallback to 1-hop
      logger.warn("graph_context_deep_traversal_failed", {
        resource,
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 3. Fetch labels for all identified nodes (1-hop + 2-hop)
  const neighborsPromise =
    neighborIds.size > 0
      ? db
          .select({ id: memoryNodes.id, label: memoryNodes.label })
          .from(memoryNodes)
          .where(inArray(memoryNodes.id, Array.from(neighborIds)))
      : Promise.resolve([]);

  const neighbors = await neighborsPromise;
  const labelMap = new Map(neighbors.map((n) => [n.id, n.label]));

  // 4. Format 1-hop edges
  const graphNodes = edges.map((edge) => {
    const isOutgoing = edge.fromId === nodeId;
    const neighborId = isOutgoing ? edge.toId : edge.fromId;
    const label = labelMap.get(neighborId) ?? neighborId;

    return {
      id: { uiId: neighborId },
      kind: "link",
      label,
      properties: {
        relation: edge.kind,
        direction: isOutgoing ? "outgoing" : "incoming",
      },
    };
  });

  // 5. Format 2-hop edges
  const deepGraphNodes = deepEdges.map((edge) => {
    // Heuristic: Identify the "bridge" node (the one in 1-hop set)
    // If both are 1-hop, it's a lateral connection.
    // If one is new, it's the target.
    const fromIs1Hop = oneHopIds.includes(edge.fromId);

    // Default to 'to' as target if 'from' is the bridge
    const bridgeId = fromIs1Hop ? edge.fromId : edge.toId;
    const targetId = fromIs1Hop ? edge.toId : edge.fromId;

    const targetLabel = labelMap.get(targetId) ?? targetId;
    const bridgeLabel = labelMap.get(bridgeId) ?? bridgeId;

    return {
      id: { uiId: targetId },
      kind: "link",
      label: `${targetLabel} (via ${bridgeLabel})`,
      properties: {
        relation: edge.kind,
        direction: "indirect",
      },
    };
  });

  const allGraphNodes = [...graphNodes, ...deepGraphNodes];
  const allEdges = [...edges, ...deepEdges];

  const ragNodes = (ragResult.nodes ?? []).flatMap((n) => {
    const uiId = n.id.uiId;
    if (!uiId) {
      return [];
    }
    return [
      {
        id: { uiId },
        kind: n.kind,
        label: n.label,
        properties: asProps(n.properties),
      },
    ];
  });

  // Record metrics
  try {
    const vectorCount = ragNodes.length;
    const graphCount = allGraphNodes.length;

    if (vectorCount > 0) {
      graphRagHitsTotal.inc({ source: "vector" }, vectorCount);
    }
    if (graphCount > 0) {
      graphRagHitsTotal.inc({ source: "graph" }, graphCount);
    }
    if (vectorCount === 0 && graphCount === 0) {
      graphRagEmptyTotal.inc();
    }
  } catch {
    /* ignore metrics errors */
  }

  if (stopContextTimer) {
    stopContextTimer();
  }

  return {
    nodes: [...allGraphNodes, ...ragNodes],
    edges: allEdges,
    meta: {
      graphCount: allGraphNodes.length,
      ragCount: ragNodes.length,
    },
  };
}
