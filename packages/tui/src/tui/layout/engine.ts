/**
 * ALFRED TUI Layout Engine
 *
 * Flexbox-inspired layout calculation for terminal panels.
 * Handles dynamic sizing, weights, and constraints.
 */

import type { TerminalSize } from "../renderer";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutNode = {
  id: string;
  type: "panel" | "split";
  weight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
};

export interface PanelNode extends LayoutNode {
  type: "panel";
}

export interface SplitNode extends LayoutNode {
  type: "split";
  direction: "horizontal" | "vertical";
  children: LayoutNode[];
}

export type LayoutTree = LayoutNode;

export type LayoutResult = {
  [panelId: string]: Rect;
};

// ─── Layout Constants ────────────────────────────────────────────────────────

const MIN_PANEL_WIDTH = 20;
const MIN_PANEL_HEIGHT = 5;
const DEFAULT_WEIGHT = 1;

// ─── Layout Calculation ──────────────────────────────────────────────────────

/**
 * Calculate layout for a tree of panels
 */
export function calculateLayout(tree: LayoutTree, bounds: Rect): LayoutResult {
  const result: LayoutResult = {};
  layoutNode(tree, bounds, result);
  return result;
}

function layoutNode(
  node: LayoutNode,
  bounds: Rect,
  result: LayoutResult
): void {
  if (node.type === "panel") {
    result[node.id] = bounds;
    return;
  }

  const split = node as SplitNode;
  const children = split.children;

  if (children.length === 0) {
    return;
  }

  // Calculate total weight
  const totalWeight = children.reduce(
    (sum, child) => sum + (child.weight ?? DEFAULT_WEIGHT),
    0
  );

  // Available space
  const isHorizontal = split.direction === "horizontal";
  const availableSize = isHorizontal ? bounds.width : bounds.height;

  // Calculate sizes for each child
  let currentPos = isHorizontal ? bounds.x : bounds.y;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) {
      continue;
    }

    const weight = child.weight ?? DEFAULT_WEIGHT;
    const ratio = weight / totalWeight;

    // Calculate size, respecting min/max constraints
    let size = Math.floor(availableSize * ratio);

    if (isHorizontal) {
      size = Math.max(size, child.minWidth ?? MIN_PANEL_WIDTH);
      if (child.maxWidth) {
        size = Math.min(size, child.maxWidth);
      }
    } else {
      size = Math.max(size, child.minHeight ?? MIN_PANEL_HEIGHT);
      if (child.maxHeight) {
        size = Math.min(size, child.maxHeight);
      }
    }

    // Last child gets remaining space
    if (i === children.length - 1) {
      size =
        (isHorizontal ? bounds.x + bounds.width : bounds.y + bounds.height) -
        currentPos;
    }

    const childBounds: Rect = isHorizontal
      ? {
          x: currentPos,
          y: bounds.y,
          width: size,
          height: bounds.height,
        }
      : {
          x: bounds.x,
          y: currentPos,
          width: bounds.width,
          height: size,
        };

    layoutNode(child, childBounds, result);
    currentPos += size;
  }
}

// ─── Layout Builders ─────────────────────────────────────────────────────────

export function panel(id: string, options: Partial<PanelNode> = {}): PanelNode {
  return {
    id,
    type: "panel",
    weight: 1,
    ...options,
  };
}

export function hsplit(
  children: LayoutNode[],
  options: Partial<Omit<SplitNode, "type" | "direction" | "children">> = {}
): SplitNode {
  return {
    id: `hsplit-${Date.now()}`,
    type: "split",
    direction: "horizontal",
    weight: 1,
    children,
    ...options,
  };
}

export function vsplit(
  children: LayoutNode[],
  options: Partial<Omit<SplitNode, "type" | "direction" | "children">> = {}
): SplitNode {
  return {
    id: `vsplit-${Date.now()}`,
    type: "split",
    direction: "vertical",
    weight: 1,
    children,
    ...options,
  };
}

// ─── Predefined Layouts ──────────────────────────────────────────────────────

/**
 * Single panel layout (for narrow terminals or focus mode)
 */
export function singlePanelLayout(panelId: string): LayoutTree {
  return panel(panelId);
}

/**
 * Two panel horizontal split
 */
export function twoColumnLayout(
  leftId: string,
  rightId: string,
  leftWeight = 1,
  rightWeight = 1
): LayoutTree {
  return hsplit([
    panel(leftId, { weight: leftWeight }),
    panel(rightId, { weight: rightWeight }),
  ]);
}

/**
 * Two panel vertical split
 */
export function twoRowLayout(
  topId: string,
  bottomId: string,
  topWeight = 1,
  bottomWeight = 1
): LayoutTree {
  return vsplit([
    panel(topId, { weight: topWeight }),
    panel(bottomId, { weight: bottomWeight }),
  ]);
}

/**
 * Dashboard layout: header, main content (2 columns), footer
 */
export function dashboardLayout(): LayoutTree {
  return vsplit([
    panel("header", { weight: 1, maxHeight: 3 }),
    hsplit(
      [
        vsplit(
          [panel("cognitive", { weight: 1 }), panel("workflow", { weight: 1 })],
          { weight: 1 }
        ),
        vsplit(
          [panel("metrics", { weight: 1 }), panel("voice", { weight: 1 })],
          { weight: 1 }
        ),
      ],
      { weight: 8 }
    ),
    panel("shortcuts", { weight: 1, maxHeight: 2 }),
  ]);
}

/**
 * Compact dashboard layout (for medium terminals)
 */
export function compactDashboardLayout(): LayoutTree {
  return vsplit([
    panel("header", { weight: 1, maxHeight: 3 }),
    panel("status", { weight: 1, maxHeight: 4 }),
    hsplit(
      [panel("cognitive", { weight: 1 }), panel("workflow", { weight: 1 })],
      { weight: 6 }
    ),
    panel("shortcuts", { weight: 1, maxHeight: 2 }),
  ]);
}

// ─── Layout Utilities ────────────────────────────────────────────────────────

/**
 * Create bounds from terminal size (with optional padding)
 */
export function boundsFromSize(size: TerminalSize, padding = 0): Rect {
  return {
    x: padding,
    y: padding,
    width: size.width - padding * 2,
    height: size.height - padding * 2,
  };
}

/**
 * Check if a rect contains a point
 */
export function rectContains(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x < rect.x + rect.width &&
    y >= rect.y &&
    y < rect.y + rect.height
  );
}

/**
 * Shrink rect by padding
 */
export function shrinkRect(rect: Rect, padding: number): Rect {
  return {
    x: rect.x + padding,
    y: rect.y + padding,
    width: Math.max(0, rect.width - padding * 2),
    height: Math.max(0, rect.height - padding * 2),
  };
}
