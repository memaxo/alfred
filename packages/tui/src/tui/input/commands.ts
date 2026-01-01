/**
 * ALFRED TUI Command Palette
 *
 * Fuzzy-searchable command palette for quick actions.
 */

import type { KeyEvent } from "./keys";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Command = {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  category?: string;
  action: () => void | Promise<void>;
  enabled?: () => boolean;
};

export type CommandPaletteState = {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  filteredCommands: Command[];
};

export type CommandPaletteActions = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
  selectNext: () => void;
  selectPrev: () => void;
  executeSelected: () => void;
  executeById: (id: string) => void;
};

// ─── Fuzzy Search ────────────────────────────────────────────────────────────

export function fuzzyMatch(pattern: string, text: string): number {
  if (pattern.length === 0) {
    return 1;
  }

  const lowerPattern = pattern.toLowerCase();
  const lowerText = text.toLowerCase();

  let patternIdx = 0;
  let textIdx = 0;
  let score = 0;
  let consecutiveMatches = 0;

  while (patternIdx < lowerPattern.length && textIdx < lowerText.length) {
    if (lowerPattern[patternIdx] === lowerText[textIdx]) {
      // Bonus for consecutive matches
      consecutiveMatches++;
      score += 1 + consecutiveMatches * 0.5;

      // Bonus for matching at start
      if (textIdx === 0) {
        score += 2;
      }

      // Bonus for matching after separator
      if (textIdx > 0) {
        const prevChar = lowerText[textIdx - 1];
        if (prevChar === " " || prevChar === "." || prevChar === "-") {
          score += 1.5;
        }
      }

      patternIdx++;
    } else {
      consecutiveMatches = 0;
    }
    textIdx++;
  }

  // Pattern must be fully matched
  if (patternIdx !== lowerPattern.length) {
    return 0;
  }

  // Normalize score by text length (prefer shorter matches)
  return score / text.length;
}

export function searchCommands(commands: Command[], query: string): Command[] {
  if (query.length === 0) {
    return commands.filter((cmd) => cmd.enabled?.() !== false);
  }

  const scored = commands
    .filter((cmd) => cmd.enabled?.() !== false)
    .map((cmd) => {
      const labelScore = fuzzyMatch(query, cmd.label);
      const descScore = cmd.description
        ? fuzzyMatch(query, cmd.description) * 0.5
        : 0;
      const categoryScore = cmd.category
        ? fuzzyMatch(query, cmd.category) * 0.3
        : 0;
      return {
        command: cmd,
        score: Math.max(labelScore, descScore, categoryScore),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((item) => item.command);
}

// ─── Command Palette State ───────────────────────────────────────────────────

export function createCommandPaletteState(
  commands: Command[]
): CommandPaletteState {
  return {
    isOpen: false,
    query: "",
    selectedIndex: 0,
    filteredCommands: commands.filter((cmd) => cmd.enabled?.() !== false),
  };
}

// ─── Command Palette Actions ─────────────────────────────────────────────────

export function createCommandPaletteActions(
  commands: Command[],
  getState: () => CommandPaletteState,
  setState: (state: CommandPaletteState) => void
): CommandPaletteActions {
  return {
    open: () => {
      const filtered = searchCommands(commands, "");
      setState({
        isOpen: true,
        query: "",
        selectedIndex: 0,
        filteredCommands: filtered,
      });
    },

    close: () => {
      setState({
        isOpen: false,
        query: "",
        selectedIndex: 0,
        filteredCommands: searchCommands(commands, ""),
      });
    },

    toggle: () => {
      const state = getState();
      if (state.isOpen) {
        setState({
          isOpen: false,
          query: "",
          selectedIndex: 0,
          filteredCommands: searchCommands(commands, ""),
        });
      } else {
        setState({
          isOpen: true,
          query: "",
          selectedIndex: 0,
          filteredCommands: searchCommands(commands, ""),
        });
      }
    },

    setQuery: (query: string) => {
      const filtered = searchCommands(commands, query);
      setState({
        ...getState(),
        query,
        selectedIndex: 0,
        filteredCommands: filtered,
      });
    },

    selectNext: () => {
      const state = getState();
      if (state.filteredCommands.length === 0) {
        return;
      }
      const nextIndex =
        (state.selectedIndex + 1) % state.filteredCommands.length;
      setState({ ...state, selectedIndex: nextIndex });
    },

    selectPrev: () => {
      const state = getState();
      if (state.filteredCommands.length === 0) {
        return;
      }
      const prevIndex =
        (state.selectedIndex - 1 + state.filteredCommands.length) %
        state.filteredCommands.length;
      setState({ ...state, selectedIndex: prevIndex });
    },

    executeSelected: () => {
      const state = getState();
      const selected = state.filteredCommands[state.selectedIndex];
      if (selected) {
        setState({ ...state, isOpen: false, query: "" });
        void selected.action();
      }
    },

    executeById: (id: string) => {
      const command = commands.find((cmd) => cmd.id === id);
      if (command && command.enabled?.() !== false) {
        setState({ ...getState(), isOpen: false, query: "" });
        void command.action();
      }
    },
  };
}

// ─── Command Palette Key Handler ─────────────────────────────────────────────

export function createCommandPaletteKeyHandler(
  actions: CommandPaletteActions,
  getState: () => CommandPaletteState
): (event: KeyEvent) => boolean {
  return (event: KeyEvent) => {
    const state = getState();

    // Open with : (colon)
    if (!state.isOpen && event.key === ":") {
      actions.open();
      return true;
    }

    if (!state.isOpen) {
      return false;
    }

    // Close with Escape
    if (event.key === "escape") {
      actions.close();
      return true;
    }

    // Navigate with arrows
    if (event.key === "up") {
      actions.selectPrev();
      return true;
    }
    if (event.key === "down") {
      actions.selectNext();
      return true;
    }

    // Execute with Enter
    if (event.key === "enter") {
      actions.executeSelected();
      return true;
    }

    // Backspace
    if (event.key === "backspace") {
      const newQuery = state.query.slice(0, -1);
      actions.setQuery(newQuery);
      return true;
    }

    // Type characters
    if (event.key.length === 1 && !event.ctrl && !event.alt) {
      actions.setQuery(state.query + event.key);
      return true;
    }

    return true; // Capture all input when open
  };
}

// ─── Standard Commands ───────────────────────────────────────────────────────

export function createStandardCommands(callbacks: {
  quit: () => void;
  help: () => void;
  refresh: () => void;
  focusPanel: (id: string) => void;
  toggleFocusMode: () => void;
  openMode: (mode: "chat" | "debug" | "plan") => void | Promise<void>;
}): Command[] {
  return [
    {
      id: "quit",
      label: "Quit",
      description: "Exit ALFRED TUI",
      shortcut: "q",
      category: "Application",
      action: callbacks.quit,
    },
    {
      id: "help",
      label: "Help",
      description: "Show keyboard shortcuts",
      shortcut: "?",
      category: "Application",
      action: callbacks.help,
    },
    {
      id: "refresh",
      label: "Refresh",
      description: "Refresh all panels",
      shortcut: "Ctrl+R",
      category: "Application",
      action: callbacks.refresh,
    },
    {
      id: "open-chat",
      label: "Open Chat",
      description: "Switch to chat mode",
      shortcut: "Ctrl+T",
      category: "Modes",
      action: () => callbacks.openMode("chat"),
    },
    {
      id: "open-debug",
      label: "Open Debug",
      description: "Switch to debug mode",
      shortcut: "Ctrl+D",
      category: "Modes",
      action: () => callbacks.openMode("debug"),
    },
    {
      id: "open-plan",
      label: "Open Planner",
      description: "Switch to planning mode",
      shortcut: "Ctrl+P",
      category: "Modes",
      action: () => callbacks.openMode("plan"),
    },
    {
      id: "focus-cognitive",
      label: "Focus Cognitive",
      description: "Focus the cognitive state panel",
      shortcut: "c",
      category: "Navigation",
      action: () => callbacks.focusPanel("cognitive"),
    },
    {
      id: "focus-workflow",
      label: "Focus Workflows",
      description: "Focus the workflow panel",
      shortcut: "w",
      category: "Navigation",
      action: () => callbacks.focusPanel("workflow"),
    },
    {
      id: "focus-metrics",
      label: "Focus Metrics",
      description: "Focus the metrics panel",
      shortcut: "m",
      category: "Navigation",
      action: () => callbacks.focusPanel("metrics"),
    },
    {
      id: "focus-voice",
      label: "Focus Voice",
      description: "Focus the voice panel",
      shortcut: "v",
      category: "Navigation",
      action: () => callbacks.focusPanel("voice"),
    },
    {
      id: "focus-knowledge",
      label: "Focus Knowledge",
      description: "Focus the knowledge panel",
      shortcut: "k",
      category: "Navigation",
      action: () => callbacks.focusPanel("knowledge"),
    },
    {
      id: "toggle-focus-mode",
      label: "Toggle Focus Mode",
      description: "Expand focused panel to full screen",
      shortcut: "Space",
      category: "Layout",
      action: callbacks.toggleFocusMode,
    },
  ];
}
