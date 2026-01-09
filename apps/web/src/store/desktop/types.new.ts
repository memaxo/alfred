/**
 * Desktop Type System - Phase 0 Migration
 *
 * This file contains the new type system for the hybrid desktop architecture.
 * It replaces ReactFlow-coupled types with pure TypeScript types for window management.
 *
 * @see docs/execplans/desktop-type-migration.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW TYPES — Extended for Phase 8 apps
// ─────────────────────────────────────────────────────────────────────────────

export type WindowType =
  // Tier 0: Core Experience
  | "chat"
  | "terminal"
  | "code"
  | "codex"
  | "agents"
  // Tier 1: System & Operations
  | "taskmanager"
  | "docker"
  | "pr-review"
  | "agentfs"
  | "files"
  // Tier 2: Intelligence & Learning (NEW)
  | "cortex"
  | "learning"
  | "policy"
  | "tune"
  | "plan"
  | "metrics"
  | "rag"
  // Tier 3: Knowledge & Exploration
  | "knowledge"
  | "workflow"
  | "linear"
  | "concept"
  | "project"
  // Tier 4: Productivity & Settings
  | "settings"
  | "notes"
  | "reminders"
  | "todos"
  // Legacy (for backwards compatibility)
  | "droid"
  | "note"
  | "reminder"
  | "todo"
  | "workflowlist"
  | "integrations";

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCE TYPES — Domain entity references
// ─────────────────────────────────────────────────────────────────────────────

export type ResourceType =
  | "note"
  | "reminder"
  | "thread"
  | "workflow_run"
  | "preference"
  | "integration"
  | "knowledge"
  | "concept";

export type ResourceRef = {
  type: ResourceType;
  id: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// VIEW MODES
// ─────────────────────────────────────────────────────────────────────────────

export type ViewMode = "compact" | "full" | "maximized";

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW GEOMETRY — Traditional window positioning (replaces ReactFlow Node)
// ─────────────────────────────────────────────────────────────────────────────

export type Bounds = {
  x: number; // Left position (px)
  y: number; // Top position (px)
  width: number; // Width (px)
  height: number; // Height (px)
};

export type WindowState =
  | "normal" // Default floating/tiled state
  | "minimized" // Hidden to taskbar
  | "maximized" // Full screen within desktop
  | "fullscreen"; // True fullscreen (hides shell)

export type TileZone =
  | "left" // Left half
  | "right" // Right half
  | "top" // Top half
  | "bottom" // Bottom half
  | "top-left" // Top-left quadrant
  | "top-right" // Top-right quadrant
  | "bottom-left" // Bottom-left quadrant
  | "bottom-right" // Bottom-right quadrant
  | "center" // Center (floating)
  | "full"; // Full area

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW DATA — App-specific payload (decoupled from Node<T>)
// ─────────────────────────────────────────────────────────────────────────────

export type WindowData = {
  type: WindowType;
  label?: string;
  resourceRef?: ResourceRef;
  viewMode: ViewMode;
  draft?: unknown;
} & Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW INSTANCE — Traditional window model (replaces Node<WindowData>)
// ─────────────────────────────────────────────────────────────────────────────

export type WindowInstance = {
  id: string;
  type: WindowType;
  data: WindowData;

  // Geometry (replaces ReactFlow position)
  bounds: Bounds;
  state: WindowState;

  // Tiling
  isTiled: boolean;
  tileZone?: TileZone;

  // Z-ordering (replaces ReactFlow selection)
  zIndex: number;
  isFocused: boolean;

  // Constraints
  minSize: { width: number; height: number };
  maxSize?: { width: number; height: number };
  resizable: boolean;

  // Grouping
  groupId?: string;

  // Metadata
  createdAt: number;
  lastFocusedAt: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW GROUPS — Tabbed container for related windows
// ─────────────────────────────────────────────────────────────────────────────

export type WindowGroup = {
  id: string;
  windowIds: string[];
  activeWindowId: string;
  bounds: Bounds;
  state: WindowState;
  zIndex: number;
  isFocused: boolean;
  createdAt: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// EDGE TYPES — Semantic relationships (shared with Mindscape)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW SLICE — Traditional window management (no ReactFlow callbacks)
// ─────────────────────────────────────────────────────────────────────────────

export type WindowSlice = {
  windows: WindowInstance[];
  zIndexCounter: number;

  // Window CRUD
  openWindow: (
    type: WindowType,
    data?: Partial<WindowData>,
    bounds?: Partial<Bounds>
  ) => string;
  closeWindow: (windowId: string) => void;
  updateWindow: (windowId: string, updates: Partial<WindowInstance>) => void;
  updateWindowData: (windowId: string, data: Partial<WindowData>) => void;

  // Focus management (replaces ReactFlow selection)
  focusWindow: (windowId: string) => void;
  blurWindow: (windowId: string) => void;

  // State transitions
  minimizeWindow: (windowId: string) => void;
  maximizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;

  // Geometry
  moveWindow: (windowId: string, position: { x: number; y: number }) => void;
  resizeWindow: (
    windowId: string,
    size: { width: number; height: number }
  ) => void;
  setBounds: (windowId: string, bounds: Bounds) => void;

  // Batch operations
  closeAllWindows: () => void;
  minimizeAllWindows: () => void;
  cascadeWindows: () => void;

  // Legacy compatibility (for gradual migration)
  addWindow: (window: WindowInstance) => void;
  removeWindow: (windowId: string) => void;
  setWindows: (
    windows: WindowInstance[] | ((prev: WindowInstance[]) => WindowInstance[])
  ) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// GROUP SLICE — Window groups/tabs management
// ─────────────────────────────────────────────────────────────────────────────

export type GroupSlice = {
  groups: WindowGroup[];

  // Group CRUD
  createGroup: (windowIds: string[]) => string;
  dissolveGroup: (groupId: string) => void;
  addToGroup: (groupId: string, windowId: string) => void;
  removeFromGroup: (groupId: string, windowId: string) => void;

  // Tab navigation
  setActiveTab: (groupId: string, windowId: string) => void;
  nextTab: (groupId: string) => void;
  prevTab: (groupId: string) => void;

  // Group focus
  focusGroup: (groupId: string) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// TILING TYPES — Wayland-inspired tiling window manager
// ─────────────────────────────────────────────────────────────────────────────

export type TilingLayout =
  | "float" // No tiling, traditional floating windows
  | "split-h" // Two windows, horizontal split
  | "split-v" // Two windows, vertical split
  | "quad" // Four windows, quadrant layout
  | "main-side" // One main window + sidebar stack
  | "stack" // All windows stacked, tabs
  | "columns"; // N equal columns

export type TilingGap = number; // Gap between tiled windows (px)

export type TilingConfig = {
  layout: TilingLayout;
  gap: TilingGap;
  mainRatio: number; // For main-side layout (0.5-0.8)
  respectMinSize: boolean; // Prevent tiles smaller than minSize
};

export type TilingZoneState = {
  id: TileZone;
  bounds: Bounds;
  occupied: boolean;
  windowId?: string;
};

export type TilingSlice = {
  config: TilingConfig;
  zones: TilingZoneState[];
  activeTilePreview: TileZone | null;

  // Layout control
  setLayout: (layout: TilingLayout) => void;
  setGap: (gap: number) => void;
  setMainRatio: (ratio: number) => void;

  // Zone management
  calculateZones: () => void;
  tileWindow: (windowId: string, zone: TileZone) => void;
  untileWindow: (windowId: string) => void;
  swapTiles: (zoneA: TileZone, zoneB: TileZone) => void;

  // Preview (during drag)
  showTilePreview: (zone: TileZone) => void;
  hideTilePreview: () => void;

  // Auto-tile
  autoTile: () => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// VIEWPORT TYPES — Desktop mode management (adapted from ReactFlow viewport)
// ─────────────────────────────────────────────────────────────────────────────

export type DesktopMode =
  | "desktop" // Traditional tiled desktop
  | "mindscape"; // ReactFlow infinite canvas

export type DesktopArea = {
  x: number; // Left edge of usable area (after menu bar)
  y: number; // Top edge of usable area
  width: number; // Usable width (excludes taskbar if vertical)
  height: number; // Usable height (excludes taskbar)
};

export type ViewportSlice = {
  mode: DesktopMode;
  desktopArea: DesktopArea;
  focusedWindowId: string | null;

  // Mode switching
  setMode: (mode: DesktopMode) => void;
  toggleMindscape: () => void;

  // Desktop area (recalculated on resize)
  setDesktopArea: (area: DesktopArea) => void;

  // Focus (decoupled from ReactFlow selection)
  setFocusedWindow: (windowId: string | null) => void;

  // Legacy compatibility
  isSpaceMode: boolean;
  setSpaceMode: (isSpaceMode: boolean) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// TASKBAR SLICE — Renamed from DockSlice
// ─────────────────────────────────────────────────────────────────────────────

export type TaskbarSlice = {
  pinnedApps: WindowType[];

  pinApp: (type: WindowType) => void;
  unpinApp: (type: WindowType) => void;
  spawnWindow: (
    type: WindowType,
    resourceRef?: ResourceRef,
    position?: { x: number; y: number }
  ) => string;

  // Legacy compatibility
  dockPins: WindowType[];
  pinType: (type: WindowType) => void;
  unpinType: (type: WindowType) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP STATE — Composed state (no ReactFlow dependency)
// ─────────────────────────────────────────────────────────────────────────────

// Re-export slice types from their modules
export type { CachedRagDocEntry, CacheSlice, RagDocCacheStats } from "./cache";
export type {
  ContextCacheEntry,
  ContextSlice,
  FeedbackEntry,
  FeedbackIntent,
} from "./context";
export type { KnowledgeSlice } from "./knowledge";

// Import for DesktopState composition
import type { CacheSlice } from "./cache";
import type { ContextSlice } from "./context";
import type { KnowledgeSlice } from "./knowledge";

export type DesktopState = WindowSlice &
  GroupSlice &
  TilingSlice &
  ViewportSlice &
  TaskbarSlice &
  CacheSlice &
  ContextSlice &
  KnowledgeSlice;

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT VALUES — Window constraints and defaults
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_MIN_SIZE = { width: 200, height: 150 };
export const DEFAULT_BOUNDS: Bounds = {
  x: 100,
  y: 100,
  width: 400,
  height: 300,
};

export const WINDOW_DEFAULTS: Record<
  WindowType,
  { minSize: { width: number; height: number }; defaultBounds: Bounds }
> = {
  chat: {
    minSize: { width: 400, height: 400 },
    defaultBounds: { x: 100, y: 100, width: 500, height: 600 },
  },
  terminal: {
    minSize: { width: 400, height: 300 },
    defaultBounds: { x: 150, y: 150, width: 600, height: 400 },
  },
  code: {
    minSize: { width: 600, height: 400 },
    defaultBounds: { x: 100, y: 100, width: 800, height: 600 },
  },
  codex: {
    minSize: { width: 500, height: 400 },
    defaultBounds: { x: 120, y: 120, width: 650, height: 550 },
  },
  agents: {
    minSize: { width: 500, height: 400 },
    defaultBounds: { x: 200, y: 100, width: 700, height: 500 },
  },
  taskmanager: {
    minSize: { width: 400, height: 300 },
    defaultBounds: { x: 200, y: 150, width: 600, height: 400 },
  },
  docker: {
    minSize: { width: 500, height: 400 },
    defaultBounds: { x: 150, y: 100, width: 700, height: 500 },
  },
  "pr-review": {
    minSize: { width: 600, height: 400 },
    defaultBounds: { x: 100, y: 100, width: 800, height: 600 },
  },
  agentfs: {
    minSize: { width: 400, height: 300 },
    defaultBounds: { x: 200, y: 150, width: 600, height: 450 },
  },
  files: {
    minSize: { width: 400, height: 300 },
    defaultBounds: { x: 150, y: 100, width: 600, height: 450 },
  },
  cortex: {
    minSize: { width: 500, height: 400 },
    defaultBounds: { x: 100, y: 100, width: 700, height: 500 },
  },
  learning: {
    minSize: { width: 500, height: 400 },
    defaultBounds: { x: 150, y: 100, width: 700, height: 500 },
  },
  policy: {
    minSize: { width: 400, height: 300 },
    defaultBounds: { x: 200, y: 150, width: 600, height: 400 },
  },
  tune: {
    minSize: { width: 500, height: 400 },
    defaultBounds: { x: 100, y: 100, width: 700, height: 500 },
  },
  plan: {
    minSize: { width: 500, height: 400 },
    defaultBounds: { x: 150, y: 100, width: 700, height: 500 },
  },
  metrics: {
    minSize: { width: 400, height: 300 },
    defaultBounds: { x: 200, y: 150, width: 600, height: 400 },
  },
  rag: {
    minSize: { width: 500, height: 400 },
    defaultBounds: { x: 100, y: 100, width: 700, height: 500 },
  },
  knowledge: {
    minSize: { width: 400, height: 300 },
    defaultBounds: { x: 150, y: 100, width: 500, height: 400 },
  },
  workflow: {
    minSize: { width: 500, height: 400 },
    defaultBounds: { x: 100, y: 100, width: 700, height: 500 },
  },
  linear: {
    minSize: { width: 400, height: 300 },
    defaultBounds: { x: 200, y: 150, width: 600, height: 450 },
  },
  concept: {
    minSize: { width: 300, height: 200 },
    defaultBounds: { x: 200, y: 200, width: 400, height: 300 },
  },
  project: {
    minSize: { width: 400, height: 350 },
    defaultBounds: { x: 150, y: 100, width: 500, height: 450 },
  },
  settings: {
    minSize: { width: 400, height: 400 },
    defaultBounds: { x: 200, y: 100, width: 500, height: 500 },
  },
  notes: {
    minSize: { width: 300, height: 300 },
    defaultBounds: { x: 150, y: 150, width: 450, height: 400 },
  },
  reminders: {
    minSize: { width: 300, height: 250 },
    defaultBounds: { x: 200, y: 150, width: 400, height: 350 },
  },
  todos: {
    minSize: { width: 300, height: 300 },
    defaultBounds: { x: 200, y: 150, width: 400, height: 400 },
  },
  // Legacy
  droid: {
    minSize: { width: 400, height: 400 },
    defaultBounds: { x: 100, y: 100, width: 500, height: 500 },
  },
  note: {
    minSize: { width: 300, height: 300 },
    defaultBounds: { x: 150, y: 150, width: 450, height: 400 },
  },
  reminder: {
    minSize: { width: 300, height: 250 },
    defaultBounds: { x: 200, y: 150, width: 400, height: 350 },
  },
  todo: {
    minSize: { width: 300, height: 300 },
    defaultBounds: { x: 200, y: 150, width: 400, height: 400 },
  },
  workflowlist: {
    minSize: { width: 400, height: 300 },
    defaultBounds: { x: 150, y: 100, width: 500, height: 400 },
  },
  integrations: {
    minSize: { width: 400, height: 400 },
    defaultBounds: { x: 200, y: 100, width: 500, height: 500 },
  },
};
