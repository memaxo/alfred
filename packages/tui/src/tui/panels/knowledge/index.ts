/**
 * ALFRED TUI Knowledge Panel
 *
 * Knowledge graph overview and search panel.
 */

import type { KeyEvent } from "../../input/keys";
import { bold, dim } from "../../typography";
import { BasePanel } from "../base";
import {
  createMockRecentItems,
  type RecentKnowledgeItem,
  renderActivityTimeline,
  renderRecentItems,
} from "./recent";
import {
  createSearchActions,
  createSearchState,
  renderSearchInput,
  renderSearchResults,
  type SearchState,
} from "./search";
import {
  createMockStats,
  getKnowledgeSummary,
  type KnowledgeStats,
  renderKnowledgeStatsGrid,
} from "./stats";

// ─── Knowledge Panel ─────────────────────────────────────────────────────────

export class KnowledgePanel extends BasePanel {
  readonly id = "knowledge";
  readonly label = "Knowledge";

  private stats: KnowledgeStats | null = null;
  private recentItems: RecentKnowledgeItem[] = [];
  private searchState: SearchState;
  private searchFocused = false;

  constructor() {
    super();
    this.searchState = createSearchState();
  }

  init(): void {
    // Load initial mock data
    this.stats = createMockStats();
    this.recentItems = createMockRecentItems(10);

    // Refresh stats periodically
    const interval = setInterval(() => {
      this.stats = createMockStats();
    }, 10_000);
    interval.unref?.();

    this.addSubscription(() => clearInterval(interval));
  }

  handleKey(event: KeyEvent): boolean {
    const actions = createSearchActions(
      () => this.searchState,
      (state) => {
        this.searchState = state;
      }
    );

    // Enter search mode
    if (!this.searchFocused && event.key === "/") {
      this.searchFocused = true;
      return true;
    }

    // Exit search mode
    if (this.searchFocused && event.key === "escape") {
      this.searchFocused = false;
      actions.clear();
      return true;
    }

    // Search mode input
    if (this.searchFocused) {
      if (event.key === "enter") {
        void actions.executeSearch();
        return true;
      }

      if (event.key === "up") {
        actions.selectPrev();
        return true;
      }

      if (event.key === "down") {
        actions.selectNext();
        return true;
      }

      if (event.key === "backspace") {
        actions.setQuery(this.searchState.query.slice(0, -1));
        return true;
      }

      if (event.key.length === 1 && !event.ctrl && !event.alt) {
        actions.setQuery(this.searchState.query + event.key);
        return true;
      }

      return true;
    }

    return false;
  }

  renderContent(): string[] {
    const width = this.contentBounds.width;
    const height = this.contentBounds.height;
    const lines: string[] = [];

    // Search input
    lines.push(
      renderSearchInput(this.searchState.query, width, this.searchFocused)
    );
    lines.push("");

    // If searching, show results
    if (this.searchFocused || this.searchState.query.length > 0) {
      const resultLines = renderSearchResults(
        this.searchState,
        width,
        Math.min(height - 4, 8)
      );
      for (const line of resultLines) {
        lines.push(line);
      }

      if (this.searchFocused) {
        lines.push("");
        lines.push(dim("  Press Enter to search, Esc to cancel"));
      }

      return lines;
    }

    // Stats section
    if (this.stats) {
      lines.push(bold(dim("Graph Statistics")));
      const statsLines = renderKnowledgeStatsGrid(this.stats, width);
      for (const line of statsLines) {
        lines.push(line);
      }
      lines.push(getKnowledgeSummary(this.stats));
      lines.push("");
    }

    // Activity timeline
    const remainingHeight = height - lines.length;
    if (remainingHeight > 6) {
      lines.push(bold(dim("Recent Activity")));
      const timelineLines = renderActivityTimeline(this.recentItems, width, 24);
      for (const line of timelineLines) {
        lines.push(line);
      }
      lines.push("");
    }

    // Recent items (if space permits)
    const stillRemaining = height - lines.length;
    if (stillRemaining > 4 && this.recentItems.length > 0) {
      lines.push(bold(dim("Recent Items")));
      const recentLines = renderRecentItems(
        this.recentItems,
        width,
        stillRemaining - 2
      );
      for (const line of recentLines) {
        lines.push(line);
      }
    }

    // Search hint at bottom
    if (!this.searchFocused) {
      const padding = Math.max(0, height - lines.length - 1);
      for (let i = 0; i < padding; i++) {
        lines.push("");
      }
      lines.push(dim("  Press / to search knowledge"));
    }

    return lines;
  }

  // ─── Data Setters ────────────────────────────────────────────────────────

  setStats(stats: KnowledgeStats): void {
    this.stats = stats;
  }

  setRecentItems(items: RecentKnowledgeItem[]): void {
    this.recentItems = items;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createKnowledgePanel(): KnowledgePanel {
  return new KnowledgePanel();
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export * from "./recent";
export * from "./search";
export * from "./stats";
