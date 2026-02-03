/**
 * ToolCalls Panel - React Component
 *
 * Migrated from packages/tui/src/tui/panels/agentfs/toolcalls.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";

import { SyntaxStyle, parseColor } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";

import type { ToolCallInfo } from "../../subscriptions/agentfs";

import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";
import { useAgentFSStore } from "../hooks/stores";

// Basic syntax style for JSON
const jsonStyle = SyntaxStyle.fromStyles({
  default: { fg: parseColor("#E6EDF3") },
  keyword: { fg: parseColor("#FF7B72"), bold: true },
  number: { fg: parseColor("#79C0FF") },
  punctuation: { fg: parseColor("#F0F6FC") },
  string: { fg: parseColor("#A5D6FF") },
});

interface ToolCallsPanelProps {
  width: number;
  height: number;
  focused: boolean;
  x?: number;
  y?: number;
}

export function ToolCallsPanel({
  width,
  height,
  focused,
  x,
  y,
}: ToolCallsPanelProps) {
  const store = useAgentFSStore();
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to AgentFS store updates
  useEffect(() => {
    if (!store) {
      setLoading(false);
      setError("AgentFS store not available");
      return;
    }

    const unsubscribe = store.subscribe((state) => {
      setToolCalls(state.toolCalls);
      setLoading(state.isLoading);
      setError(state.error);
    });

    return unsubscribe;
  }, [store]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");

  const borderColor = focused ? "cyan" : undefined;

  const statusIcon = (call: ToolCallInfo): string => {
    if (call.error) {
      return "✗";
    }
    if (!call.completed_at) {
      return "⟳";
    }
    return "✓";
  };

  const formatDuration = (ms: number): string => {
    if (!ms) {
      return "...";
    }
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!focused || toolCalls.length === 0 || loading) {
        return;
      }

      if (viewMode === "list") {
        // Selection is now handled by <select> component if we use it,
        // but for mixed layout (header + select) we might want to keep manual or wrap.
        if (event.name === "up" || event.name === "k") {
          setSelectedIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (event.name === "down" || event.name === "j") {
          setSelectedIndex((i) => Math.min(toolCalls.length - 1, i + 1));
          return;
        }
        if (event.name === "enter" || event.name === "d") {
          setViewMode("detail");
          return;
        }
      } else if (event.name === "q" || event.name === "escape") {
        setViewMode("list");
        return;
      }
    },
    [focused, toolCalls.length, loading, viewMode]
  );

  useKeyboard(handleKeyboard);

  // Reset selected index when toolCalls change
  useEffect(() => {
    if (selectedIndex >= toolCalls.length) {
      setSelectedIndex(Math.max(0, toolCalls.length - 1));
    }
  }, [toolCalls.length, selectedIndex]);

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
        title="Tool Calls"
        top={y}
        width={width}
      >
        <text content={dim("  Loading tool calls...")} />
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
        title="Tool Calls"
        top={y}
        width={width}
      >
        <text content={fg(colors.error)("✗ Error:")} />
        <text content={dim(`  ${error}`)} />
      </box>
    );
  }

  if (viewMode === "detail") {
    const call = toolCalls[selectedIndex];
    if (!call) {
      return (
        <box
          border
          height={height}
          left={x}
          style={{
            borderColor: borderColor ?? "#FFFFFF",
            borderStyle: "single",
          }}
          title="Tool Calls"
          top={y}
          width={width}
        >
          <text content={dim("  No call selected")} />
        </box>
      );
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
        title="Tool Calls"
        top={y}
        width={width}
      >
        <scrollbox focused={focused}>
          <text content={bold(fg(colors.primary)("Tool Call Details"))} />
          <text content={dim("─".repeat(Math.min(20, width)))} />
          <text content="" />
          <text content={`${bold("Tool:")} ${fg(colors.primary)(call.name)}`} />
          <text
            content={`${bold("Status:")} ${
              call.error
                ? fg(colors.error)("Failed")
                : (!call.completed_at
                  ? fg(colors.warning)("Running")
                  : fg(colors.success)("Success"))
            }`}
          />
          <text
            content={`${bold("Duration:")} ${formatDuration(call.duration_ms)}`}
          />
          <text
            content={`${bold("Started:")} ${new Date(call.started_at * 1000).toISOString()}`}
          />
          {call.completed_at && (
            <text
              content={`${bold("Completed:")} ${new Date(call.completed_at * 1000).toISOString()}`}
            />
          )}
          {call.parameters !== undefined &&
            typeof call.parameters === "object" && (
              <>
                <text content="" />
                <text content={bold("Parameters:")} />
                <code
                  content={JSON.stringify(call.parameters, null, 2)}
                  filetype="json"
                  style={{ width: "100%" }}
                  syntaxStyle={jsonStyle}
                />
              </>
            )}
          {call.result !== undefined && !call.error && (
            <>
              <text content="" />
              <text content={bold("Result:")} />
              <code
                content={JSON.stringify(call.result, null, 2)}
                filetype="json"
                style={{ width: "100%" }}
                syntaxStyle={jsonStyle}
              />
            </>
          )}
          {call.error && (
            <>
              <text content="" />
              <text content={bold("Error:")} />
              <text content={fg(colors.error)(`  ${call.error}`)} />
            </>
          )}
          <text content="" />
          <text
            content={bold(fg(colors.primary)("Press [q] to return to list"))}
          />
        </scrollbox>
      </box>
    );
  }

  // List view
  const selectOptions = toolCalls.map((c) => ({
    description: `${formatDuration(c.duration_ms)} | ${formatTime(c.started_at)}`,
    name: `${statusIcon(c)} ${c.name.padEnd(16)}`,
    value: c.id,
  }));

  return (
    <box
      border
      height={height}
      left={x}
      style={{
        borderColor: borderColor ?? "#FFFFFF",
        borderStyle: "single",
      }}
      title="Tool Calls"
      top={y}
      width={width}
    >
      <text
        content={bold(dim("  Status     Tool               Duration    Time"))}
      />
      <text content={dim("  " + "─".repeat(Math.min(50, width - 4)))} />

      {toolCalls.length === 0 ? (
        <text content={dim("  No tool calls recorded")} />
      ) : (
        <select
          focused={focused}
          height={height - 5}
          onChange={(index: number) => {
            setSelectedIndex(index);
          }}
          onSelect={(index: number) => {
            setSelectedIndex(index);
            setViewMode("detail");
          }}
          options={selectOptions}
          selectedIndex={selectedIndex}
          style={{
            selectedBackgroundColor: "#1A1F29",
            selectedTextColor: colors.primary,
          }}
          width={width - 2}
        />
      )}

      <box style={{ bottom: 0, position: "absolute" }}>
        <text
          content={dim(
            `  ${toolCalls.length} calls | [↑↓]nav [Enter/d]details`
          )}
        />
      </box>
    </box>
  );
}
