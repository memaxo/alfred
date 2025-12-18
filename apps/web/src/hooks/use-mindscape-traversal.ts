import { parseEntityFactLabel } from "@alfred/knowledge/entity";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { MINDSCAPE_CONFIG } from "@/config/mindscape";
import { type ArtifactData, useMindscapeStore } from "@/store/mindscape";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";

type GraphNode =
  inferRouterOutputs<TRPCAppRouter>["graph"]["runQuery"]["nodes"][number];

export function useMindscapeTraversal() {
  const { nodes, focusedNodeId, addArtifact, setEdges, edges } =
    useMindscapeStore(
      useShallow((state) => ({
        nodes: state.nodes,
        focusedNodeId: state.focusedNodeId,
        addArtifact: state.addArtifact,
        setEdges: state.setEdges,
        edges: state.edges,
      }))
    );

  const focusedNode = useMemo(
    () => nodes.find((n) => n.id === focusedNodeId),
    [nodes, focusedNodeId]
  );

  // Get the DB ID of the focused node if it exists
  const focusedDbId = focusedNode?.data?.graph?.dbId;

  // Query for neighbors when a node is focused
  const { data: traversalResult, isFetching } = trpc.graph.runQuery.useQuery(
    focusedDbId
      ? {
          kind: "traverse",
          nodeId: focusedDbId,
          resource: "user",
          limit: 5, // Expand by 5 neighbors
          direction: "both",
        }
      : { kind: "traverse", nodeId: "noop", resource: "user" }, // No-op query
    {
      enabled: Boolean(focusedDbId),
      staleTime: 60_000, // Cache for 1 minute
    }
  );

  // Merge traversal results into the graph
  useEffect(() => {
    if (!(traversalResult && focusedDbId)) return;

    const isConceptNode = (node: GraphNode) =>
      node.kind === "fact" &&
      typeof node.label === "string" &&
      Boolean(parseEntityFactLabel(node.label));

    const kindByDbId = new Map<string, "concept" | "knowledge">();
    traversalResult.nodes.forEach((node: GraphNode) => {
      const nodeId = node.id as {
        uiId?: string;
        dbId?: string;
        hgHash?: string;
      };
      const dbId = nodeId.dbId ?? nodeId.uiId ?? nodeId.hgHash;
      if (!dbId) {
        return;
      }
      kindByDbId.set(dbId, isConceptNode(node) ? "concept" : "knowledge");
    });

    // 1. Add Nodes
    traversalResult.nodes.forEach((node: GraphNode, index: number) => {
      // Handle union type - access properties that may or may not exist
      const nodeId = node.id as {
        uiId?: string;
        dbId?: string;
        hgHash?: string;
      };
      const ref = nodeId.dbId ?? nodeId.hgHash ?? nodeId.uiId;
      if (!ref) return;

      const isConcept = isConceptNode(node);

      // Check if node already exists (by dbId or ID)
      const exists = nodes.some(
        (n) =>
          n.data?.graph?.dbId === ref ||
          n.id === `knowledge-${ref}` ||
          n.id === `concept-${ref}`
      );
      if (exists) return;

      // Spawn new node
      const flowId = isConcept ? `concept-${ref}` : `knowledge-${ref}`;
      const props = (node.properties ?? {}) as Record<string, unknown>;
      const summary =
        typeof props.content === "string" ? props.content : undefined;

      // Calculate position: radial expansion around focused node
      const angle = (index / traversalResult.nodes.length) * 2 * Math.PI;
      const radius = MINDSCAPE_CONFIG.SPAWN_RADIUS;
      const parentPos = focusedNode?.position ?? { x: 0, y: 0 };

      const x = parentPos.x + radius * Math.cos(angle);
      const y = parentPos.y + radius * Math.sin(angle);

      if (isConcept) {
        const parsed = parseEntityFactLabel(node.label ?? "");
        const confidence =
          typeof props.confidence === "number" ? props.confidence : undefined;
        addArtifact({
          id: flowId,
          type: "concept",
          position: { x, y },
          data: {
            type: "concept",
            label: parsed?.label ?? node.label,
            entityType: parsed?.entityType,
            confidence,
            archived:
              typeof props.archived === "string" ? props.archived : undefined,
            description:
              typeof props.description === "string"
                ? props.description
                : undefined,
            graph: {
              dbId: nodeId.dbId,
              hgHash: nodeId.hgHash,
            },
          } as ArtifactData,
        });
        return;
      }

      addArtifact({
        id: flowId,
        type: "knowledge",
        position: { x, y },
        data: {
          type: "knowledge",
          label: node.label,
          kind: node.kind,
          summary,
          source: "runtime",
          graph: {
            dbId: nodeId.dbId,
            hgHash: nodeId.hgHash,
          },
        } as ArtifactData,
      });
    });

    // 2. Add Edges (we need to fetch edges separately or rely on graph.runQuery returning them if modified)
    // Currently graph.runQuery returns nodes and edges.

    if (traversalResult.edges) {
      const newEdges = traversalResult.edges.map((edge: any) => {
        const sourceKind = kindByDbId.get(edge.fromId) ?? "knowledge";
        const targetKind = kindByDbId.get(edge.toId) ?? "knowledge";

        const sourceFallback = `${sourceKind}-${edge.fromId}`;
        const targetFallback = `${targetKind}-${edge.toId}`;

        const sourceId =
          nodes.find((n) => n.data?.graph?.dbId === edge.fromId)?.id ??
          sourceFallback;
        const targetId =
          nodes.find((n) => n.data?.graph?.dbId === edge.toId)?.id ??
          targetFallback;

        return {
          id: edge.id,
          source: sourceId,
          target: targetId,
          data: {
            kind: edge.kind,
            fromDbId: edge.fromId,
            toDbId: edge.toId,
          },
          style: { stroke: "rgba(255, 255, 255, 0.2)" },
        };
      });

      // Merge edges
      const edgeMap = new Map(edges.map((e) => [e.id, e]));
      newEdges.forEach((e: any) => edgeMap.set(e.id, e));
      setEdges(Array.from(edgeMap.values()));
    }
  }, [
    traversalResult,
    focusedDbId,
    focusedNode,
    nodes,
    edges,
    addArtifact,
    setEdges,
  ]);

  return { isFetching };
}
