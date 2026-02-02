/**
 * Mindscape Store - ReactFlow isolated state management
 *
 * ⚠️ ISOLATION BOUNDARY: This is the ONLY store that imports @xyflow/react.
 * Desktop store must NOT import ReactFlow types.
 *
 * @see docs/execplans/desktop-evolution-prd.md Part V
 */

import type {
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  Viewport,
} from "@xyflow/react";

import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { WindowType } from "@/store/desktop/types.new";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type MindscapeNodeType =
  | "entity"
  | "concept"
  | "note"
  | "conversation"
  | "window"
  | "app"
  | "agent";

export interface MindscapeNodeData extends Record<string, unknown> {
  label: string;
  type: MindscapeNodeType;
  description?: string;
  color?: string;
  icon?: string;
  sourceWindowId?: string;
  sourceIconId?: string;
  windowType?: WindowType;
  metadata?: Record<string, unknown>;
  // Entity specific
  entityId?: string;
  entityType?: string;
  confidence?: number;
  archived?: boolean;
  hgHash?: string;
}

export interface MindscapeEdgeData extends Record<string, unknown> {
  label?: string;
  type: "relation" | "reference" | "spawn" | "dependency";
  weight?: number;
}

export type MindscapeNode = Node<MindscapeNodeData>;
export type MindscapeEdge = Edge<MindscapeEdgeData>;

export interface MindscapeStore {
  // State
  nodes: MindscapeNode[];
  edges: MindscapeEdge[];
  viewport: Viewport;
  selectedNodeIds: string[];
  isActive: boolean;

  // ReactFlow callbacks
  onNodesChange: OnNodesChange<MindscapeNode>;
  onEdgesChange: OnEdgesChange<MindscapeEdge>;
  onConnect: OnConnect;

  // Node CRUD
  addNode: (node: MindscapeNode) => void;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, data: Partial<MindscapeNodeData>) => void;

  // Edge CRUD
  addEdge: (edge: MindscapeEdge) => void;
  removeEdge: (edgeId: string) => void;

  // Selection
  selectNode: (nodeId: string) => void;
  selectNodes: (nodeIds: string[]) => void;
  clearSelection: () => void;

  // Viewport
  setViewport: (viewport: Viewport) => void;
  fitView: () => void;
  panTo: (x: number, y: number) => void;
  zoomTo: (zoom: number) => void;

  // Activation
  activate: () => void;
  deactivate: () => void;
  toggle: () => void;

  // Desktop integration
  spawnFromWindow: (
    windowId: string,
    label: string,
    position?: { x: number; y: number }
  ) => void;
  spawnFromIcon: (
    iconId: string,
    windowType: WindowType,
    label: string,
    position?: { x: number; y: number }
  ) => void;
  openInDesktop: (nodeId: string) => string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialNodes: MindscapeNode[] = [
  {
    id: "root",
    type: "entity",
    position: { x: 0, y: 0 },
    data: { label: "ALFRED", type: "concept", description: "AI Assistant" },
  },
];

const initialEdges: MindscapeEdge[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useMindscapeStore = create<MindscapeStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        nodes: initialNodes,
        edges: initialEdges,
        viewport: { x: 0, y: 0, zoom: 1 },
        selectedNodeIds: [],
        isActive: false,

        // ReactFlow callbacks
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

        onConnect: (connection) => {
          const newEdge: MindscapeEdge = {
            ...connection,
            id: `e-${connection.source}-${connection.target}`,
            data: { type: "relation" },
          };
          set({
            edges: addEdge(newEdge, get().edges),
          });
        },

        // Node CRUD
        addNode: (node) => {
          set({ nodes: [...get().nodes, node] });
        },

        removeNode: (nodeId) => {
          set({
            nodes: get().nodes.filter((n) => n.id !== nodeId),
            edges: get().edges.filter(
              (e) => e.source !== nodeId && e.target !== nodeId
            ),
          });
        },

        updateNode: (nodeId, data) => {
          set({
            nodes: get().nodes.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
            ),
          });
        },

        // Edge CRUD
        addEdge: (edge) => {
          set({ edges: [...get().edges, edge] });
        },

        removeEdge: (edgeId) => {
          set({ edges: get().edges.filter((e) => e.id !== edgeId) });
        },

        // Selection
        selectNode: (nodeId) => {
          set({ selectedNodeIds: [nodeId] });
        },

        selectNodes: (nodeIds) => {
          set({ selectedNodeIds: nodeIds });
        },

        clearSelection: () => {
          set({ selectedNodeIds: [] });
        },

        // Viewport
        setViewport: (viewport) => {
          set({ viewport });
        },

        fitView: () => {
          // Trigger fit view - actual implementation in canvas component
        },

        panTo: (x, y) => {
          set({ viewport: { ...get().viewport, x, y } });
        },

        zoomTo: (zoom) => {
          set({ viewport: { ...get().viewport, zoom } });
        },

        // Activation
        activate: () => set({ isActive: true }),
        deactivate: () => set({ isActive: false }),
        toggle: () => set((state) => ({ isActive: !state.isActive })),

        // Desktop integration
        spawnFromWindow: (windowId, label, position) => {
          const pos = position ?? {
            x: Math.random() * 400 - 200,
            y: Math.random() * 400 - 200,
          };
          const node: MindscapeNode = {
            id: `window-${windowId}`,
            type: "entity",
            position: pos,
            data: {
              label,
              type: "window",
              sourceWindowId: windowId,
            },
          };
          get().addNode(node);
        },

        spawnFromIcon: (iconId, windowType, label, position) => {
          const pos = position ?? {
            x: Math.random() * 400 - 200,
            y: Math.random() * 400 - 200,
          };
          const node: MindscapeNode = {
            id: `app-${iconId}`,
            type: "entity",
            position: pos,
            data: {
              label,
              type: "app",
              sourceIconId: iconId,
              windowType,
            },
          };
          get().addNode(node);
        },

        openInDesktop: (nodeId: string): string | null => {
          const node = get().nodes.find((n) => n.id === nodeId);
          if (!node) {
            return null;
          }
          if ("sourceWindowId" in node.data && node.data.sourceWindowId) {
            return node.data.sourceWindowId;
          }
          return null;
        },
      }),
      {
        name: "alfred-mindscape",
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges,
          viewport: state.viewport,
        }),
      }
    ),
    { name: "MindscapeStore" }
  )
);
