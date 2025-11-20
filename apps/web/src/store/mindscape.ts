import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import { create } from "zustand";
import { getLayoutedElements } from "@/lib/layout";

export type ArtifactType =
  | "chat"
  | "workflow"
  | "tool"
  | "result"
  | "terminal"
  | "data"
  | "preview";

export type ArtifactData = Record<string, unknown> & {
  label?: string;
  type?: ArtifactType;
};

type MindscapeState = {
  nodes: Node<ArtifactData>[];
  edges: Edge[];
  focusedNodeId: string | null;
  isSpaceMode: boolean;

  // React Flow actions
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Mindscape actions
  addArtifact: (node: Node<ArtifactData>) => void;
  removeArtifact: (nodeId: string) => void;
  updateArtifactData: (nodeId: string, data: Partial<ArtifactData>) => void;
  focusNode: (nodeId: string | null) => void;
  setSpaceMode: (isSpaceMode: boolean) => void;
  setNodes: (nodes: Node<ArtifactData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  autoLayout: () => void;
};

export const useMindscapeStore = create<MindscapeState>((set, get) => ({
  nodes: [],
  edges: [],
  focusedNodeId: null,
  isSpaceMode: false,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },

  addArtifact: (node) => {
    set((state) => ({
      nodes: [...state.nodes, node],
    }));
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
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...data },
          };
        }
        return node;
      }),
    }));
  },
  focusNode: (nodeId) => {
    set({ focusedNodeId: nodeId });
  },
  setSpaceMode: (isSpaceMode) => {
    set({ isSpaceMode });
  },
  setNodes: (nodes) => {
    set({ nodes });
  },
  setEdges: (edges) => {
    set({ edges });
  },
  autoLayout: () => {
    const { nodes, edges } = get();
    const layoutedNodes = getLayoutedElements(nodes, edges);
    set({ nodes: layoutedNodes });
  },
}));
