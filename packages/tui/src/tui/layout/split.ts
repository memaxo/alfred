/**
 * ALFRED TUI Split Containers
 *
 * Higher-level split container abstractions for common layouts.
 */

import type { LayoutNode, Rect, SplitNode } from "./engine";
import { calculateLayout, hsplit, panel, vsplit } from "./engine";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SplitContainerState = {
  layout: SplitNode;
  focusedIndex: number;
  panelIds: string[];
};

export type SplitContainerActions = {
  focusNext: () => void;
  focusPrev: () => void;
  focusIndex: (index: number) => void;
  setWeight: (panelId: string, weight: number) => void;
  toggleExpand: (panelId: string) => void;
};

// ─── Split Container ─────────────────────────────────────────────────────────

export function createHorizontalSplit(
  panels: { id: string; weight?: number }[]
): SplitContainerState {
  const children: LayoutNode[] = panels.map((p) =>
    panel(p.id, { weight: p.weight ?? 1 })
  );

  return {
    layout: hsplit(children),
    focusedIndex: 0,
    panelIds: panels.map((p) => p.id),
  };
}

export function createVerticalSplit(
  panels: { id: string; weight?: number }[]
): SplitContainerState {
  const children: LayoutNode[] = panels.map((p) =>
    panel(p.id, { weight: p.weight ?? 1 })
  );

  return {
    layout: vsplit(children),
    focusedIndex: 0,
    panelIds: panels.map((p) => p.id),
  };
}

// ─── Split Container Actions ─────────────────────────────────────────────────

export function createSplitActions(
  getState: () => SplitContainerState,
  setState: (state: SplitContainerState) => void
): SplitContainerActions {
  return {
    focusNext: () => {
      const state = getState();
      const nextIndex = (state.focusedIndex + 1) % state.panelIds.length;
      setState({ ...state, focusedIndex: nextIndex });
    },

    focusPrev: () => {
      const state = getState();
      const prevIndex =
        (state.focusedIndex - 1 + state.panelIds.length) %
        state.panelIds.length;
      setState({ ...state, focusedIndex: prevIndex });
    },

    focusIndex: (index: number) => {
      const state = getState();
      if (index >= 0 && index < state.panelIds.length) {
        setState({ ...state, focusedIndex: index });
      }
    },

    setWeight: (panelId: string, weight: number) => {
      const state = getState();
      const newChildren = state.layout.children.map((child) => {
        if (child.id === panelId) {
          return { ...child, weight };
        }
        return child;
      });
      setState({
        ...state,
        layout: { ...state.layout, children: newChildren },
      });
    },

    toggleExpand: (panelId: string) => {
      const state = getState();
      const targetIndex = state.panelIds.indexOf(panelId);
      if (targetIndex === -1) {
        return;
      }

      // Check if panel is already expanded (weight much larger than others)
      const targetChild = state.layout.children[targetIndex];
      if (!targetChild) {
        return;
      }

      const isExpanded = (targetChild.weight ?? 1) > 3;

      const newChildren = state.layout.children.map((child, i) => {
        if (i === targetIndex) {
          return { ...child, weight: isExpanded ? 1 : 4 };
        }
        return { ...child, weight: isExpanded ? 1 : 0.5 };
      });

      setState({
        ...state,
        layout: { ...state.layout, children: newChildren },
      });
    },
  };
}

// ─── Layout Calculation ──────────────────────────────────────────────────────

export function calculateSplitLayout(
  state: SplitContainerState,
  bounds: Rect
): Map<string, Rect> {
  const result = calculateLayout(state.layout, bounds);
  return new Map(Object.entries(result));
}

// ─── Focused Panel Helpers ───────────────────────────────────────────────────

export function getFocusedPanelId(
  state: SplitContainerState
): string | undefined {
  return state.panelIds[state.focusedIndex];
}

export function isPanelFocused(
  state: SplitContainerState,
  panelId: string
): boolean {
  return state.panelIds[state.focusedIndex] === panelId;
}

// ─── Nested Split Layout ─────────────────────────────────────────────────────

export type NestedSplitConfig = {
  direction: "horizontal" | "vertical";
  children: (string | NestedSplitConfig)[];
  weight?: number;
};

export function buildNestedLayout(config: NestedSplitConfig): SplitNode {
  const children: LayoutNode[] = config.children.map((child) => {
    if (typeof child === "string") {
      return panel(child);
    }
    return buildNestedLayout(child);
  });

  if (config.direction === "horizontal") {
    return hsplit(children, { weight: config.weight });
  }
  return vsplit(children, { weight: config.weight });
}

export function collectPanelIds(node: LayoutNode): string[] {
  if (node.type === "panel") {
    return [node.id];
  }

  const split = node as SplitNode;
  return split.children.flatMap(collectPanelIds);
}
