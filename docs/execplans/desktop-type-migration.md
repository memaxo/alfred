# Desktop UI Type System Migration

**Owner:** Frontend Architecture  
**Status:** Planning  
**Created:** 2026-01-03  
**Depends On:** `desktop-evolution-prd.md`

---

## Executive Summary

This document defines the type system migration from the current ReactFlow-based canvas architecture to the new hybrid desktop architecture. The migration separates **window management types** (moving to traditional DOM) from **graph visualization types** (remaining ReactFlow).

---

## Part I: Current Type Inventory

### 1.1 ReactFlow-Coupled Types (MUST MIGRATE)

These types directly extend or depend on `@xyflow/react`:

```typescript
// ❌ CURRENT: Extends ReactFlow Node
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from "@xyflow/react";

export type WindowInstance = Node<WindowData>;      // Window = ReactFlow Node
export type DesktopEdge = Edge<EdgeData>;           // Edge = ReactFlow Edge
```

**Files Affected:**
- `apps/web/src/store/desktop/types.ts` — Core type definitions
- `apps/web/src/store/desktop/windows.ts` — Uses `applyNodeChanges`, `applyEdgeChanges`, `addEdge`
- `apps/web/src/store/desktop/knowledge.ts` — Creates `WindowInstance` as nodes
- `apps/web/src/components/desktop/canvas.tsx` — ReactFlow as container
- `apps/web/src/components/windows/registry.tsx` — NodeTypes mapping

### 1.2 Framework-Agnostic Types (KEEP AS-IS)

These types have no ReactFlow dependency:

```typescript
// ✅ KEEP: Pure domain types
export type WindowType = "chat" | "terminal" | "droid" | ...;
export type ResourceType = "note" | "reminder" | "thread" | ...;
export type ViewMode = "compact" | "full" | "maximized";
export type ResourceRef = { type: ResourceType; id: string };

export type EdgeKind = "relates_to" | "blocks" | "depends_on" | ...;
export type EdgeMetadata = { source: string; confidence?: number; ... };
export type EdgeData = { kind: EdgeKind; metadata?: EdgeMetadata; ... };
```

### 1.3 Slice Types (PARTIALLY MIGRATE)

```typescript
// ❌ MIGRATE: ReactFlow callbacks
export type WindowSlice = {
  onNodesChange: OnNodesChange;    // ReactFlow-specific
  onEdgesChange: OnEdgesChange;    // ReactFlow-specific
  onConnect: OnConnect;            // ReactFlow-specific
  ...
};

// ⚠️ ADAPT: Viewport concept changes
export type ViewportSlice = {
  viewport: Viewport;              // Was { x, y, zoom } for pan/zoom
  isSpaceMode: boolean;            // Mindscape toggle - keep
  ...
};

// ✅ KEEP: No ReactFlow dependency
export type DockSlice = { ... };
export type CacheSlice = { ... };
export type ContextSlice = { ... };
```

---

## Part II: New Desktop Type System

### 2.1 Window Management Types (Traditional DOM)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// FILE: apps/web/src/store/desktop/types.ts (REWRITTEN)
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW TYPES — Extended for Phase 8 apps
// ─────────────────────────────────────────────────────────────────────────────

export type WindowType =
  // Tier 0: Core Experience
  | "chat"
  | "terminal"
  | "code"
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
  // Tier 4: Productivity & Settings
  | "settings"
  | "notes"
  | "reminders"
  | "todos";

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW GEOMETRY — Traditional window positioning (replaces ReactFlow Node)
// ─────────────────────────────────────────────────────────────────────────────

export type Bounds = {
  x: number;      // Left position (px)
  y: number;      // Top position (px)
  width: number;  // Width (px)
  height: number; // Height (px)
};

export type WindowState = 
  | "normal"      // Default floating/tiled state
  | "minimized"   // Hidden to taskbar
  | "maximized"   // Full screen within desktop
  | "fullscreen"; // True fullscreen (hides shell)

export type TileZone =
  | "left"        // Left half
  | "right"       // Right half
  | "top"         // Top half
  | "bottom"      // Bottom half
  | "top-left"    // Top-left quadrant
  | "top-right"   // Top-right quadrant
  | "bottom-left" // Bottom-left quadrant
  | "bottom-right"// Bottom-right quadrant
  | "center"      // Center (floating)
  | "full";       // Full area

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
  
  // Metadata
  createdAt: number;
  lastFocusedAt: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW SLICE — Traditional window management (no ReactFlow callbacks)
// ─────────────────────────────────────────────────────────────────────────────

export type WindowSlice = {
  windows: WindowInstance[];
  zIndexCounter: number;
  
  // Window CRUD
  openWindow: (type: WindowType, data?: Partial<WindowData>, bounds?: Partial<Bounds>) => string;
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
  resizeWindow: (windowId: string, size: { width: number; height: number }) => void;
  setBounds: (windowId: string, bounds: Bounds) => void;
  
  // Batch operations
  closeAllWindows: () => void;
  minimizeAllWindows: () => void;
  cascadeWindows: () => void;
};
```

### 2.2 Tiling Engine Types (NEW)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// FILE: apps/web/src/store/desktop/tiling.ts (NEW)
// ═══════════════════════════════════════════════════════════════════════════

export type TilingLayout =
  | "float"       // No tiling, traditional floating windows
  | "split-h"     // Two windows, horizontal split
  | "split-v"     // Two windows, vertical split
  | "quad"        // Four windows, quadrant layout
  | "main-side"   // One main window + sidebar stack
  | "stack"       // All windows stacked, tabs
  | "columns";    // N equal columns

export type TilingGap = number; // Gap between tiled windows (px)

export type TilingConfig = {
  layout: TilingLayout;
  gap: TilingGap;
  mainRatio: number;        // For main-side layout (0.5-0.8)
  respectMinSize: boolean;  // Prevent tiles smaller than minSize
};

export type TilingZone = {
  id: TileZone;
  bounds: Bounds;
  occupied: boolean;
  windowId?: string;
};

export type TilingSlice = {
  config: TilingConfig;
  zones: TilingZone[];
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
```

### 2.3 Viewport Types (ADAPTED)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// FILE: apps/web/src/store/desktop/viewport.ts (ADAPTED)
// ═══════════════════════════════════════════════════════════════════════════

// Old: { x, y, zoom } for infinite canvas pan/zoom
// New: Desktop area bounds and mode

export type DesktopMode = 
  | "desktop"     // Traditional tiled desktop
  | "mindscape";  // ReactFlow infinite canvas

export type DesktopArea = {
  x: number;      // Left edge of usable area (after menu bar)
  y: number;      // Top edge of usable area
  width: number;  // Usable width (excludes taskbar if vertical)
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
  focusWindow: (windowId: string | null) => void;
};
```

### 2.4 Mindscape Types (ReactFlow-specific, ISOLATED)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// FILE: apps/web/src/store/mindscape/types.ts (NEW — ReactFlow isolation)
// ═══════════════════════════════════════════════════════════════════════════

import type { Node, Edge, Viewport as RFViewport } from "@xyflow/react";

// ReactFlow types stay in Mindscape module only
export type MindscapeNodeData = {
  entityId: string;
  entityType: string;
  label: string;
  confidence?: number;
  archived?: boolean;
};

export type MindscapeNode = Node<MindscapeNodeData>;
export type MindscapeEdge = Edge<EdgeData>;  // Reuse EdgeData

export type MindscapeViewport = RFViewport;  // { x, y, zoom }

export type MindscapeSlice = {
  nodes: MindscapeNode[];
  edges: MindscapeEdge[];
  viewport: MindscapeViewport;
  selectedNodeIds: string[];
  
  // Node CRUD (ReactFlow-compatible)
  addNode: (node: MindscapeNode) => void;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, data: Partial<MindscapeNodeData>) => void;
  
  // Edge CRUD
  addEdge: (edge: MindscapeEdge) => void;
  removeEdge: (edgeId: string) => void;
  
  // ReactFlow callbacks
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  
  // Selection
  selectNode: (nodeId: string) => void;
  selectNodes: (nodeIds: string[]) => void;
  clearSelection: () => void;
  
  // Viewport
  setViewport: (viewport: MindscapeViewport) => void;
  fitView: () => void;
  
  // Layout
  autoLayout: () => void;
  
  // Spawn from desktop
  spawnFromWindow: (windowId: string) => void;
};
```

### 2.5 Graph Visualization Types (Shared for Knowledge, Workflow, etc.)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// FILE: apps/web/src/types/graph.ts (NEW — Shared graph types)
// ═══════════════════════════════════════════════════════════════════════════

import type { Node, Edge } from "@xyflow/react";

// Base node/edge types for all ReactFlow-based visualizations

export type GraphNodeBase<T> = Node<T>;
export type GraphEdgeBase<T> = Edge<T>;

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE GRAPH (in Knowledge app)
// ─────────────────────────────────────────────────────────────────────────────

export type KnowledgeNodeData = {
  entityId: string;
  entityType: "person" | "place" | "concept" | "event" | "fact" | "relation";
  label: string;
  confidence: number;
  facts?: string[];
  createdAt: string;
};

export type KnowledgeGraphNode = GraphNodeBase<KnowledgeNodeData>;
export type KnowledgeGraphEdge = GraphEdgeBase<EdgeData>;

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW DAG (in Workflow app)
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowNodeData = {
  nodeType: "trigger" | "action" | "condition" | "loop" | "end";
  label: string;
  config: Record<string, unknown>;
  status?: "pending" | "running" | "completed" | "failed";
};

export type WorkflowGraphNode = GraphNodeBase<WorkflowNodeData>;
export type WorkflowGraphEdge = GraphEdgeBase<{ condition?: string }>;

// ─────────────────────────────────────────────────────────────────────────────
// AGENT SPAWN TREE (in Agents app)
// ─────────────────────────────────────────────────────────────────────────────

export type SpawnNodeData = {
  agentId: string;
  agentType: "codex" | "droid" | "claude" | "roo";
  subtaskId: string;
  status: "spawning" | "running" | "completed" | "failed";
  waveIndex: number;
};

export type SpawnTreeNode = GraphNodeBase<SpawnNodeData>;
export type SpawnTreeEdge = GraphEdgeBase<{ dependencyType: "spawned_by" | "depends_on" }>;

// ─────────────────────────────────────────────────────────────────────────────
// PLAN DAG (in Plan app)
// ─────────────────────────────────────────────────────────────────────────────

export type PlanNodeData = {
  taskId: string;
  title: string;
  type: "code" | "research" | "review" | "deploy" | "test";
  assignee?: string;
  status: "pending" | "in_progress" | "completed";
};

export type PlanGraphNode = GraphNodeBase<PlanNodeData>;
export type PlanGraphEdge = GraphEdgeBase<{ dependencyType: "blocks" | "requires" }>;

// ─────────────────────────────────────────────────────────────────────────────
// RAG EMBEDDING PROJECTION (in RAG app)
// ─────────────────────────────────────────────────────────────────────────────

export type EmbeddingPointData = {
  chunkId: string;
  label: string;
  cluster?: number;
  score?: number;
};

export type EmbeddingNode = GraphNodeBase<EmbeddingPointData>;
// No edges for embedding visualization
```

---

## Part III: Migration Matrix

### 3.1 Type Migration Table

| Current Type | Location | Action | New Type | New Location |
|--------------|----------|--------|----------|--------------|
| `WindowInstance` | `types.ts` | **REWRITE** | `WindowInstance` (no Node<T>) | `types.ts` |
| `DesktopEdge` | `types.ts` | **REMOVE** | — | Edges only in Mindscape/graphs |
| `Viewport` | `types.ts` | **REPLACE** | `DesktopArea` | `viewport.ts` |
| `WindowSlice` | `types.ts` | **REWRITE** | `WindowSlice` (no RF callbacks) | `types.ts` |
| `ViewportSlice` | `types.ts` | **ADAPT** | `ViewportSlice` (mode-based) | `viewport.ts` |
| `DockSlice` | `types.ts` | **KEEP** | `TaskbarSlice` (renamed) | `taskbar.ts` |
| `KnowledgeSlice` | `knowledge.ts` | **MOVE** | `MindscapeSlice` | `mindscape/types.ts` |
| `KnowledgeNode` | `knowledge.ts` | **MOVE** | `MindscapeNodeData` | `mindscape/types.ts` |
| `KnowledgeEdge` | `knowledge.ts` | **MOVE** | `MindscapeEdge` | `mindscape/types.ts` |
| `CacheSlice` | `cache.ts` | **KEEP** | `CacheSlice` | `cache.ts` |
| `ContextSlice` | `context.ts` | **KEEP** | `ContextSlice` | `context.ts` |
| — | — | **NEW** | `TilingSlice` | `tiling.ts` |
| — | — | **NEW** | `TilingConfig` | `tiling.ts` |
| — | — | **NEW** | Graph types | `types/graph.ts` |

### 3.2 Store Composition Changes

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// CURRENT: All in one store with ReactFlow dependency
// ═══════════════════════════════════════════════════════════════════════════

export type DesktopState = WindowSlice &    // ReactFlow nodes
  ViewportSlice &                           // RF viewport
  DockSlice &
  CacheSlice &
  ContextSlice &
  KnowledgeSlice;                           // RF node spawning

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Separated stores, ReactFlow isolated to Mindscape
// ═══════════════════════════════════════════════════════════════════════════

// Desktop store (no ReactFlow)
export type DesktopState = 
  WindowSlice &
  TilingSlice &       // NEW
  ViewportSlice &     // ADAPTED
  TaskbarSlice &      // RENAMED from DockSlice
  CacheSlice &
  ContextSlice;

// Mindscape store (ReactFlow isolated)
export type MindscapeState = MindscapeSlice;

// App-specific graph stores (ReactFlow)
export type KnowledgeGraphState = { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[]; ... };
export type WorkflowGraphState = { nodes: WorkflowGraphNode[]; edges: WorkflowGraphEdge[]; ... };
export type SpawnTreeState = { nodes: SpawnTreeNode[]; edges: SpawnTreeEdge[]; ... };
```

---

## Part IV: Shared Types (No Migration Needed)

These types have no ReactFlow dependency and remain unchanged:

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// PRESERVED: Domain types used across both architectures
// ═══════════════════════════════════════════════════════════════════════════

// Window identification
export type WindowType = "chat" | "terminal" | ...;  // Extended with new apps
export type ResourceType = "note" | "reminder" | ...;
export type ResourceRef = { type: ResourceType; id: string };
export type ViewMode = "compact" | "full" | "maximized";

// Edge semantics (used in Mindscape and app graphs)
export type EdgeKind = "relates_to" | "blocks" | "depends_on" | ...;
export type EdgeMetadata = { source: string; confidence?: number; ... };
export type EdgeData = { kind: EdgeKind; metadata?: EdgeMetadata; ... };

// Context and caching
export type ContextCacheEntry = { receipt?: SearchReceipt; ... };
export type FeedbackIntent = "positive" | "negative";
export type FeedbackEntry = { intent: FeedbackIntent; updatedAt: number };

// RAG cache
export type CachedRagDocEntry = { ... };
export type RagDocCacheStats = { ... };
```

---

## Part V: Zod Schema Updates

### 5.1 Window Schema (Updated)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// FILE: apps/web/src/store/desktop.schemas.ts (UPDATED)
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";

export const boundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().min(100),
  height: z.number().min(100),
});

export const windowStateSchema = z.enum([
  "normal",
  "minimized", 
  "maximized",
  "fullscreen",
]);

export const tileZoneSchema = z.enum([
  "left",
  "right",
  "top",
  "bottom",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "center",
  "full",
]);

export const windowInstanceSchema = z.object({
  id: z.string(),
  type: windowTypeSchema,
  data: windowDataSchema,
  
  bounds: boundsSchema,
  state: windowStateSchema,
  
  isTiled: z.boolean(),
  tileZone: tileZoneSchema.optional(),
  
  zIndex: z.number(),
  isFocused: z.boolean(),
  
  minSize: z.object({ width: z.number(), height: z.number() }),
  maxSize: z.object({ width: z.number(), height: z.number() }).optional(),
  resizable: z.boolean(),
  
  createdAt: z.number(),
  lastFocusedAt: z.number(),
});
```

### 5.2 Tiling Schema (NEW)

```typescript
export const tilingLayoutSchema = z.enum([
  "float",
  "split-h",
  "split-v",
  "quad",
  "main-side",
  "stack",
  "columns",
]);

export const tilingConfigSchema = z.object({
  layout: tilingLayoutSchema,
  gap: z.number().min(0).max(32),
  mainRatio: z.number().min(0.3).max(0.8),
  respectMinSize: z.boolean(),
});
```

---

## Part VI: Component Type Updates

### 6.1 Window Components

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// CURRENT: Window components receive NodeProps from ReactFlow
// ═══════════════════════════════════════════════════════════════════════════

// Old signature
export function ChatWindow({ id, data, selected }: NodeProps<WindowData>) { ... }

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Window components receive WindowInstance directly
// ═══════════════════════════════════════════════════════════════════════════

export type WindowComponentProps = {
  window: WindowInstance;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onFocus: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, direction: ResizeDirection) => void;
};

// New signature
export function ChatWindow({ window, onClose, onFocus, ... }: WindowComponentProps) { ... }
```

### 6.2 Graph Components (ReactFlow stays)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// UNCHANGED: Graph components continue using ReactFlow NodeProps
// ═══════════════════════════════════════════════════════════════════════════

import type { NodeProps } from "@xyflow/react";

// Knowledge graph nodes
export function KnowledgeEntityNode({ id, data }: NodeProps<KnowledgeNodeData>) { ... }

// Workflow nodes  
export function WorkflowActionNode({ id, data }: NodeProps<WorkflowNodeData>) { ... }

// Spawn tree nodes
export function SpawnAgentNode({ id, data }: NodeProps<SpawnNodeData>) { ... }
```

---

## Part VII: Migration Checklist

### Phase 1: Type Foundation

- [ ] Create `apps/web/src/store/desktop/types.ts` (new version)
- [ ] Create `apps/web/src/store/desktop/tiling.ts`
- [ ] Create `apps/web/src/store/mindscape/types.ts`
- [ ] Create `apps/web/src/types/graph.ts`
- [ ] Update `apps/web/src/store/desktop.schemas.ts`

### Phase 2: Store Migration

- [ ] Rewrite `WindowSlice` without ReactFlow
- [ ] Create `TilingSlice`
- [ ] Adapt `ViewportSlice` for desktop mode
- [ ] Move knowledge spawning to `MindscapeSlice`
- [ ] Compose new `DesktopState`

### Phase 3: Component Migration

- [ ] Create `WindowChrome` component
- [ ] Create `TilingManager` component
- [ ] Update all window components to new props
- [ ] Isolate ReactFlow to graph components

### Phase 4: Registry Updates

- [ ] Remove ReactFlow `NodeTypes` registry
- [ ] Create component factory for windows
- [ ] Create separate registries for graph node types

---

## Appendix: Import Changes

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// BEFORE: ReactFlow imports in desktop store
// ═══════════════════════════════════════════════════════════════════════════

import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges, addEdge } from "@xyflow/react";

// ═══════════════════════════════════════════════════════════════════════════
// AFTER: ReactFlow imports ONLY in mindscape/graph modules
// ═══════════════════════════════════════════════════════════════════════════

// Desktop store — NO ReactFlow imports
// apps/web/src/store/desktop/*.ts

// Mindscape store — ReactFlow isolated
// apps/web/src/store/mindscape/index.ts
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges, addEdge } from "@xyflow/react";

// Graph components — ReactFlow for visualization
// apps/web/src/components/desktop/apps/knowledge/graph-canvas.tsx
// apps/web/src/components/desktop/apps/workflow/node-canvas.tsx
// apps/web/src/components/desktop/apps/agents/spawn-tree.tsx
import { ReactFlow, Background, Controls } from "@xyflow/react";
```
