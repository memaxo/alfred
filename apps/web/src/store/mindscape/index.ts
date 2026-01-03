/**
 * Mindscape Store - ReactFlow Isolated
 *
 * This store manages all ReactFlow state for the Mindscape infinite canvas.
 * This is the ONLY store that imports @xyflow/react utilities.
 *
 * ⚠️ ISOLATION BOUNDARY: Do not import this store in components/desktop/ or store/desktop/
 *
 * @see docs/execplans/desktop-type-migration.md Section 2.4
 */

import {
  applyEdgeChanges,
  applyNodeChanges,
  addEdge as rfAddEdge,
} from "@xyflow/react";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type {
  MindscapeEdge,
  MindscapeNode,
  MindscapeNodeData,
  MindscapeState,
  MindscapeViewport,
} from "./types";

// Re-export types
export type {
  MindscapeEdge,
  MindscapeNode,
  MindscapeNodeData,
  MindscapeSlice,
  MindscapeState,
  MindscapeViewport,
} from "./types";

const DEFAULT_VIEWPORT: MindscapeViewport = { x: 0, y: 0, zoom: 1 };

export const useMindscapeStore = create<MindscapeState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        nodes: [],
        edges: [],
        viewport: DEFAULT_VIEWPORT,
        selectedNodeIds: [],
        activeEdges: new Set(),
        highlightedEdgeIds: new Set(),

        // ReactFlow callbacks
        onNodesChange: (changes) => {
          set({
            nodes: applyNodeChanges(changes, get().nodes) as MindscapeNode[],
          });
        },

        onEdgesChange: (changes) => {
          set({
            edges: applyEdgeChanges(changes, get().edges) as MindscapeEdge[],
          });
        },

        onConnect: (connection) => {
          set({
            edges: rfAddEdge(connection, get().edges),
          });
        },

        // Node CRUD
        addNode: (node) => {
          set((state) => {
            if (state.nodes.some((n) => n.id === node.id)) {
              return state;
            }
            return { nodes: [...state.nodes, node] };
          });
        },

        removeNode: (nodeId) => {
          set((state) => ({
            nodes: state.nodes.filter((n) => n.id !== nodeId),
            edges: state.edges.filter(
              (e) => e.source !== nodeId && e.target !== nodeId
            ),
            selectedNodeIds: state.selectedNodeIds.filter(
              (id) => id !== nodeId
            ),
          }));
        },

        updateNode: (nodeId, data) => {
          set((state) => ({
            nodes: state.nodes.map((n) => {
              if (n.id !== nodeId) {
                return n;
              }
              return {
                ...n,
                data: { ...n.data, ...data } as MindscapeNodeData,
              };
            }),
          }));
        },

        // Edge CRUD
        addEdge: (edge) => {
          set((state) => {
            if (state.edges.some((e) => e.id === edge.id)) {
              return state;
            }
            return { edges: [...state.edges, edge] };
          });
        },

        removeEdge: (edgeId) => {
          set((state) => ({
            edges: state.edges.filter((e) => e.id !== edgeId),
          }));
        },

        // Selection
        selectNode: (nodeId) => {
          set((state) => {
            if (state.selectedNodeIds.includes(nodeId)) {
              return state;
            }
            return { selectedNodeIds: [...state.selectedNodeIds, nodeId] };
          });
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
          // fitView is typically called via ReactFlow's useReactFlow hook
          // This is a placeholder for when we need to programmatically fit
        },

        panTo: (x, y) => {
          set((state) => ({
            viewport: { ...state.viewport, x, y },
          }));
        },

        zoomTo: (zoom) => {
          set((state) => ({
            viewport: {
              ...state.viewport,
              zoom: Math.max(0.1, Math.min(4, zoom)),
            },
          }));
        },

        // Layout
        autoLayout: () => {
          const { nodes } = get();
          if (nodes.length === 0) {
            return;
          }

          // Simple radial layout
          const centerX = 400;
          const centerY = 300;
          const radius = 200;
          const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);

          const layoutedNodes = nodes.map((node, index) => {
            const angle = index * angleStep - Math.PI / 2;
            return {
              ...node,
              position: {
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
              },
            };
          });

          set({ nodes: layoutedNodes });
        },

        // Integration with Desktop
        spawnFromWindow: (windowId) => {
          // Create a Mindscape node from a desktop window
          // This will be connected to the desktop store via a bridge
          const nodeId = `mindscape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const node: MindscapeNode = {
            id: nodeId,
            type: "default",
            position: { x: 400, y: 300 },
            data: {
              entityId: windowId,
              entityType: "window",
              label: `Window ${windowId}`,
            },
          };
          get().addNode(node);
        },

        openInDesktop: (_nodeId) => {
          // Open a Mindscape node as a desktop window
          // This will be connected to the desktop store via a bridge
          // Implementation will trigger desktop store's openWindow
        },

        // Edge highlighting
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

// Selectors
export const selectMindscapeNodes = (state: MindscapeState) => state.nodes;
export const selectMindscapeEdges = (state: MindscapeState) => state.edges;
export const selectMindscapeViewport = (state: MindscapeState) =>
  state.viewport;
export const selectSelectedNodeIds = (state: MindscapeState) =>
  state.selectedNodeIds;
