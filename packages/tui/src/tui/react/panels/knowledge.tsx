/**
 * Knowledge Panel - React Component
 *
 * Migrated from packages/tui/src/tui/panels/knowledge/index.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";

import { getApiClient } from "../../api/client";
import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";

interface KnowledgeStats {
  nodes: number;
  edges: number;
  documents: number;
  updatedAt: number;
}

interface KnowledgeEntity {
  id: string;
  name: string;
  type: string;
  description: string | null;
  confidence: number | null;
  createdAt: string | null;
}

interface EntityDetail {
  id: string;
  name: string;
  type: string;
  description: string | null;
  facts: {
    id: string;
    predicate: string;
    object: string;
    confidence: number;
  }[];
  relations: {
    id: string;
    target: string;
    type: string;
  }[];
}

function renderSearchInput(query: string, focused: boolean): string {
  const prefix = focused ? bold(fg(colors.primary)("/")) : dim("/");
  const q = query.length > 0 ? query : dim("search knowledge");
  return `${prefix} ${q}`;
}

function renderStats(stats: KnowledgeStats): string[] {
  return [
    `  nodes: ${fg(colors.primary)(stats.nodes.toString())}`,
    `  edges: ${fg(colors.primary)(stats.edges.toString())}`,
    `  docs:  ${fg(colors.primary)(stats.documents.toString())}`,
  ];
}

interface KnowledgePanelProps {
  width: number;
  height: number;
  focused: boolean;
  x?: number;
  y?: number;
}

export function KnowledgePanel({
  width,
  height,
  focused,
  x,
  y,
}: KnowledgePanelProps) {
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [entities, setEntities] = useState<KnowledgeEntity[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState<string>("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [selectedEntity, setSelectedEntity] = useState<EntityDetail | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const borderColor = focused ? "cyan" : undefined;

  const refreshStats = useCallback(async () => {
    const client = getApiClient();
    const result = await client.getKnowledgeStats();
    if (result.data) {
      setStats({
        nodes: result.data.totalNodes,
        edges: result.data.relations,
        documents: result.data.patterns, // Using patterns as placeholder for docs in mock-like stats
        updatedAt: Date.now(),
      });
    }
  }, []);

  const searchEntities = useCallback(async (q: string) => {
    setLoading(true);
    const client = getApiClient();
    const result = await client.listEntities(q);
    if (result.data) {
      setEntities(result.data.entities);
      setSelectedIndex(0);
    }
    setLoading(false);
  }, []);

  const loadEntityDetail = useCallback(async (id: string) => {
    setLoading(true);
    const client = getApiClient();
    const result = await client.getEntity(id);
    if (result.data) {
      setSelectedEntity(result.data);
      setViewMode("detail");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshStats();
    searchEntities("");

    const interval = setInterval(refreshStats, 30_000);
    return () => clearInterval(interval);
  }, [refreshStats, searchEntities]);

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!focused) {
        return;
      }

      const alt = (event as { alt?: boolean }).alt ?? false;

      // Detail view controls
      if (viewMode === "detail") {
        if (event.name === "escape" || event.name === "q") {
          setViewMode("list");
          return;
        }
        return;
      }

      // Exit search mode
      if (searchFocused && event.name === "escape") {
        setSearchFocused(false);
        return;
      }

      // Search mode input
      if (searchFocused) {
        if (event.name === "backspace") {
          const newQuery = query.slice(0, -1);
          setQuery(newQuery);
          searchEntities(newQuery);
          return;
        }

        if (event.name === "enter") {
          setSearchFocused(false);
          return;
        }

        if (event.name.length === 1 && !event.ctrl && !alt) {
          const newQuery = query + event.name;
          setQuery(newQuery);
          searchEntities(newQuery);
          return;
        }

        return;
      }

      // List mode controls
      if (event.name === "/") {
        setSearchFocused(true);
        return;
      }

      if (entities.length > 0) {
        if (event.name === "up" || event.name === "k") {
          setSelectedIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (event.name === "down" || event.name === "j") {
          setSelectedIndex((i) => Math.min(entities.length - 1, i + 1));
          return;
        }
        if (event.name === "enter") {
          const entity = entities[selectedIndex];
          if (entity) {
            loadEntityDetail(entity.id);
          }
          return;
        }
      }
    },
    [
      focused,
      searchFocused,
      viewMode,
      query,
      entities,
      selectedIndex,
      searchEntities,
      loadEntityDetail,
    ]
  );

  useKeyboard(handleKeyboard);

  if (viewMode === "detail" && selectedEntity) {
    return (
      <box
        border
        height={height}
        left={x}
        style={{
          borderColor: borderColor ?? "#FFFFFF",
          borderStyle: "single",
        }}
        title={`Knowledge: ${selectedEntity.name}`}
        top={y}
        width={width}
      >
        <scrollbox focused={focused}>
          <text content={bold(fg(colors.primary)(selectedEntity.name))} />
          <text content={dim(selectedEntity.type)} />
          <text content="" />
          {selectedEntity.description && (
            <>
              <text content={selectedEntity.description} />
              <text content="" />
            </>
          )}

          {selectedEntity.facts.length > 0 && (
            <>
              <text content={bold(dim("Facts"))} />
              {selectedEntity.facts.map((f) => (
                <text
                  content={`  ${fg(colors.primary)(f.predicate)} ${f.object} ${dim(`(${Math.round(f.confidence * 100)}%)`)}`}
                  key={f.id}
                />
              ))}
              <text content="" />
            </>
          )}

          {selectedEntity.relations.length > 0 && (
            <>
              <text content={bold(dim("Relations"))} />
              {selectedEntity.relations.map((r) => (
                <text
                  content={`  ${dim(r.type)} → ${fg(colors.primary)(r.target)}`}
                  key={r.id}
                />
              ))}
            </>
          )}

          <text content="" />
          <text content={dim("  Press [q] or [Esc] to return")} />
        </scrollbox>
      </box>
    );
  }

  const lines: string[] = [];

  // Search input
  lines.push(renderSearchInput(query, searchFocused));
  lines.push("");

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
        <text content={renderSearchInput(query, searchFocused)} />
        <text content="" />

        {loading && <text content={dim("  Loading...")} />}

        {!loading && entities.length > 0 ? (
          <>
            {entities.map((entity, i) => {
              const isSelected = i === selectedIndex;
              const prefix = isSelected ? bold(fg(colors.primary)(">")) : " ";
              const confidence = entity.confidence
                ? dim(` (${Math.round(entity.confidence * 100)}%)`)
                : "";
              return (
                <text
                  content={`${prefix} ${fg(colors.primary)(entity.name)}${confidence}`}
                  key={entity.id}
                />
              );
            })}
          </>
        ) : (
          !loading &&
          query.length > 0 && <text content={dim("  No results found")} />
        )}

        {!loading && query.length === 0 && stats && (
          <>
            <text content="" />
            <text content={bold(dim("Graph Statistics"))} />
            {renderStats(stats).map((s, i) => (
              <text content={s} key={i} />
            ))}
          </>
        )}

        {!searchFocused && viewMode === "list" && (
          <>
            <text content="" />
            <text content={dim("  [/]search [↑↓]nav [Enter]details")} />
          </>
        )}
      </scrollbox>
    </box>
  );
}
