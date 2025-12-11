/**
 * Knowledge Graph Tool Execution
 * Wraps @alfred/knowledge and @alfred/db/repo/graph functions
 */

import { logger } from "@alfred/logger";
import type {
  KnowledgeConnectInput,
  KnowledgeConnectOutput,
  KnowledgeExtractInput,
  KnowledgeExtractOutput,
  KnowledgeQueryInput,
  KnowledgeQueryOutput,
} from "./definition.js";

// Types for dynamic imports
type NodeRow = {
  id: string;
  resource: string;
  hash: string;
  kind: string;
  label: string;
  properties: unknown;
  created: Date;
  updated: Date;
};

type EdgeRow = {
  id: string;
  resource: string;
  hash: string;
  fromId: string;
  toId: string;
  kind: string;
  weight: number;
  metadata: unknown;
  created: Date;
};

type NodeSeed = {
  resource: string;
  hash: string;
  kind: string;
  label: string;
  properties?: unknown;
};

type KnowledgeEntry = {
  hash: string;
  data: {
    _: "fact" | "relation" | "insight" | "pattern";
    content?: string;
    confidence?: number;
    source?: string;
    from?: string;
    to?: string;
    kind?: string;
    weight?: number;
    conclusion?: string;
    premises?: string[];
    rule?: string;
    accuracy?: number;
    examples?: string[];
  };
};

/**
 * Execute knowledge_query
 * Searches the knowledge graph using natural language
 */
export async function executeQuery(input: KnowledgeQueryInput): Promise<KnowledgeQueryOutput> {
  // Dynamic imports to avoid bundling issues
  const graphPkg = "@alfred/db/repo/graph";
  const graphRepo = await import(graphPkg);

  const limit = input.limit ?? 10;

  // Build in-memory hypergraph from database nodes
  // For simplicity, we query nodes directly and use text matching
  const allNodes: NodeRow[] = await graphRepo.findNodesByKind("fact", limit * 3);

  // Filter by resource if specified
  const filteredNodes = input.resource
    ? allNodes.filter((n: NodeRow) => n.resource === input.resource)
    : allNodes;

  // Simple text-based search using query terms
  const queryLower = input.query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t: string) => t.length > 2);

  type ScoredNode = { node: NodeRow; score: number };
  const scoredNodes: ScoredNode[] = filteredNodes
    .map((node: NodeRow): ScoredNode => {
      const labelLower = node.label.toLowerCase();
      let score = 0;
      for (const term of queryTerms) {
        if (labelLower.includes(term)) {
          score += 1;
        }
      }
      return { node, score };
    })
    .filter((item: ScoredNode) => item.score > 0)
    .sort((a: ScoredNode, b: ScoredNode) => b.score - a.score)
    .slice(0, limit);

  const nodes = scoredNodes.map((item: ScoredNode) => ({
    id: item.node.id,
    label: item.node.label,
    kind: item.node.kind,
    properties: (item.node.properties as Record<string, unknown>) ?? undefined,
  }));

  // Include edges if requested
  let edges: KnowledgeQueryOutput["edges"];
  if (input.includeEdges && nodes.length > 0) {
    const nodeIds = new Set(nodes.map((n: { id: string }) => n.id));
    const allEdges: Array<{ fromId: string; toId: string; kind: string }> = [];

    for (const node of nodes) {
      const outbound: EdgeRow[] = await graphRepo.getOutboundEdges(node.id);
      for (const edge of outbound) {
        if (nodeIds.has(edge.toId)) {
          allEdges.push({
            fromId: edge.fromId,
            toId: edge.toId,
            kind: edge.kind,
          });
        }
      }
    }

    edges = allEdges;
  }

  logger.debug("knowledge_query_executed", {
    query: input.query,
    resultCount: nodes.length,
    includeEdges: input.includeEdges,
  });

  return {
    nodes,
    edges,
    total: nodes.length,
  };
}

/**
 * Execute knowledge_extract
 * Extracts facts and relations from text and persists to graph
 */
export async function executeExtract(input: KnowledgeExtractInput): Promise<KnowledgeExtractOutput> {
  const knowledgePkg = "@alfred/knowledge";
  const graphPkg = "@alfred/db/repo/graph";

  const knowledge = await import(knowledgePkg);
  const graphRepo = await import(graphPkg);

  const { extract, toKnowledge } = knowledge;
  const { upsertNodes } = graphRepo;

  const resource = input.resource ?? "user";

  // Extract knowledge from text
  const extractionResult = extract(input.content, input.source);

  // Convert to knowledge entries
  const entries: KnowledgeEntry[] = toKnowledge(extractionResult);

  if (entries.length === 0) {
    logger.info("knowledge_extract_empty", { source: input.source });
    return {
      extracted: 0,
      facts: [],
      relations: [],
    };
  }

  // Prepare node seeds for upsert
  const nodeSeedsMap = new Map<string, NodeSeed>();

  for (const entry of entries) {
    const data = entry.data;

    if (data._ === "fact" && data.content) {
      nodeSeedsMap.set(entry.hash, {
        resource,
        hash: entry.hash,
        kind: "fact",
        label: data.content,
        properties: {
          confidence: input.confidence ?? data.confidence,
          source: data.source,
        },
      });
    } else if (data._ === "relation" && data.from && data.to) {
      // Relations become edges - we need the node IDs
      // For now, store relation as a node too for simpler implementation
      nodeSeedsMap.set(entry.hash, {
        resource,
        hash: entry.hash,
        kind: "relation",
        label: `${data.from} ${data.kind} ${data.to}`,
        properties: {
          from: data.from,
          to: data.to,
          relationKind: data.kind,
          weight: data.weight,
        },
      });
    } else if (data._ === "insight" && data.conclusion) {
      nodeSeedsMap.set(entry.hash, {
        resource,
        hash: entry.hash,
        kind: "insight",
        label: data.conclusion,
        properties: {
          confidence: data.confidence,
          premises: data.premises,
        },
      });
    } else if (data._ === "pattern" && data.rule) {
      nodeSeedsMap.set(entry.hash, {
        resource,
        hash: entry.hash,
        kind: "pattern",
        label: data.rule,
        properties: {
          accuracy: data.accuracy,
          examples: data.examples,
        },
      });
    }
  }

  const nodeSeeds = Array.from(nodeSeedsMap.values());

  // Upsert nodes
  const nodeMap: Map<string, NodeRow> = await upsertNodes(nodeSeeds);

  // Build response
  const facts: KnowledgeExtractOutput["facts"] = [];
  const relations: KnowledgeExtractOutput["relations"] = [];

  for (const [, row] of nodeMap.entries()) {
    if (row.kind === "fact" || row.kind === "insight" || row.kind === "pattern") {
      facts.push({
        id: row.id,
        label: row.label,
        kind: row.kind,
      });
    } else if (row.kind === "relation") {
      // Extract relation info from properties
      const props = row.properties as Record<string, unknown> | null;
      if (props?.from && props?.to) {
        relations.push({
          fromId: String(props.from),
          toId: String(props.to),
          kind: String(props.relationKind ?? "relates_to"),
        });
      }
    }
  }

  logger.info("knowledge_extract_completed", {
    source: input.source,
    extracted: facts.length,
    relations: relations.length,
  });

  return {
    extracted: facts.length,
    facts,
    relations,
  };
}

/**
 * Execute knowledge_connect
 * Creates an edge between two nodes in the knowledge graph
 */
export async function executeConnect(input: KnowledgeConnectInput): Promise<KnowledgeConnectOutput> {
  const graphPkg = "@alfred/db/repo/graph";
  const graphRepo = await import(graphPkg);

  const { getNode, upsertEdges } = graphRepo;

  const resource = input.resource ?? "user";
  const kind = input.kind ?? "relates_to";

  // Validate nodes exist
  const fromNode: NodeRow | null = await getNode(input.fromId);
  if (!fromNode) {
    throw new Error(`knowledge_node_not_found: ${input.fromId}`);
  }

  const toNode: NodeRow | null = await getNode(input.toId);
  if (!toNode) {
    throw new Error(`knowledge_node_not_found: ${input.toId}`);
  }

  // Generate hash for edge
  const hash = `${input.fromId}-${input.toId}-${kind}`;

  // Create edge
  const edges: EdgeRow[] = await upsertEdges([
    {
      resource,
      hash,
      fromId: input.fromId,
      toId: input.toId,
      kind,
      weight: 1,
      metadata: input.properties ?? null,
    },
  ]);

  const edge = edges[0];
  if (!edge) {
    throw new Error("knowledge_edge_creation_failed");
  }

  logger.info("knowledge_connect_completed", {
    fromId: input.fromId,
    toId: input.toId,
    kind,
    edgeId: edge.id,
  });

  return {
    edgeId: edge.id,
    fromId: edge.fromId,
    toId: edge.toId,
    kind: edge.kind,
  };
}
