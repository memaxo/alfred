/**
 * ALFRED TUI Panel Navigation
 *
 * Manages panel focus, tab order, and keyboard navigation between panels.
 */

import type { KeyEvent } from "./keys";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NavigablePanel = {
  id: string;
  label: string;
  shortcut?: string; // e.g., "1", "c" for cognitive
  enabled?: boolean;
};

export type NavigationState = {
  panels: NavigablePanel[];
  focusedIndex: number;
  focusedId: string;
};

export type NavigationActions = {
  focusNext: () => void;
  focusPrev: () => void;
  focusById: (id: string) => void;
  focusByIndex: (index: number) => void;
  focusByShortcut: (shortcut: string) => void;
};

// ─── Navigation State ────────────────────────────────────────────────────────

export function createNavigationState(
  panels: NavigablePanel[],
  initialFocus = 0
): NavigationState {
  const enabledPanels = panels.filter((p) => p.enabled !== false);
  const focusedPanel = enabledPanels[initialFocus];
  return {
    panels: enabledPanels,
    focusedIndex: initialFocus,
    focusedId: focusedPanel?.id ?? "",
  };
}

// ─── Navigation Actions ──────────────────────────────────────────────────────

export function createNavigationActions(
  getState: () => NavigationState,
  setState: (state: NavigationState) => void
): NavigationActions {
  return {
    focusNext: () => {
      const state = getState();
      if (state.panels.length === 0) {
        return;
      }
      const nextIndex = (state.focusedIndex + 1) % state.panels.length;
      const nextPanel = state.panels[nextIndex];
      if (nextPanel) {
        setState({
          ...state,
          focusedIndex: nextIndex,
          focusedId: nextPanel.id,
        });
      }
    },

    focusPrev: () => {
      const state = getState();
      if (state.panels.length === 0) {
        return;
      }
      const prevIndex =
        (state.focusedIndex - 1 + state.panels.length) % state.panels.length;
      const prevPanel = state.panels[prevIndex];
      if (prevPanel) {
        setState({
          ...state,
          focusedIndex: prevIndex,
          focusedId: prevPanel.id,
        });
      }
    },

    focusById: (id: string) => {
      const state = getState();
      const index = state.panels.findIndex((p) => p.id === id);
      if (index !== -1) {
        const panel = state.panels[index];
        if (panel) {
          setState({
            ...state,
            focusedIndex: index,
            focusedId: panel.id,
          });
        }
      }
    },

    focusByIndex: (index: number) => {
      const state = getState();
      if (index >= 0 && index < state.panels.length) {
        const panel = state.panels[index];
        if (panel) {
          setState({
            ...state,
            focusedIndex: index,
            focusedId: panel.id,
          });
        }
      }
    },

    focusByShortcut: (shortcut: string) => {
      const state = getState();
      const index = state.panels.findIndex((p) => p.shortcut === shortcut);
      if (index !== -1) {
        const panel = state.panels[index];
        if (panel) {
          setState({
            ...state,
            focusedIndex: index,
            focusedId: panel.id,
          });
        }
      }
    },
  };
}

// ─── Navigation Key Handler ──────────────────────────────────────────────────

export function createNavigationKeyHandler(
  actions: NavigationActions,
  getState: () => NavigationState
): (event: KeyEvent) => boolean {
  return (event: KeyEvent) => {
    const state = getState();

    // Tab / Shift+Tab for next/prev
    if (event.key === "tab") {
      if (event.shift) {
        actions.focusPrev();
      } else {
        actions.focusNext();
      }
      return true;
    }

    // Number keys 1-9 for direct panel access
    if (/^[1-9]$/.test(event.key)) {
      const index = Number.parseInt(event.key, 10) - 1;
      if (index < state.panels.length) {
        actions.focusByIndex(index);
        return true;
      }
    }

    // Check for panel shortcuts (e.g., 'c' for cognitive)
    if (event.key.length === 1 && !event.ctrl && !event.alt) {
      const panel = state.panels.find((p) => p.shortcut === event.key);
      if (panel) {
        actions.focusByShortcut(event.key);
        return true;
      }
    }

    return false;
  };
}

// ─── Focus Indicator ─────────────────────────────────────────────────────────

export function isFocused(state: NavigationState, panelId: string): boolean {
  return state.focusedId === panelId;
}

export function getFocusedPanel(
  state: NavigationState
): NavigablePanel | undefined {
  return state.panels[state.focusedIndex];
}

// ─── Standard Panel Configuration ────────────────────────────────────────────

export const DEFAULT_PANELS: NavigablePanel[] = [
  { id: "cognitive", label: "Cognitive", shortcut: "c" },
  { id: "workflow", label: "Workflows", shortcut: "w" },
  { id: "metrics", label: "Metrics", shortcut: "m" },
  { id: "voice", label: "Voice", shortcut: "v" },
  { id: "knowledge", label: "Knowledge", shortcut: "k" },
];

// ─── Focus Ring ──────────────────────────────────────────────────────────────

/**
 * Creates a circular focus ring for navigating through items
 */
export class FocusRing<T> {
  private items: T[] = [];
  private currentIndex = 0;

  constructor(items: T[] = []) {
    this.items = items;
  }

  setItems(items: T[]): void {
    this.items = items;
    if (this.currentIndex >= items.length) {
      this.currentIndex = Math.max(0, items.length - 1);
    }
  }

  get current(): T | undefined {
    return this.items[this.currentIndex];
  }

  get index(): number {
    return this.currentIndex;
  }

  get length(): number {
    return this.items.length;
  }

  next(): T | undefined {
    if (this.items.length === 0) {
      return;
    }
    this.currentIndex = (this.currentIndex + 1) % this.items.length;
    return this.current;
  }

  prev(): T | undefined {
    if (this.items.length === 0) {
      return;
    }
    this.currentIndex =
      (this.currentIndex - 1 + this.items.length) % this.items.length;
    return this.current;
  }

  goTo(index: number): T | undefined {
    if (index >= 0 && index < this.items.length) {
      this.currentIndex = index;
    }
    return this.current;
  }

  find(predicate: (item: T) => boolean): T | undefined {
    const index = this.items.findIndex(predicate);
    if (index !== -1) {
      this.currentIndex = index;
      return this.current;
    }
    return;
  }
}
