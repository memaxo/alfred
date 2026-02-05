/**
 * AgentFS Panel - React Component
 *
 * Displays AgentFS workspace directory and KV store.
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DirEntry, KVEntry } from "../../subscriptions/agentfs";

import { colors } from "../../theme";
import { bold, dim, fg, truncate } from "../../typography";
import { useAgentFSStore, useSelectionStore } from "../hooks/stores";
import { createVimMotionState, handleVimMotion } from "../vim";

interface AgentFSPanelProps {
  width: number;
  height: number;
  focused: boolean;
  x?: number;
  y?: number;
}

export function AgentFSPanel({
  width,
  height,
  focused,
  x,
  y,
}: AgentFSPanelProps) {
  const store = useAgentFSStore();
  const selection = useSelectionStore();
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [kvStore, setKvStore] = useState<KVEntry[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"files" | "kv">("files");
  const vimStateRef = useRef(createVimMotionState());

  // Subscribe to AgentFS store updates
  useEffect(() => {
    if (!store) {
      setLoading(false);
      setError("AgentFS store not available");
      return;
    }

    const unsubscribe = store.subscribe((state) => {
      setEntries(state.entries);
      setKvStore(state.kvStore);
      setRunId(state.runId);
      setLoading(state.isLoading);
      setError(state.error);
    });

    return unsubscribe;
  }, [store]);

  useEffect(() => {
    if (!selection) {
      return;
    }
    const unsub = selection.subscribe((s) => {
      setSelectedRunId(s.runId);
    });
    return unsub;
  }, [selection]);

  const borderColor = focused ? "cyan" : undefined;

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!focused) {
        return;
      }

      const currentItems = viewMode === "files" ? entries : kvStore;

      // Tab to switch between files and kv view
      if (event.name === "tab") {
        vimStateRef.current.pendingG = false;
        setViewMode((mode) => (mode === "files" ? "kv" : "files"));
        setSelectedIndex(0);
        return;
      }

      // Navigation
      if (currentItems.length > 0) {
        const motion = handleVimMotion(event, vimStateRef.current);
        if (motion === "top") {
          setSelectedIndex(0);
          return;
        }
        if (motion === "bottom") {
          setSelectedIndex(currentItems.length - 1);
          return;
        }
        if (event.name === "up" || event.name === "k") {
          setSelectedIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (event.name === "down" || event.name === "j") {
          setSelectedIndex((i) => Math.min(currentItems.length - 1, i + 1));
          return;
        }
      }
    },
    [focused, entries, kvStore, viewMode]
  );

  useKeyboard(handleKeyboard);

  // Reset selected index when entries change
  useEffect(() => {
    const currentItems = viewMode === "files" ? entries : kvStore;
    if (selectedIndex >= currentItems.length) {
      setSelectedIndex(Math.max(0, currentItems.length - 1));
    }
  }, [entries.length, kvStore.length, viewMode, selectedIndex]);

  if (loading) {
    return (
      <box
        border
        height={height}
        left={x}
        style={{
          borderColor: borderColor ?? "#FFFFFF",
          borderStyle: "single",
        }}
        title="AgentFS"
        top={y}
        width={width}
      >
        <text content={dim("  Loading AgentFS...")} />
      </box>
    );
  }

  if (error) {
    return (
      <box
        border
        height={height}
        left={x}
        style={{
          borderColor: borderColor ?? "#FFFFFF",
          borderStyle: "single",
        }}
        title="AgentFS"
        top={y}
        width={width}
      >
        <text content={fg(colors.error)("✗ Error:")} />
        <text content={dim(`  ${error}`)} />
      </box>
    );
  }

  const formatSize = (size?: number): string => {
    if (size === undefined) {
      return "";
    }
    if (size < 1024) {
      return `${size}B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)}KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  };

  const formatTime = (timestamp?: number): string => {
    if (!timestamp) {
      return "";
    }
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const hint =
    selectedRunId && !runId
      ? `Selected ${truncate(selectedRunId, 12)} (not attached). Use Workflows panel [r] prepare.`
      : (selectedRunId && runId && selectedRunId !== runId
        ? `Viewing ${truncate(runId, 12)} (selected ${truncate(selectedRunId, 12)}).`
        : null);

  return (
    <box
      border
      height={height}
      left={x}
      style={{
        borderColor: borderColor ?? "#FFFFFF",
        borderStyle: "single",
      }}
      title={`AgentFS${runId ? `: ${truncate(runId, 12)}` : ""}`}
      top={y}
      width={width}
    >
      <scrollbox focused={focused}>
        {hint && (
          <>
            <text content={dim(`  ${hint}`)} />
            <text content="" />
          </>
        )}
        {/* Tabs */}
        <text
          content={`${
            viewMode === "files" ? bold("Files") : dim("Files")
          } | ${viewMode === "kv" ? bold("KV Store") : dim("KV Store")}`}
        />
        <text content={dim("─".repeat(Math.min(30, width - 4)))} />
        <text content="" />

        {viewMode === "files" ? (
          <>
            {entries.length === 0 ? (
              <text content={dim("  No files")} />
            ) : (
              entries.map((entry, i) => {
                const isSelected = i === selectedIndex;
                const prefix = isSelected ? bold(fg(colors.primary)(">")) : " ";
                const icon = entry.isDirectory ? "📁" : "📄";
                const name = truncate(entry.name, width - 16);
                const size = formatSize(entry.size);
                const time = formatTime(entry.mtime);
                return (
                  <text
                    content={`${prefix} ${icon} ${name.padEnd(width - 16)} ${size.padStart(6)} ${time}`}
                    key={entry.name}
                  />
                );
              })
            )}
          </>
        ) : (
          <>
            {kvStore.length === 0 ? (
              <text content={dim("  No KV entries")} />
            ) : (
              kvStore.map((entry, i) => {
                const isSelected = i === selectedIndex;
                const prefix = isSelected ? bold(fg(colors.primary)(">")) : " ";
                const key = truncate(entry.key, width - 12);
                const value = JSON.stringify(entry.value).slice(0, width - 20);
                return (
                  <text
                    content={`${prefix} ${key}: ${dim(value)}`}
                    key={entry.key}
                  />
                );
              })
            )}
          </>
        )}

        <text content="" />
        <text
          content={dim(
            `  [Tab]switch [↑↓]nav [gg/G]jump | ${entries.length} files, ${kvStore.length} KV`
          )}
        />
      </scrollbox>
    </box>
  );
}
