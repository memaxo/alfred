import { create } from "zustand";

import type {
  MindscapeEdge,
  MindscapeNode,
  MindscapeNodeData,
  MindscapeViewport,
} from "./mindscape.types";

type MindscapeState = {
  nodes: MindscapeNode[];
  edges: MindscapeEdge[];
  viewport: MindscapeViewport;
  selectedNodeIds: string[];
  activeEdgeIds: string[];

  addNode: (node: MindscapeNode) => void;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, data: Partial<MindscapeNodeData>) => void;

  addEdge: (edge: MindscapeEdge) => void;
  removeEdge: (edgeId: string) => void;

  selectNode: (nodeId: string) => void;
  clearSelection: () => void;

  setViewport: (viewport: MindscapeViewport) => void;
  panBy: (dx: number, dy: number) => void;
  zoomTo: (zoom: number) => void;

  spawnFromWindow: (args: {
    windowId: string;
    label: string;
    windowType: string;
  }) => string;
  pulseEdge: (edgeId: string) => void;
};

function clamp(n: number, min: number, max: number) {
  if (n < min) {
    return min;
  }
  if (n > max) {
    return max;
  }
  return n;
}

const initialNodes: MindscapeNode[] = [
  {
    id: "root",
    position: { x: 0, y: 0 },
    data: { label: "ALFRED", type: "concept", description: "AI Assistant" },
  },
];

export const useMindscapeStore = create<MindscapeState>((set, get) => ({
  nodes: initialNodes,
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeIds: [],
  activeEdgeIds: [],

  addNode: (node) => set((s) => ({ nodes: s.nodes.concat(node) })),
  removeNode: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeIds: s.selectedNodeIds.filter((id) => id !== nodeId),
    })),
  updateNode: (nodeId, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),

  addEdge: (edge) => set((s) => ({ edges: s.edges.concat(edge) })),
  removeEdge: (edgeId) =>
    set((s) => ({ edges: s.edges.filter((e) => e.id !== edgeId) })),

  selectNode: (nodeId) => set({ selectedNodeIds: [nodeId] }),
  clearSelection: () => set({ selectedNodeIds: [] }),

  setViewport: (viewport) =>
    set({ viewport: { ...viewport, zoom: clamp(viewport.zoom, 0.25, 3) } }),
  panBy: (dx, dy) => {
    const v = get().viewport;
    set({ viewport: { ...v, x: v.x + dx, y: v.y + dy } });
  },
  zoomTo: (zoom) => {
    const v = get().viewport;
    set({ viewport: { ...v, zoom: clamp(zoom, 0.25, 3) } });
  },

  spawnFromWindow: ({ windowId, label, windowType }) => {
    const nodeId = `window_${windowId}`;
    const existing = get().nodes.find((n) => n.id === nodeId);
    if (existing) {
      set({ selectedNodeIds: [nodeId] });
      return nodeId;
    }
    const base = get().nodes.length * 80;
    const node: MindscapeNode = {
      id: nodeId,
      position: { x: base, y: base },
      data: {
        label,
        type: "window",
        sourceWindowId: windowId,
        entityType: windowType,
      },
    };
    set((s) => ({ nodes: s.nodes.concat(node), selectedNodeIds: [nodeId] }));
    return nodeId;
  },

  pulseEdge: (edgeId) => {
    set((s) => ({
      activeEdgeIds: s.activeEdgeIds.includes(edgeId)
        ? s.activeEdgeIds
        : s.activeEdgeIds.concat(edgeId),
    }));
    setTimeout(() => {
      set((s) => ({
        activeEdgeIds: s.activeEdgeIds.filter((id) => id !== edgeId),
      }));
    }, 800);
  },
}));
