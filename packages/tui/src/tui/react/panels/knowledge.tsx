/**
 * Knowledge Panel - React Component
 *
 * Migrated from packages/tui/src/tui/panels/knowledge/index.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";
import { bold, dim } from "../../typography";

type KnowledgeStats = {
  nodes: number;
  edges: number;
  documents: number;
  updatedAt: number;
};

type RecentKnowledgeItem = {
  id: string;
  kind: "node" | "edge" | "document";
  label: string;
  timestamp: number;
};

function createMockStats(): KnowledgeStats {
  return {
    nodes: 1200 + Math.floor(Math.random() * 300),
    edges: 4200 + Math.floor(Math.random() * 800),
    documents: 30 + Math.floor(Math.random() * 10),
    updatedAt: Date.now(),
  };
}

function createMockRecentItems(count: number): RecentKnowledgeItem[] {
  const kinds: RecentKnowledgeItem["kind"][] = ["node", "edge", "document"];
  return Array.from({ length: count }, (_, i) => {
    const kind = kinds[i % kinds.length] ?? "node";
    return {
      id: `k-${i}`,
      kind,
      label:
        kind === "document"
          ? `Doc ${i + 1}`
          : kind === "edge"
            ? `Relation ${i + 1}`
            : `Concept ${i + 1}`,
      timestamp: Date.now() - i * 60_000,
    };
  });
}

function renderSearchInput(query: string, focused: boolean): string {
  const prefix = focused ? bold("/") : dim("/");
  const q = query.length > 0 ? query : dim("search knowledge");
  return `${prefix} ${q}`;
}

function renderSearchResults(
  items: RecentKnowledgeItem[],
  query: string,
  max: number
): string[] {
  const q = query.trim().toLowerCase();
  const hits = q.length
    ? items.filter((i) => i.label.toLowerCase().includes(q))
    : [];

  if (q.length === 0) {
    return [dim("  Type to search…")];
  }
  if (hits.length === 0) {
    return [dim("  No results")];
  }

  return hits.slice(0, max).map((h) => {
    const tag =
      h.kind === "document" ? "DOC" : h.kind === "edge" ? "EDGE" : "NODE";
    return `  ${dim(tag)}  ${h.label}`;
  });
}

function renderStats(stats: KnowledgeStats): string[] {
  return [
    `  nodes: ${stats.nodes}`,
    `  edges: ${stats.edges}`,
    `  docs:  ${stats.documents}`,
  ];
}

type KnowledgePanelProps = {
  width: number;
  height: number;
  focused: boolean;
  x?: number;
  y?: number;
};

export function KnowledgePanel({
  width,
  height,
  focused,
  x,
  y,
}: KnowledgePanelProps) {
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [recentItems, setRecentItems] = useState<RecentKnowledgeItem[]>([]);
  const [query, setQuery] = useState<string>("");
  const [searchFocused, setSearchFocused] = useState(false);

  const borderColor = focused ? "cyan" : undefined;

  useEffect(() => {
    // Load initial mock data
    setStats(createMockStats());
    setRecentItems(createMockRecentItems(10));

    // Refresh stats periodically
    const interval = setInterval(() => {
      setStats(createMockStats());
    }, 10_000);
    interval.unref?.();

    return () => clearInterval(interval);
  }, []);

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!focused) {
        return;
      }

      const alt = (event as { alt?: boolean }).alt ?? false;

      // Enter search mode
      if (!searchFocused && event.name === "/") {
        setSearchFocused(true);
        return;
      }

      // Exit search mode
      if (searchFocused && event.name === "escape") {
        setSearchFocused(false);
        setQuery("");
        return;
      }

      // Search mode input
      if (searchFocused) {
        if (event.name === "backspace") {
          setQuery((q) => q.slice(0, -1));
          return;
        }

        if (event.name.length === 1 && !event.ctrl && !alt) {
          setQuery((q) => q + event.name);
          return;
        }

        return;
      }
    },
    [focused, searchFocused]
  );

  useKeyboard(handleKeyboard);

  const lines: string[] = [];

  // Search input
  lines.push(renderSearchInput(query, searchFocused));
  lines.push("");

  // If searching, show results
  if (searchFocused || query.length > 0) {
    const resultLines = renderSearchResults(
      recentItems,
      query,
      Math.min(height - 4, 8)
    );
    lines.push(...resultLines);

    if (searchFocused) {
      lines.push("");
      lines.push(dim("  Press Enter to search, Esc to cancel"));
    }

    return (
      <box
        border
        height={height}
        left={x}
        style={{
          borderColor: borderColor ?? "#FFFFFF",
          borderStyle: "single",
        }}
        title="Knowledge"
        top={y}
        width={width}
      >
        <scrollbox focused={focused}>
          {lines.map((line, i) => (
            <text content={line} key={i} />
          ))}
        </scrollbox>
      </box>
    );
  }

  // Stats section
  if (stats) {
    lines.push(bold(dim("Graph Statistics")));
    lines.push(...renderStats(stats));
    lines.push(dim("  (mock data)"));
    lines.push("");
  }

  // Activity timeline
  const remainingHeight = height - lines.length;
  if (remainingHeight > 6) {
    lines.push(bold(dim("Recent Activity")));
    for (const item of recentItems.slice(0, Math.min(5, recentItems.length))) {
      const tag =
        item.kind === "document"
          ? dim("DOC")
          : item.kind === "edge"
            ? dim("EDGE")
            : dim("NODE");
      lines.push(`  ${tag}  ${item.label}`);
    }
    lines.push("");
  }

  // Recent items
  const stillRemaining = height - lines.length;
  if (stillRemaining > 4 && recentItems.length > 0) {
    lines.push(bold(dim("Recent Items")));
    for (const item of recentItems.slice(0, Math.max(1, stillRemaining - 2))) {
      lines.push(`  ${item.label}`);
    }
  }

  // Search hint at bottom
  if (!searchFocused) {
    const padding = Math.max(0, height - lines.length - 1);
    for (let i = 0; i < padding; i++) {
      lines.push("");
    }
    lines.push(dim("  Press / to search knowledge"));
  }

  return (
    <box
      border
      height={height}
      left={x}
      style={{
        borderColor: borderColor ?? "#FFFFFF",
        borderStyle: "single",
      }}
      title="Knowledge"
      top={y}
      width={width}
    >
      <scrollbox focused={focused}>
        {lines.map((line, i) => (
          <text content={line} key={i} />
        ))}
      </scrollbox>
    </box>
  );
}
