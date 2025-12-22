import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import type { StateCreator } from "zustand";
import { getLayoutedElements, getSemanticLayoutedElements } from "@/lib/layout";
import type { ArtifactData } from "../mindscape.schemas";
import { getNodeDataSchema } from "../mindscape.schemas";
import type { MindscapeState } from "./types";

export const createGraphSlice: StateCreator<
  MindscapeState,
  [],
  [],
  Pick<
    MindscapeState,
    | "nodes"
    | "edges"
    | "activeEdges"
    | "highlightedEdgeIds"
    | "focusedNodeId"
    | "isSpaceMode"
    | "onNodesChange"
    | "onEdgesChange"
    | "onConnect"
    | "addArtifact"
    | "removeArtifact"
    | "updateArtifactData"
    | "focusNode"
    | "setSpaceMode"
    | "setNodes"
    | "setEdges"
    | "setHighlightedEdges"
    | "triggerEdgeActivity"
    | "triggerNodeActivity"
    | "autoLayout"
  >
> = (set, get) => ({
  nodes: [],
  edges: [],
  activeEdges: new Set(),
  highlightedEdgeIds: new Set(),
  focusedNodeId: null,
  isSpaceMode: false,

  onNodesChange: (changes) => {
    set({
      // applyNodeChanges preserves the node data type
      nodes: applyNodeChanges(changes, get().nodes) as MindscapeState["nodes"],
    });
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },

  addArtifact: (node) => {
    set((state) => {
      if (state.nodes.some((n) => n.id === node.id)) {
        return state;
      }
      return {
        nodes: [...state.nodes, node],
      };
    });
  },
  removeArtifact: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
    }));
  },
  updateArtifactData: (nodeId, data) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }

    const nodeType = node.type || (node.data as ArtifactData).type;
    const schema = getNodeDataSchema(nodeType);

    const mergedGraph =
      data.graph !== undefined
        ? { ...(node.data.graph ?? {}), ...data.graph }
        : node.data.graph;
    const mergedData = {
      ...node.data,
      ...data,
      graph: mergedGraph,
    };

    const result = schema.safeParse(mergedData);
    if (!result.success) {
      return;
    }

    const validatedData = result.data as Record<string, unknown>;
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: { ...n.data, ...validatedData } as ArtifactData,
          };
        }
        return n;
      }),
    }));
  },
  focusNode: (nodeId) => {
    set({ focusedNodeId: nodeId });
  },
  setSpaceMode: (isSpaceMode) => {
    set({ isSpaceMode });
  },
  setNodes: (nodesOrUpdater) => {
    set((state) => {
      const newNodes =
        typeof nodesOrUpdater === "function"
          ? nodesOrUpdater(state.nodes)
          : nodesOrUpdater;
      return { nodes: newNodes };
    });
  },
  setEdges: (edges) => {
    set((state) => {
      if (edges.length === state.edges.length) {
        const allMatch = edges.every((e, i) => e.id === state.edges[i]?.id);
        if (allMatch) {
          return state;
        }
      }
      return { edges };
    });
  },
  setHighlightedEdges: (edgeIds) => {
    set({ highlightedEdgeIds: new Set(edgeIds) });
  },
  triggerEdgeActivity: (edgeId, durationMs = 2000) => {
    set((state) => {
      const next = new Set(state.activeEdges);
      next.add(edgeId);
      return { activeEdges: next };
    });

    setTimeout(() => {
      set((state) => {
        const next = new Set(state.activeEdges);
        next.delete(edgeId);
        return { activeEdges: next };
      });
    }, durationMs);
  },
  triggerNodeActivity: (nodeId, _type) => {
    const { edges, triggerEdgeActivity } = get();
    const connectedEdges = edges.filter(
      (e) => e.source === nodeId || e.target === nodeId
    );
    connectedEdges.forEach((edge) => {
      triggerEdgeActivity(edge.id, 1000);
    });
  },
  autoLayout: () => {
    const { nodes, edges, focusedNodeId } = get();
    const shouldUseSemantic =
      edges.length > 0 || nodes.some((node) => Boolean(node.data?.graph?.dbId));
    const layoutedNodes = shouldUseSemantic
      ? getSemanticLayoutedElements(nodes, edges, {
          focusId: focusedNodeId,
        })
      : getLayoutedElements(nodes, edges);
    set({ nodes: layoutedNodes });
  },
});
