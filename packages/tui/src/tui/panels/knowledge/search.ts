import { bold, dim, truncate } from "../../typography";

export type SearchResult = {
  id: string;
  title: string;
  snippet: string;
};

export type SearchState = {
  query: string;
  results: SearchResult[];
  selectedIndex: number;
  isSearching: boolean;
};

export function createSearchState(): SearchState {
  return {
    query: "",
    results: [],
    selectedIndex: 0,
    isSearching: false,
  };
}

function mockSearch(query: string): SearchResult[] {
  if (!query.trim()) {
    return [];
  }
  return Array.from({ length: 5 }, (_, i) => ({
    id: `s-${i}`,
    title: `${query} result ${i + 1}`,
    snippet: `Snippet for ${query} (${i + 1})`,
  }));
}

export function createSearchActions(
  get: () => SearchState,
  set: (state: SearchState) => void
): {
  setQuery: (q: string) => void;
  clear: () => void;
  selectNext: () => void;
  selectPrev: () => void;
  executeSearch: () => Promise<void>;
} {
  return {
    setQuery: (q) => set({ ...get(), query: q }),
    clear: () => set({ ...get(), query: "", results: [], selectedIndex: 0 }),
    selectNext: () => {
      const s = get();
      set({
        ...s,
        selectedIndex: Math.min(
          s.selectedIndex + 1,
          Math.max(0, s.results.length - 1)
        ),
      });
    },
    selectPrev: () => {
      const s = get();
      set({ ...s, selectedIndex: Math.max(0, s.selectedIndex - 1) });
    },
    executeSearch: async () => {
      const s = get();
      set({ ...s, isSearching: true });
      await new Promise((r) => setTimeout(r, 50));
      const results = mockSearch(s.query);
      set({ ...get(), isSearching: false, results, selectedIndex: 0 });
    },
  };
}

export function renderSearchInput(state: SearchState, width: number): string[] {
  const q = truncate(state.query, Math.max(6, width - 6));
  return [
    bold("Search"),
    `  / ${q}${dim("▌")}`,
    dim("  (Enter=search, Esc=close)"),
  ];
}

export function renderSearchResults(
  state: SearchState,
  width: number
): string[] {
  if (state.isSearching) {
    return [dim("  searching…")];
  }
  if (state.results.length === 0) {
    return [dim("  no results")];
  }

  return state.results.map((r, i) => {
    const prefix = i === state.selectedIndex ? ">" : " ";
    return `${prefix} ${truncate(r.title, Math.max(10, width - 4))}`;
  });
}
