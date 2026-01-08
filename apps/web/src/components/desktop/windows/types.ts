/**
 * Window Component Types - Phase 0 Migration
 *
 * New props interface for window components, decoupled from ReactFlow's NodeProps.
 * This enables gradual migration from ReactFlow to traditional DOM windows.
 *
 * @see docs/execplans/desktop-type-migration.md Section 6.1
 */

import type {
  WindowData,
  WindowInstance,
  WindowType,
} from "@/store/desktop/types.new";

// ─────────────────────────────────────────────────────────────────────────────
// RESIZE DIRECTION — For window resize handles
// ─────────────────────────────────────────────────────────────────────────────

export type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW COMPONENT PROPS — New props interface (no ReactFlow dependency)
// ─────────────────────────────────────────────────────────────────────────────

export type WindowComponentProps = {
  /** The complete window instance */
  window: WindowInstance;

  /** Window lifecycle callbacks */
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onRestore: () => void;

  /** Focus management */
  onFocus: () => void;
  onBlur: () => void;

  /** Drag and resize handlers */
  onDragStart: (e: React.MouseEvent) => void;
  onDragEnd: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, direction: ResizeDirection) => void;
  onResizeEnd: (e: React.MouseEvent) => void;

  /** Data update callback */
  onDataChange: (data: Partial<WindowData>) => void;

  /** Optional className override */
  className?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY ADAPTER PROPS — Bridge between old NodeProps and new interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Legacy props from ReactFlow's NodeProps that existing windows use.
 * Used for the adapter layer during migration.
 */
import type { Node } from "@xyflow/react";

export type LegacyNodeProps = Omit<
  Node,
  "id" | "position" | "data" | "type"
> & {
  id: string;
  data: WindowData;
  selected?: boolean;
  type?: string;
  xPos?: number;
  yPos?: number;
  connectable?: boolean;
  positionAbsoluteX?: number;
  positionAbsoluteY?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW REGISTRY TYPES — For component factory
// ─────────────────────────────────────────────────────────────────────────────

export type WindowComponentType = React.ComponentType<WindowComponentProps>;
export type LegacyWindowComponentType = React.ComponentType<LegacyNodeProps>;

/**
 * Window metadata for the registry
 */
export type WindowMetadata = {
  /** Human-readable label */
  label: string;
  /** Icon component or string */
  icon?: React.ReactNode | any;
  /** Default window size */
  defaultSize: { width: number; height: number };
  /** Minimum window size */
  minSize: { width: number; height: number };
  /** Maximum window size (optional) */
  maxSize?: { width: number; height: number };
  /** Whether window can be resized */
  resizable: boolean;
  /** Whether only one instance can exist */
  singleton: boolean;
  /** Window tier for z-ordering priority */
  tier: "primary" | "secondary" | "tertiary";
};

/**
 * Complete registry entry for a window type
 */
export type WindowRegistryEntry = {
  type: WindowType;
  component: WindowComponentType | LegacyWindowComponentType | any;
  metadata: WindowMetadata;
  /** Whether using legacy adapter */
  isLegacy: boolean;
};
