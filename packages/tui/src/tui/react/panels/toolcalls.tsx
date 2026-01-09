/**
 * ToolCalls Panel - React Component
 *
 * Migrated from packages/tui/src/tui/panels/agentfs/toolcalls.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";
import type { ToolCallInfo } from "../../subscriptions/agentfs";
import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";

type ToolCallsPanelProps = {
  width: number;
  height: number;
  focused: boolean;
  toolCalls: ToolCallInfo[];
  loading: boolean;
  error: string | null;
  x?: number;
  y?: number;
};

export function ToolCallsPanel({
  width,
  height,
  focused,
  toolCalls,
  loading,
  error,
  x,
  y,
}: ToolCallsPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");

  const borderColor = focused ? "cyan" : undefined;

  const statusIcon = (call: ToolCallInfo): string => {
    if (call.error) {
      return fg(colors.error)("✗");
    }
    return fg(colors.success)("✓");
  };

  const formatDuration = (ms: number): string => {
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
                : fg(colors.success)("Success")
            }`}
          />
          <text
            content={`${bold("Duration:")} ${formatDuration(call.duration_ms)}`}
          />
          <text
            content={`${bold("Started:")} ${new Date(call.started_at * 1000).toISOString()}`}
          />
          <text
            content={`${bold("Completed:")} ${new Date(call.completed_at * 1000).toISOString()}`}
          />
          {call.parameters !== undefined &&
            typeof call.parameters === "object" && (
              <>
                <text content="" />
                <text content={bold("Parameters:")} />
                {JSON.stringify(call.parameters, null, 2)
                  .split("\n")
                  .map((line, i) => (
                    <text content={dim(`  ${line}`)} key={i} />
                  ))}
              </>
            )}
          {call.result !== undefined && !call.error && (
            <>
              <text content="" />
              <text content={bold("Result:")} />
              {JSON.stringify(call.result, null, 2)
                .split("\n")
                .map((line, i) => (
                  <text content={dim(`  ${line}`)} key={i} />
                ))}
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
        <text content={bold(dim("Tool Calls"))} />
        <text content={dim("─".repeat(Math.min(20, width)))} />
        <text content="" />
        {toolCalls.length === 0 ? (
          <text content={dim("  No tool calls recorded")} />
        ) : (
          <>
            <text
              content={dim(
                "  Status     Tool               Duration    Time       "
              )}
            />
            {toolCalls.map((call, i) => {
              const isSelected = i === selectedIndex;
              const status = statusIcon(call);
              const toolName = call.name.padEnd(16);
              const duration = formatDuration(call.duration_ms).padEnd(10);
              const time = formatTime(call.started_at);
              const prefix = isSelected ? bold(fg(colors.primary)(">")) : " ";

              return (
                <text
                  content={`${prefix} ${status}  ${fg(colors.primary)(toolName)}  ${dim(duration)}  ${dim(time)}`}
                  key={call.id}
                />
              );
            })}
            <text content="" />
            <text
              content={dim(
                `  ${toolCalls.length} calls | [↑↓]nav [Enter/d]details`
              )}
            />
          </>
        )}
      </scrollbox>
    </box>
  );
}
