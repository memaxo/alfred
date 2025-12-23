/**
 * Edge Connection Persistence Hook for Mindscape.
 *
 * Handles edge creation with optimistic updates and rollback on failure.
 * Validates graph-backed nodes and persists connections to the backend.
 */

import type { OnConnect } from "@xyflow/react";
import { useCallback } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useMindscapeStore } from "@/store/mindscape";
import { trpc } from "@/utils/trpc";

export type UseEdgePersistenceResult = {
  onConnectPersisting: OnConnect;
};

export function useEdgePersistence(): UseEdgePersistenceResult {
  const { nodes, onConnect } = useMindscapeStore(
    useShallow((state) => ({
      nodes: state.nodes,
      onConnect: state.onConnect,
    }))
  );

  const { mutateAsync: connectEdge } = trpc.graph.connect.useMutation();

  const onConnectPersisting = useCallback<OnConnect>(
    async (connection) => {
      const beforeEdges = useMindscapeStore.getState().edges;
      const beforeCount = beforeEdges.length;

      // Apply optimistic update
      onConnect(connection);

      const afterEdges = useMindscapeStore.getState().edges;
      const added = afterEdges.slice(beforeCount);
      const localEdge =
        added.find(
          (edge) =>
            edge.source === connection.source &&
            edge.target === connection.target
        ) ?? added[0];
      if (!localEdge) {
        return;
      }

      // Rollback helper
      const rollback = () => {
        if (!localEdge?.id) {
          return;
        }
        useMindscapeStore.setState((state) => ({
          edges: state.edges.filter((edge) => edge.id !== localEdge.id),
        }));
      };

      // Validate graph-backed nodes
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      const fromGraph = sourceNode?.data?.graph;
      const toGraph = targetNode?.data?.graph;
      const fromId = fromGraph?.dbId;
      const toId = toGraph?.dbId;
      const fromResource = fromGraph?.resource;
      const toResource = toGraph?.resource;

      if (!(fromId && toId)) {
        toast.error("Only graph-backed nodes can be linked.");
        rollback();
        return;
      }
      if (fromResource && toResource && fromResource !== toResource) {
        toast.error("Cannot link nodes from different resources.");
        rollback();
        return;
      }
      const resource = fromResource ?? toResource;
      if (!resource) {
        toast.error("Cannot link nodes without a resource.");
        rollback();
        return;
      }

      // Persist to backend
      try {
        await connectEdge({
          fromId,
          toId,
          kind: "relates_to",
          resource,
        });
      } catch (_error) {
        toast.error("Failed to persist edge.");
        rollback();
      }
    },
    [connectEdge, nodes, onConnect]
  );

  return { onConnectPersisting };
}
