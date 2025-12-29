/**
 * ALFRED TUI AgentFS Tool Calls Panel
 *
 * Displays tool call history and statistics from AgentFS audit trail.
 */

import type { KeyEvent } from "../../input/keys";
import type { ToolCallInfo } from "../../subscriptions/agentfs";
import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";
import { BasePanel } from "../base";

// ─── Tool Calls Panel ────────────────────────────────────────────────────────

export class AgentFSToolCallsPanel extends BasePanel {
  readonly id = "agentfs-toolcalls";
  readonly label = "Tool Calls";

  private toolCalls: ToolCallInfo[] = [];
  private selectedIndex = 0;
  private viewMode: "list" | "detail" = "list";
  private loading = false;
  private error: string | null = null;

  private readonly statusIcon = (call: ToolCallInfo): string => {
    if (call.error) {
      return fg(colors.error)("✗");
    }
    return fg(colors.success)("✓");
  };

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  setToolCalls(calls: ToolCallInfo[]): void {
    this.toolCalls = calls;
    this.error = null;
  }

  setLoading(loading: boolean): void {
    this.loading = loading;
  }

  setError(error: string | null): void {
    this.error = error;
    this.loading = false;
  }

  handleKey(event: KeyEvent): boolean {
    if (this.toolCalls.length === 0 || this.loading) {
      return false;
    }

    if (this.viewMode === "list") {
      if (event.key === "up" || event.key === "k") {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        return true;
      }
      if (event.key === "down" || event.key === "j") {
        this.selectedIndex = Math.min(
          this.toolCalls.length - 1,
          this.selectedIndex + 1
        );
        return true;
      }
      if (event.key === "enter") {
        this.viewMode = "detail";
        return true;
      }
      if (event.key === "d") {
        this.viewMode = "detail";
        return true;
      }
    } else if (event.key === "q" || event.key === "escape") {
      // Detail view
      this.viewMode = "list";
      return true;
    }

    return false;
  }

  renderList(width: number, height: number): string[] {
    const lines: string[] = [];

    // Header
    lines.push(bold(dim("Tool Calls")));
    lines.push(dim("─".repeat(Math.min(20, width))));
    lines.push("");

    if (this.toolCalls.length === 0) {
      lines.push(dim("  No tool calls recorded"));
      return lines;
    }

    // Table header
    lines.push(dim("  Status     Tool               Duration    Time       "));

    // Tool call rows
    const maxEntries = height - lines.length;
    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(maxEntries / 2),
        this.toolCalls.length - maxEntries
      )
    );
    const visibleCalls = this.toolCalls.slice(
      startIndex,
      startIndex + maxEntries
    );

    for (let i = 0; i < visibleCalls.length; i++) {
      const call = visibleCalls[i];
      if (!call) {
        continue;
      }
      const callIndex = startIndex + i;
      const isSelected = callIndex === this.selectedIndex;

      const status = this.statusIcon(call);
      const toolName = call.name.padEnd(16);
      const duration = this.formatDuration(call.duration_ms).padEnd(10);
      const time = this.formatTime(call.started_at);

      const prefix = isSelected ? bold(fg(colors.primary)(">")) : " ";
      lines.push(
        `${prefix} ${status}  ${fg(colors.primary)(toolName)}  ${dim(duration)}  ${dim(time)}`
      );
    }

    // Footer
    lines.push("");
    lines.push(
      dim(`  ${this.toolCalls.length} calls | [↑↓]nav [Enter/d]details`)
    );

    return lines;
  }

  renderDetail(width: number, _height: number): string[] {
    const lines: string[] = [];
    const call = this.toolCalls[this.selectedIndex];

    if (!call) {
      return [dim("  No call selected")];
    }

    // Header
    lines.push(bold(fg(colors.primary)("Tool Call Details")));
    lines.push(dim("─".repeat(Math.min(20, width))));
    lines.push("");

    // Basic info
    lines.push(`${bold("Tool:")} ${fg(colors.primary)(call.name)}`);
    lines.push(
      `${bold("Status:")} ${call.error ? fg(colors.error)("Failed") : fg(colors.success)("Success")}`
    );
    lines.push(`${bold("Duration:")} ${this.formatDuration(call.duration_ms)}`);
    lines.push(
      `${bold("Started:")} ${new Date(call.started_at * 1000).toISOString()}`
    );
    lines.push(
      `${bold("Completed:")} ${new Date(call.completed_at * 1000).toISOString()}`
    );

    // Parameters
    if (call.parameters && typeof call.parameters === "object") {
      lines.push("");
      lines.push(bold("Parameters:"));
      const paramsStr = JSON.stringify(call.parameters, null, 2);
      for (const line of paramsStr.split("\n")) {
        lines.push(dim(`  ${line}`));
      }
    }

    // Result (if success)
    if (call.result && !call.error) {
      lines.push("");
      lines.push(bold("Result:"));
      const resultStr = JSON.stringify(call.result, null, 2);
      for (const line of resultStr.split("\n")) {
        lines.push(dim(`  ${line}`));
      }
    }

    // Error (if failed)
    if (call.error) {
      lines.push("");
      lines.push(bold("Error:"));
      lines.push(fg(colors.error)(`  ${call.error}`));
    }

    // Footer
    lines.push("");
    lines.push(bold(fg(colors.primary)("Press [q] to return to list")));

    return lines;
  }

  renderContent(): string[] {
    if (this.loading) {
      return [dim("  Loading tool calls...")];
    }

    if (this.error) {
      return [fg(colors.error)("✗ Error:"), dim(`  ${this.error}`)];
    }

    const width = this.contentBounds.width;
    const height = this.contentBounds.height;

    if (this.viewMode === "detail") {
      return this.renderDetail(width, height);
    }

    return this.renderList(width, height);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createAgentFSToolCallsPanel(): AgentFSToolCallsPanel {
  return new AgentFSToolCallsPanel();
}
