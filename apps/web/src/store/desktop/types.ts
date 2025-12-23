import type {
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from "@xyflow/react";

export type WindowType =
  | "chat"
  | "terminal"
  | "droid"
  | "note"
  | "reminder"
  | "todo"
  | "workflow"
  | "workflowlist"
  | "settings"
  | "integrations"
  | "knowledge"
  | "concept";

export type ResourceType =
  | "note"
  | "reminder"
  | "thread"
  | "workflow_run"
  | "preference"
  | "integration";

export type ViewMode = "compact" | "full" | "maximized";

export type ResourceRef = {
  type: ResourceType;
  id: string;
};

export type WindowData = {
  type: WindowType;
  label?: string;
  resourceRef?: ResourceRef;
  viewMode: ViewMode;
  draft?: unknown;
};

export type WindowInstance = Node<WindowData>;

export type EdgeKind =
  | "relates_to"
  | "blocks"
  | "depends_on"
  | "data_flow"
  | "explains"
  | "contains"
  | "member_of"
  | "part_of";

export type EdgeMetadata = {
  source: "user" | "assistant" | "import" | "inference";
  confidence?: number;
  createdAt: string;
  updatedAt?: string;
  scope?: string;
};

export type EdgeData = {
  kind: EdgeKind;
  metadata?: EdgeMetadata;
  fromResourceId?: string;
  toResourceId?: string;
  scope?: string;
};

export type DesktopEdge = Edge<EdgeData>;

export type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

export type WindowSlice = {
  windows: WindowInstance[];
  edges: DesktopEdge[];
  activeEdges: Set<string>;
  highlightedEdgeIds: Set<string>;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  addWindow: (window: WindowInstance) => void;
  removeWindow: (windowId: string) => void;
  updateWindow: (windowId: string, data: Partial<WindowData>) => void;
  setWindows: (
    windows: WindowInstance[] | ((prev: WindowInstance[]) => WindowInstance[])
  ) => void;
  setEdges: (edges: DesktopEdge[]) => void;
  setHighlightedEdges: (edgeIds: string[]) => void;
  triggerEdgeActivity: (edgeId: string, durationMs?: number) => void;
  autoLayout: () => void;
};

export type ViewportSlice = {
  focusedWindowId: string | null;
  viewport: Viewport;
  isSpaceMode: boolean;

  focusWindow: (windowId: string | null) => void;
  setViewport: (viewport: Viewport) => void;
  setSpaceMode: (isSpaceMode: boolean) => void;
};

export type DockSlice = {
  dockPins: WindowType[];

  pinType: (type: WindowType) => void;
  unpinType: (type: WindowType) => void;
  spawnWindow: (
    type: WindowType,
    resourceRef?: ResourceRef,
    position?: { x: number; y: number }
  ) => string;
};

export type DesktopState = WindowSlice & ViewportSlice & DockSlice;
