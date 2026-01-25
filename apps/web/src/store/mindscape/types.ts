/**
 * Mindscape Store Types - ReactFlow Isolated
 *
 * This is the ONLY store module that imports @xyflow/react types.
 * All ReactFlow state management for the Mindscape infinite canvas lives here.
 *
 * @see docs/execplans/desktop-type-migration.md Section 2.4
 */

import type {
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  Viewport,
} from "@xyflow/react";

import type { EdgeData } from "@/store/desktop/types.new";

// ─────────────────────────────────────────────────────────────────────────────
// MINDSCAPE NODE DATA — Entity information for Mindscape nodes
// ─────────────────────────────────────────────────────────────────────────────

export interface MindscapeNodeData extends Record<string, unknown> {
  entityId: string;
  entityType: string;
  label: string;
  confidence?: number;
  archived?: boolean;
  description?: string;
  hgHash?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MINDSCAPE TYPES — ReactFlow-specific types
// ─────────────────────────────────────────────────────────────────────────────

export type MindscapeNode = Node<MindscapeNodeData>;
export type MindscapeEdge = Edge<EdgeData>;
export type MindscapeViewport = Viewport; // { x, y, zoom }

// ─────────────────────────────────────────────────────────────────────────────
// MINDSCAPE SLICE — ReactFlow state management
// ─────────────────────────────────────────────────────────────────────────────

export interface MindscapeSlice {
  // State (ReactFlow types)
  nodes: MindscapeNode[];
  edges: MindscapeEdge[];
  viewport: MindscapeViewport;
  selectedNodeIds: string[];

  // ReactFlow callbacks (ONLY place these exist in the codebase)
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
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
  setViewport: (viewport: MindscapeViewport) => void;
  fitView: () => void;
  panTo: (x: number, y: number) => void;
  zoomTo: (zoom: number) => void;

  // Layout
  autoLayout: () => void;

  // Integration with Desktop
  spawnFromWindow: (windowId: string) => void;
  openInDesktop: (nodeId: string) => void;

  // Active edges (for animations)
  activeEdges: Set<string>;
  highlightedEdgeIds: Set<string>;
  setHighlightedEdges: (edgeIds: string[]) => void;
  triggerEdgeActivity: (edgeId: string, durationMs?: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MINDSCAPE STATE — Full store type
// ─────────────────────────────────────────────────────────────────────────────

export type MindscapeState = MindscapeSlice;
