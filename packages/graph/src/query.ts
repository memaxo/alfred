import { retrieve as ragRetrieve } from "@alfred/rag";
import * as graphRepo from "@alfred/db/repo/graph";
import type { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import type { Hypergraph, Knowledge, NodeId } from "@alfred/knowledge/hypergraph";
import {
  execute as executeDatalog,
  parse as parseQuery,
  semanticQuery as hyperSemantic,
} from "@alfred/knowledge/query";
import type { UnifiedEdge, UnifiedNode, UnifiedNodeKind } from "./unified.js";

type DbNode = typeof memoryNodes.$inferSelect;
type DbEdge = typeof memoryEdges.$inferSelect;

export type QueryKind = "traverse" | "path" | "datalog" | "semantic";

export type TraverseQuery = {
  kind: "traverse";
  nodeId: string;
  direction?: "in" | "out" | "both";
  resource?: string;
  edgeKind?: string;
  limit?: number;
};

export type PathQuery = {
  kind: "path";
  fromId: string;
  toId: string;
  maxDepth?: number;
  resource?: string;
};

export type DatalogQuery = {
  kind: "datalog";
  query: string;
  resource?: string;
};

export type SemanticQuery = {
  kind: "semantic";
  text: string;
  topK?: number;
  preferRag?: boolean;
  resource?: string;
};

export type UnifiedQuery =
  | TraverseQuery
  | PathQuery
  | DatalogQuery
  | SemanticQuery;

export type UnifiedQueryResult = {
  nodes: UnifiedNode[];
  edges?: UnifiedEdge[];
};

export async function runQuery(
  query: UnifiedQuery,
  context: { graph?: Hypergraph; resource?: string }
): Promise<UnifiedQueryResult> {
  switch (query.kind) {
    case "traverse":
      return runTraverse(query, context.resource);
    case "path":
      return runPath(query, context.resource);
    case "datalog":
      return runDatalog(query, context.graph);
    case "semantic":
      return runSemantic(query, context);
    default:
      return { nodes: [], edges: [] };
  }
}

async function runTraverse(
  query: TraverseQuery,
  resource?: string
): Promise<UnifiedQueryResult> {
  const neighbors = await graphRepo.getNeighbors(query.nodeId, {
    direction: query.direction,
    kind: query.edgeKind,
    limit: query.limit,
    resource,
  });
  const nodeIds = new Set<string>([query.nodeId]);
  for (const neighbor of neighbors) {
    nodeIds.add(neighbor.otherNodeId);
  }
  const subgraph = await graphRepo.getSubgraph(Array.from(nodeIds), resource);
  const nodeMap = mapNodes(subgraph.nodes);
  const edges = neighbors.map(({ edge }) => mapEdgeRow(edge));
  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

async function runPath(
  query: PathQuery,
  resource?: string
): Promise<UnifiedQueryResult> {
  const path = await graphRepo.findPath(
    query.fromId,
    query.toId,
    query.maxDepth,
    resource
  );
  if (path.length === 0) {
    return { nodes: [], edges: [] };
  }
  const nodeIds = path.map((entry) => entry.nodeId);
  const requiredEdgeIds =
    path[path.length - 1]?.via ?? [];
  const subgraph = await graphRepo.getSubgraph(nodeIds, resource);
  const nodeMap = mapNodes(subgraph.nodes);
  const edges = subgraph.edges
    .filter((edge) => requiredEdgeIds.includes(edge.id))
    .map((edge) => mapEdgeRow(edge));
  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

async function runDatalog(
  query: DatalogQuery,
  graph?: Hypergraph
): Promise<UnifiedQueryResult> {
  if (!graph) {
    throw new Error("Hypergraph instance required for datalog queries");
  }
  const ast = parseQuery(query.query);
  const bindings = executeDatalog(ast, graph);
  const nodes = new Map<string, UnifiedNode>();
  const edges = new Map<string, UnifiedEdge>();
  for (const binding of bindings) {
    for (const value of binding.values()) {
      const knowledge = graph.get(value as NodeId);
      if (!knowledge) continue;
      appendKnowledgeEntry(
        value as string,
        knowledge,
        nodes,
        edges
      );
    }
  }
  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  };
}

async function runSemantic(
  query: SemanticQuery,
  context: { graph?: Hypergraph; resource?: string }
): Promise<UnifiedQueryResult> {
  const topK = query.topK ?? 10;
  if (
    context.graph &&
    context.graph.embeddingCount() > 0 &&
    query.preferRag !== true
  ) {
    const ids = hyperSemantic(query.text, context.graph, topK);
    const semanticNodes: UnifiedNode[] = [];
    const nodeSet = new Set<string>();
    for (const id of ids) {
      if (nodeSet.has(id)) continue;
      const knowledge = context.graph.get(id as NodeId);
      if (!knowledge) continue;
      semanticNodes.push(mapKnowledgeNode(id as string, knowledge));
      nodeSet.add(id as string);
    }
    return { nodes: semanticNodes };
  }

  const chunks = await ragRetrieve(query.text, topK);
  const nodes = chunks.map((chunk, index) => ({
    id: {
      uiId:
        (chunk.metadata?.documentId as string) ??
        (chunk.metadata?.id as string) ??
        `rag-${index}`,
    },
    kind: "insight",
    label: (chunk.metadata?.title as string) ?? (chunk.metadata?.documentId as string) ?? "Context",
    properties: {
      content: chunk.content,
      metadata: chunk.metadata,
    },
  }));
  return { nodes };
}

function mapNodes(rows: DbNode[]): Map<string, UnifiedNode> {
  const nodes = new Map<string, UnifiedNode>();
  for (const row of rows) {
    nodes.set(row.id, mapNodeRow(row));
  }
  return nodes;
}

function mapNodeRow(row: DbNode): UnifiedNode {
  const kind = (row.kind as UnifiedNodeKind) ?? "other";
  return {
    id: { dbId: row.id },
    kind,
    label: row.label,
    properties: row.properties ?? undefined,
  };
}

function mapEdgeRow(row: DbEdge): UnifiedEdge {
  return {
    id: row.id,
    source: { dbId: row.fromId },
    target: { dbId: row.toId },
    kind: row.kind,
    weight: row.weight ?? undefined,
    properties: row.metadata ?? undefined,
  };
}

function appendKnowledgeEntry(
  id: string,
  knowledge: Knowledge,
  nodeMap: Map<string, UnifiedNode>,
  edgeMap: Map<string, UnifiedEdge>,
  directNodes?: UnifiedNode[]
) {
  if (knowledge._ === "relation") {
    const edge: UnifiedEdge = {
      id,
      source: { hgHash: knowledge.from as unknown as string },
      target: { hgHash: knowledge.to as unknown as string },
      kind: knowledge.kind,
      weight: knowledge.weight,
    };
    edgeMap.set(id, edge);
    return;
  }
  const node = mapKnowledgeNode(id, knowledge);
  if (directNodes) {
    directNodes.push(node);
  } else {
    nodeMap.set(id, node);
  }
}

function mapKnowledgeNode(
  id: string,
  knowledge: Knowledge
): UnifiedNode {
  return {
    id: { hgHash: id },
    kind: knowledge._,
    label: getKnowledgeLabel(knowledge),
    properties: buildKnowledgeProperties(knowledge),
  };
}

function getKnowledgeLabel(knowledge: Knowledge): string {
  switch (knowledge._) {
    case "fact":
      return knowledge.content;
    case "insight":
      return knowledge.conclusion;
    case "pattern":
      return knowledge.rule;
    default:
      return knowledge._;
  }
}

function buildKnowledgeProperties(
  knowledge: Knowledge
): Record<string, unknown> | undefined {
  switch (knowledge._) {
    case "fact":
      return {
        confidence: knowledge.confidence,
        source: knowledge.source,
        ts: knowledge.ts,
      };
    case "insight":
      return {
        derived: knowledge.derived,
        confidence: knowledge.confidence,
      };
    case "pattern":
      return {
        examples: knowledge.examples,
        accuracy: knowledge.accuracy,
      };
    default:
      return undefined;
  }
}
