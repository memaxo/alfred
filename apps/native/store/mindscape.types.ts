export interface MindscapeViewport {
  x: number;
  y: number;
  zoom: number;
}

export type MindscapeNodeType =
  | "entity"
  | "concept"
  | "note"
  | "conversation"
  | "window"
  | "agent";

export interface MindscapeNodeData {
  label: string;
  type: MindscapeNodeType;
  description?: string;
  color?: string;
  icon?: string;
  sourceWindowId?: string;
  entityId?: string;
  entityType?: string;
  confidence?: number;
  archived?: boolean;
  hgHash?: string;
}

export interface MindscapeEdgeData {
  label?: string;
  type: "relation" | "reference" | "spawn" | "dependency";
  weight?: number;
}

export interface MindscapeNode {
  id: string;
  position: { x: number; y: number };
  data: MindscapeNodeData;
}

export interface MindscapeEdge {
  id: string;
  source: string;
  target: string;
  data: MindscapeEdgeData;
}
