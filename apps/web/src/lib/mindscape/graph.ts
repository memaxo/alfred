/**
 * Pure graph transformation helpers for Mindscape.
 *
 * These functions extract and transform graph nodes/edges without side effects.
 * They are used by canvas.tsx, initializer.tsx, and traversal hooks.
 */

import type { KnowledgeNodeData } from "@/store/mindscape.schemas";

/**
 * Reference identifiers for a graph node.
 * Graph nodes may have multiple ID types (UI-local, database, hypergraph hash).
 */
export type NodeIdRef = {
  uiId?: string;
  dbId?: string;
  hgHash?: string;
};

/** UUID or hex-only pattern for graph dbIds */
export const GRAPH_DBID_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{32})$/i;

/**
 * Extracts a canonical reference ID from a NodeIdRef.
 * Priority: dbId > hgHash > uiId
 */
export function extractNodeRef(id: NodeIdRef | unknown): string | null {
  if (!id || typeof id !== "object") {
    return null;
  }
  const ref = id as NodeIdRef;
  return ref.dbId ?? ref.hgHash ?? ref.uiId ?? null;
}

/**
 * Checks if a string looks like a valid graph dbId.
 * Type guard that narrows the type to string.
 */
export function isValidDbId(id: string | undefined | null): id is string {
  return typeof id === "string" && GRAPH_DBID_PATTERN.test(id);
}

/**
 * Typed properties commonly found on graph nodes.
 */
export type GraphNodeProperties = {
  content?: string;
  confidence?: number;
  accuracy?: number;
  archived?: string;
  executionId?: string;
  runId?: string;
  workflowRunId?: string;
};

/**
 * Extracts typed properties from a graph node's properties object.
 */
export function extractNodeProperties(
  properties: unknown
): GraphNodeProperties {
  if (!properties || typeof properties !== "object") {
    return {};
  }
  const props = properties as Record<string, unknown>;
  return {
    content: typeof props.content === "string" ? props.content : undefined,
    confidence:
      typeof props.confidence === "number" ? props.confidence : undefined,
    accuracy: typeof props.accuracy === "number" ? props.accuracy : undefined,
    archived: typeof props.archived === "string" ? props.archived : undefined,
    executionId:
      typeof props.executionId === "string" ? props.executionId : undefined,
    runId: typeof props.runId === "string" ? props.runId : undefined,
    workflowRunId:
      typeof props.workflowRunId === "string" ? props.workflowRunId : undefined,
  };
}

/**
 * Derives a workflow runId from node properties.
 * Checks executionId, runId, and workflowRunId fields.
 */
export function deriveWorkflowRunId(props: GraphNodeProperties): string | undefined {
  if (props.executionId && props.executionId.length > 0) {
    return props.executionId;
  }
  if (props.runId && props.runId.length > 0) {
    return props.runId;
  }
  if (props.workflowRunId && props.workflowRunId.length > 0) {
    return props.workflowRunId;
  }
  return undefined;
}

/**
 * Derives confidence from node properties.
 * Falls back from confidence to accuracy.
 */
export function deriveConfidence(
  props: GraphNodeProperties
): number | undefined {
  return props.confidence ?? props.accuracy;
}

/**
 * Transforms a graph node into KnowledgeNodeData.
 *
 * @param node - Raw graph node with id, label, kind, properties
 * @param source - "runtime" | "rag" to indicate the node's origin
 * @param resource - Graph resource (e.g., "user")
 */
export function graphNodeToKnowledge(
  node: {
    id: unknown;
    label?: string | null;
    kind?: string | null;
    properties?: unknown;
  },
  source: "runtime" | "rag",
  resource = "user"
): KnowledgeNodeData | null {
  const nodeId = node.id as NodeIdRef;
  const ref = extractNodeRef(nodeId);
  if (!ref) {
    return null;
  }

  const props = extractNodeProperties(node.properties);
  const confidence = deriveConfidence(props);
  const runId = deriveWorkflowRunId(props);

  return {
    type: "knowledge",
    label: node.label || (source === "rag" ? "RAG Context" : "Knowledge"),
    kind: node.kind ?? undefined,
    summary: props.content,
    confidence,
    archived: props.archived,
    source,
    runId: source === "runtime" ? runId : undefined,
    graph: {
      resource,
      dbId: nodeId.dbId,
      hgHash: nodeId.hgHash,
    },
  };
}

/**
 * Generates a Mindscape flow node ID from a graph node reference.
 *
 * @param ref - The canonical reference (dbId/hgHash)
 * @param source - "runtime" | "rag" prefix
 */
export function graphRefToFlowId(
  ref: string,
  source: "runtime" | "rag"
): string {
  return source === "rag" ? `rag-knowledge-${ref}` : `knowledge-${ref}`;
}

/**
 * Edge data structure for graph edges mapped to React Flow.
 */
export type MappedEdgeData = {
  kind?: string;
  fromDbId: string;
  toDbId: string;
};

/**
 * Maps a graph edge to React Flow edge format.
 *
 * @param edge - Raw graph edge with id, fromId, toId, kind
 * @param dbIdToFlowId - Map from dbId to React Flow node id
 */
export function mapGraphEdgeToFlow(
  edge: { id: string; fromId: string; toId: string; kind?: string | null },
  dbIdToFlowId: Map<string, string>
): {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  data: MappedEdgeData;
  style: Record<string, unknown>;
} | null {
  const source = dbIdToFlowId.get(edge.fromId);
  const target = dbIdToFlowId.get(edge.toId);
  if (!(source && target)) {
    return null;
  }

  const isExplains = edge.kind === "explains";
  return {
    id: edge.id,
    source,
    target,
    animated: !isExplains,
    data: {
      kind: edge.kind ?? undefined,
      fromDbId: edge.fromId,
      toDbId: edge.toId,
    },
    style: isExplains
      ? {
          stroke: "rgba(16, 185, 129, 0.6)",
          strokeDasharray: "4 2",
          strokeWidth: 1.5,
        }
      : { stroke: "rgba(255, 255, 255, 0.2)" },
  };
}

/**
 * Builds a map from graph dbId to React Flow node id.
 */
export function buildDbIdToFlowIdMap(
  nodes: Array<{ id: string; data?: { graph?: { dbId?: string } } }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of nodes) {
    const dbId = node.data?.graph?.dbId;
    if (typeof dbId === "string" && dbId.length > 0) {
      map.set(dbId, node.id);
    }
  }
  return map;
}

/**
 * Extracts valid graph dbIds from a list of nodes.
 */
export function extractGraphNodeIds(
  nodes: Array<{ data?: { graph?: { dbId?: string } } }>
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    const dbId = node.data?.graph?.dbId;
    if (isValidDbId(dbId)) {
      ids.push(dbId);
    }
  }
  return Array.from(new Set(ids));
}
