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
import type { z } from "zod";
import {
  getNodeDataSchema,
  artifactNodeDataSchema,
  chatNodeDataSchema,
  codeNodeDataSchema,
  noteNodeDataSchema,
  orbNodeDataSchema,
  reminderNodeDataSchema,
  terminalNodeDataSchema,
  ticketNodeDataSchema,
  workflowNodeDataSchema,
} from "./mindscape.schemas";

export type ArtifactType =
  | "chat"
  | "workflow"
  | "tool"
  | "result"
  | "terminal"
  | "data"
  | "preview"
  | "note"
  | "reminder"
  | "ticket"
  | "code"
  | "artifact"
  | "orb";

/**
 * Individual node data types inferred from Zod schemas.
 */
export type CodeNodeData = z.infer<typeof codeNodeDataSchema> & { type: "code" };
export type ChatNodeData = z.infer<typeof chatNodeDataSchema> & { type: "chat" };
export type WorkflowNodeData = z.infer<typeof workflowNodeDataSchema> & {
  type: "workflow";
};
export type TicketNodeData = z.infer<typeof ticketNodeDataSchema> & {
  type: "ticket";
};
export type ReminderNodeData = z.infer<typeof reminderNodeDataSchema> & {
  type: "reminder";
};
export type NoteNodeData = z.infer<typeof noteNodeDataSchema> & { type: "note" };
export type TerminalNodeData = z.infer<typeof terminalNodeDataSchema> & {
  type: "terminal";
};
export type ArtifactNodeData = z.infer<typeof artifactNodeDataSchema> & {
  type: "artifact";
};
export type OrbNodeData = z.infer<typeof orbNodeDataSchema> & { type: "orb" };

/**
 * Discriminated union of all artifact data types.
 * The 'type' field determines which schema applies.
 */
export type ArtifactData =
  | CodeNodeData
  | ChatNodeData
  | WorkflowNodeData
  | TicketNodeData
  | ReminderNodeData
  | NoteNodeData
  | TerminalNodeData
  | ArtifactNodeData
  | OrbNodeData;

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

import { persist } from "zustand/middleware";

export const useMindscapeStore = create<MindscapeState>()(
  persist(
    (set, get) => ({
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
        const node = get().nodes.find((n) => n.id === nodeId);
        if (!node) {
          return;
        }

        // Determine node type from node.type or node.data.type
        const nodeType = node.type || (node.data as ArtifactData).type;
        const schema = getNodeDataSchema(nodeType);

        // Merge existing data with new data
        const mergedData = { ...node.data, ...data };

        // Validate merged data (use partial to allow partial updates)
        const result = schema.partial().safeParse(mergedData);

        if (!result.success) {
          // Log validation errors but don't crash (graceful degradation)
          console.warn(
            `Failed to validate node data for ${nodeId}:`,
            result.error.errors
          );
          return;
        }

        // Update only if validation succeeds
        set((state) => ({
          nodes: state.nodes.map((n) => {
            if (n.id === nodeId) {
              return {
                ...n,
                data: { ...n.data, ...result.data } as ArtifactData,
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
    }),
    {
      name: "mindscape-storage",
      partialize: (state) => ({
        nodes: state.nodes.map(sanitizeNodeForPersist),
        edges: state.edges,
        isSpaceMode: state.isSpaceMode,
        focusedNodeId: state.focusedNodeId,
      }),
    }
  )
);

function sanitizeNodeForPersist(node: Node<ArtifactData>): Node<ArtifactData> {
  const sanitizedData = sanitizeNodeData(node);
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    positionAbsolute: node.positionAbsolute,
    dragging: false,
    data: sanitizedData,
    draggable: node.draggable,
    height: node.height,
    width: node.width,
    selectable: node.selectable,
  } as Node<ArtifactData>;
}

function sanitizeNodeData(node: Node<ArtifactData>): ArtifactData {
  const data = (node.data ?? ({ label: node.id } as ArtifactData)) as ArtifactData;

  if (
    node.type === "chat" &&
    "messages" in data &&
    Array.isArray((data as ChatNodeData).messages)
  ) {
    const trimmed = (data as ChatNodeData).messages?.slice(-10);
    return { ...data, messages: trimmed } as ArtifactData;
  }

  return data;
}
