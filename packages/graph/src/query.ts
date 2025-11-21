import type { Hypergraph } from "@alfred/knowledge/hypergraph";
import type { UnifiedEdge, UnifiedNode } from "./unified.js";

export type QueryKind = "traverse" | "path" | "datalog" | "semantic";

export type UnifiedQuery =
  | {
      kind: "traverse";
      nodeId: string;
      direction?: "in" | "out" | "both";
      resource?: string;
      edgeKind?: string;
      limit?: number;
    }
  | {
      kind: "path";
      fromId: string;
      toId: string;
      maxDepth?: number;
      resource?: string;
    }
  | {
    kind: "datalog";
    query: string;
  }
  | {
      kind: "semantic";
      text: string;
      topK?: number;
      preferRag?: boolean;
    };

export type UnifiedQueryResult = {
  nodes: UnifiedNode[];
  edges?: UnifiedEdge[];
};

export async function runQuery(
  _query: UnifiedQuery,
  _context: { graph?: Hypergraph; resource?: string }
): Promise<UnifiedQueryResult> {
  throw new Error("runQuery not implemented");
}
