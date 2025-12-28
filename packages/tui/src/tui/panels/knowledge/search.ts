/**
 * ALFRED TUI Knowledge Search
 *
 * Inline search functionality for the knowledge panel.
 */

import { colors } from "../../theme";
import { bold, dim, fg, inverse, truncate } from "../../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SearchResult = {
  id: string;
  type: "fact" | "relation" | "insight";
  content: string;
  relevance: number;
  timestamp?: number;
};

export type SearchState = {
  query: string;
  results: SearchResult[];
  selectedIndex: number;
  isSearching: boolean;
};

// ─── Search State ────────────────────────────────────────────────────────────

export function createSearchState(): SearchState {
  return {
    query: "",
    results: [],
    selectedIndex: 0,
    isSearching: false,
  };
}

// ─── Result Rendering ────────────────────────────────────────────────────────

function getResultTypeIcon(type: SearchResult["type"]): string {
  switch (type) {
    case "fact":
      return fg(colors.primary)("◆");
    case "relation":
      return fg(colors.success)("─");
    case "insight":
      return fg(colors.warning)("★");
  }
}

export function renderSearchResult(
  result: SearchResult,
  width: number,
  isSelected: boolean
): string {
  const icon = getResultTypeIcon(result.type);
  const content = truncate(result.content, width - 10);

  if (isSelected) {
    return `${inverse(" > ")} ${icon} ${bold(content)}`;
  }

  return `    ${icon} ${content}`;
}

export function renderSearchResults(
  state: SearchState,
  width: number,
  maxResults = 5
): string[] {
  const lines: string[] = [];

  if (state.isSearching) {
    lines.push(dim("  Searching..."));
    return lines;
  }

  if (state.query.length === 0) {
    lines.push(dim("  Type to search knowledge"));
    return lines;
  }

  if (state.results.length === 0) {
    lines.push(dim("  No results found"));
    return lines;
  }

  const visible = state.results.slice(0, maxResults);

  for (let i = 0; i < visible.length; i++) {
    const result = visible[i];
    if (result) {
      const isSelected = i === state.selectedIndex;
      lines.push(renderSearchResult(result, width, isSelected));
    }
  }

  if (state.results.length > maxResults) {
    lines.push(
      dim(`  ... and ${state.results.length - maxResults} more results`)
    );
  }

  return lines;
}

// ─── Search Input ────────────────────────────────────────────────────────────

export function renderSearchInput(
  query: string,
  width: number,
  focused: boolean
): string {
  const prefix = focused ? fg(colors.primary)("/") : dim("/");
  const cursor = focused ? fg(colors.primary)("▌") : "";
  const placeholder =
    query.length === 0 && !focused ? dim("Search knowledge...") : "";

  const input = query + cursor + placeholder;
  const maxInputWidth = width - 3;

  return `${prefix} ${truncate(input, maxInputWidth)}`;
}

// ─── Search Actions ──────────────────────────────────────────────────────────

export type SearchActions = {
  setQuery: (query: string) => void;
  selectNext: () => void;
  selectPrev: () => void;
  executeSearch: () => Promise<void>;
  clear: () => void;
};

export function createSearchActions(
  getState: () => SearchState,
  setState: (state: SearchState) => void,
  searchFn?: (query: string) => Promise<SearchResult[]>
): SearchActions {
  return {
    setQuery: (query: string) => {
      setState({ ...getState(), query, selectedIndex: 0 });
    },

    selectNext: () => {
      const state = getState();
      if (state.results.length === 0) {
        return;
      }
      const nextIndex = (state.selectedIndex + 1) % state.results.length;
      setState({ ...state, selectedIndex: nextIndex });
    },

    selectPrev: () => {
      const state = getState();
      if (state.results.length === 0) {
        return;
      }
      const prevIndex =
        (state.selectedIndex - 1 + state.results.length) % state.results.length;
      setState({ ...state, selectedIndex: prevIndex });
    },

    executeSearch: async () => {
      const state = getState();
      if (state.query.length === 0) {
        return;
      }

      setState({ ...state, isSearching: true });

      try {
        const results = searchFn
          ? await searchFn(state.query)
          : createMockSearchResults(state.query);
        setState({ ...state, results, isSearching: false, selectedIndex: 0 });
      } catch {
        setState({ ...state, results: [], isSearching: false });
      }
    },

    clear: () => {
      setState(createSearchState());
    },
  };
}

// ─── Mock Search Results ─────────────────────────────────────────────────────

export function createMockSearchResults(query: string): SearchResult[] {
  const types: SearchResult["type"][] = ["fact", "relation", "insight"];

  return Array.from({ length: 5 }, (_, i) => {
    const type = types[i % types.length] ?? "fact";
    return {
      id: `result-${i}`,
      type,
      content: `Result for "${query}" - item ${i + 1}`,
      relevance: 1 - i * 0.1,
      timestamp: Date.now() - i * 3_600_000,
    };
  });
}

// ─── Search Hints ────────────────────────────────────────────────────────────

export function renderSearchHints(): string {
  return dim("Press / to search, Enter to select, Esc to cancel");
}

// ─── Result Preview ──────────────────────────────────────────────────────────

export function renderResultPreview(
  result: SearchResult | null,
  width: number
): string[] {
  const lines: string[] = [];

  if (!result) {
    lines.push(dim("  Select a result to preview"));
    return lines;
  }

  const icon = getResultTypeIcon(result.type);
  const typeLabel = result.type.charAt(0).toUpperCase() + result.type.slice(1);

  lines.push(`${icon} ${bold(typeLabel)}`);
  lines.push("");

  // Word wrap content
  const words = result.content.split(" ");
  let currentLine = "  ";

  for (const word of words) {
    if (currentLine.length + word.length + 1 > width) {
      lines.push(currentLine);
      currentLine = `  ${word}`;
    } else {
      currentLine += (currentLine.length > 2 ? " " : "") + word;
    }
  }

  if (currentLine.length > 2) {
    lines.push(currentLine);
  }

  // Timestamp
  if (result.timestamp) {
    const date = new Date(result.timestamp);
    lines.push("");
    lines.push(dim(`  ${date.toLocaleString()}`));
  }

  return lines;
}
