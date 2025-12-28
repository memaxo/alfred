/**
 * ALFRED TUI Adaptive Layout
 *
 * Automatically selects layout mode based on terminal dimensions.
 */

import type { TerminalSize } from "../renderer";
import type { LayoutTree, Rect } from "./engine";
import {
  boundsFromSize,
  calculateLayout,
  compactDashboardLayout,
  dashboardLayout,
  singlePanelLayout,
  twoColumnLayout,
} from "./engine";

// ─── Layout Modes ────────────────────────────────────────────────────────────

export type LayoutMode = "focus" | "split" | "compact" | "dashboard";

// ─── Breakpoints ─────────────────────────────────────────────────────────────

const BREAKPOINTS = {
  // Below this: focus mode (single panel)
  minForSplit: 80,
  // Below this: split mode (2 panels)
  minForCompact: 120,
  // Below this: compact dashboard
  minForDashboard: 160,
  // Minimum height for multi-row layouts
  minHeightForRows: 20,
} as const;

// ─── Mode Detection ──────────────────────────────────────────────────────────

export function detectLayoutMode(size: TerminalSize): LayoutMode {
  const { width, height } = size;

  // Very small terminal: focus mode
  if (
    width < BREAKPOINTS.minForSplit ||
    height < BREAKPOINTS.minHeightForRows
  ) {
    return "focus";
  }

  // Small terminal: split mode (2 columns)
  if (width < BREAKPOINTS.minForCompact) {
    return "split";
  }

  // Medium terminal: compact dashboard
  if (width < BREAKPOINTS.minForDashboard) {
    return "compact";
  }

  // Large terminal: full dashboard
  return "dashboard";
}

// ─── Layout Selection ────────────────────────────────────────────────────────

export function getLayoutForMode(
  mode: LayoutMode,
  focusedPanel?: string
): LayoutTree {
  switch (mode) {
    case "focus":
      return singlePanelLayout(focusedPanel ?? "cognitive");

    case "split":
      return twoColumnLayout("cognitive", "workflow");

    case "compact":
      return compactDashboardLayout();

    case "dashboard":
      return dashboardLayout();
  }
}

export function getAdaptiveLayout(
  size: TerminalSize,
  focusedPanel?: string,
  forceMode?: LayoutMode
): LayoutTree {
  const mode = forceMode ?? detectLayoutMode(size);
  return getLayoutForMode(mode, focusedPanel);
}

// ─── Adaptive Layout State ───────────────────────────────────────────────────

export type AdaptiveLayoutState = {
  mode: LayoutMode;
  forcedMode: LayoutMode | null;
  focusedPanel: string;
  availablePanels: string[];
};

export function createAdaptiveLayoutState(
  initialPanel = "cognitive"
): AdaptiveLayoutState {
  return {
    mode: "dashboard",
    forcedMode: null,
    focusedPanel: initialPanel,
    availablePanels: [
      "header",
      "status",
      "cognitive",
      "workflow",
      "metrics",
      "voice",
      "knowledge",
      "shortcuts",
    ],
  };
}

// ─── Layout Actions ──────────────────────────────────────────────────────────

export type AdaptiveLayoutActions = {
  updateForSize: (size: TerminalSize) => void;
  setMode: (mode: LayoutMode | null) => void;
  focusPanel: (panelId: string) => void;
  focusNext: () => void;
  focusPrev: () => void;
  toggleFocusMode: () => void;
};

export function createAdaptiveLayoutActions(
  getState: () => AdaptiveLayoutState,
  setState: (state: AdaptiveLayoutState) => void
): AdaptiveLayoutActions {
  return {
    updateForSize: (size: TerminalSize) => {
      const state = getState();
      if (state.forcedMode) {
        return;
      }
      const newMode = detectLayoutMode(size);
      if (newMode !== state.mode) {
        setState({ ...state, mode: newMode });
      }
    },

    setMode: (mode: LayoutMode | null) => {
      const state = getState();
      setState({
        ...state,
        forcedMode: mode,
        mode: mode ?? detectLayoutMode({ width: 120, height: 40 }),
      });
    },

    focusPanel: (panelId: string) => {
      const state = getState();
      if (state.availablePanels.includes(panelId)) {
        setState({ ...state, focusedPanel: panelId });
      }
    },

    focusNext: () => {
      const state = getState();
      const currentIndex = state.availablePanels.indexOf(state.focusedPanel);
      const nextIndex = (currentIndex + 1) % state.availablePanels.length;
      const nextPanel = state.availablePanels[nextIndex];
      if (nextPanel) {
        setState({ ...state, focusedPanel: nextPanel });
      }
    },

    focusPrev: () => {
      const state = getState();
      const currentIndex = state.availablePanels.indexOf(state.focusedPanel);
      const prevIndex =
        (currentIndex - 1 + state.availablePanels.length) %
        state.availablePanels.length;
      const prevPanel = state.availablePanels[prevIndex];
      if (prevPanel) {
        setState({ ...state, focusedPanel: prevPanel });
      }
    },

    toggleFocusMode: () => {
      const state = getState();
      if (state.forcedMode === "focus") {
        setState({ ...state, forcedMode: null, mode: "dashboard" });
      } else {
        setState({ ...state, forcedMode: "focus", mode: "focus" });
      }
    },
  };
}

// ─── Full Layout Calculation ─────────────────────────────────────────────────

export function calculateAdaptiveLayout(
  state: AdaptiveLayoutState,
  size: TerminalSize
): Map<string, Rect> {
  const layout = getAdaptiveLayout(
    size,
    state.focusedPanel,
    state.forcedMode ?? undefined
  );
  const bounds = boundsFromSize(size);
  const result = calculateLayout(layout, bounds);
  return new Map(Object.entries(result));
}

// ─── Mode Display Names ──────────────────────────────────────────────────────

export function getModeName(mode: LayoutMode): string {
  switch (mode) {
    case "focus":
      return "Focus";
    case "split":
      return "Split";
    case "compact":
      return "Compact";
    case "dashboard":
      return "Dashboard";
  }
}

// ─── Layout with Reserved Areas ──────────────────────────────────────────────

export type ReservedAreas = {
  header?: number;
  footer?: number;
  left?: number;
  right?: number;
};

export function calculateContentBounds(
  size: TerminalSize,
  reserved: ReservedAreas = {}
): Rect {
  const headerHeight = reserved.header ?? 0;
  const footerHeight = reserved.footer ?? 0;
  const leftWidth = reserved.left ?? 0;
  const rightWidth = reserved.right ?? 0;

  return {
    x: leftWidth,
    y: headerHeight,
    width: size.width - leftWidth - rightWidth,
    height: size.height - headerHeight - footerHeight,
  };
}
