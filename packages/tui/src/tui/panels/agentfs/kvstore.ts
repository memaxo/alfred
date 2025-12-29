/**
 * ALFRED TUI AgentFS KV Store Panel
 *
 * Key-value store browser for AgentFS workspaces.
 */

import type { KeyEvent } from "../../input/keys";
import type { KVEntry } from "../../subscriptions/agentfs";
import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";
import { BasePanel } from "../base";

// ─── KV Store Panel ──────────────────────────────────────────────────────────

export class AgentFSKVStorePanel extends BasePanel {
  readonly id = "agentfs-kvstore";
  readonly label = "KV Store";

  private entries: KVEntry[] = [];
  private selectedIndex = 0;
  private showValue = false;
  private loading = false;
  private error: string | null = null;

  private formatValue(value: unknown): string {
    if (value === null) {
      return fg(colors.muted)("null");
    }
    if (value === undefined) {
      return fg(colors.muted)("undefined");
    }
    if (typeof value === "string") {
      return fg(colors.success)(`"${value}"`);
    }
    if (typeof value === "number") {
      return fg(colors.warning)(String(value));
    }
    if (typeof value === "boolean") {
      return value ? fg(colors.success)("true") : fg(colors.error)("false");
    }
    try {
      const str = JSON.stringify(value);
      if (str.length > 50) {
        return fg(colors.primary)(`${str.slice(0, 47)}…`);
      }
      return fg(colors.primary)(str);
    } catch {
      return fg(colors.muted)("[object]");
    }
  }

  private formatDetailedValue(value: unknown, _width: number): string[] {
    if (value === null) {
      return [fg(colors.muted)("null")];
    }
    if (value === undefined) {
      return [fg(colors.muted)("undefined")];
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return [this.formatValue(value)];
    }
    try {
      const str = JSON.stringify(value, null, 2);
      return str.split("\n").map((line) => dim(`  ${line}`));
    } catch {
      return [fg(colors.muted)("[object]")];
    }
  }

  setEntries(entries: KVEntry[]): void {
    this.entries = entries;
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
    if (this.entries.length === 0 || this.loading) {
      return false;
    }

    if (event.key === "up" || event.key === "k") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      return true;
    }
    if (event.key === "down" || event.key === "j") {
      this.selectedIndex = Math.min(
        this.entries.length - 1,
        this.selectedIndex + 1
      );
      return true;
    }
    if (event.key === "enter" || event.key === "v") {
      this.showValue = !this.showValue;
      return true;
    }
    if (event.key === "escape") {
      this.showValue = false;
      return true;
    }

    return false;
  }

  renderContent(): string[] {
    if (this.loading) {
      return [dim("  Loading KV store...")];
    }

    if (this.error) {
      return [fg(colors.error)("✗ Error:"), dim(`  ${this.error}`)];
    }

    const width = this.contentBounds.width;
    const _height = this.contentBounds.height;

    if (this.entries.length === 0) {
      return [dim("  No key-value entries")];
    }

    const lines: string[] = [];

    // Header
    lines.push(bold(dim("Key-Value Store")));
    lines.push(dim("─".repeat(Math.min(20, width))));
    lines.push("");

    // Show detailed view if selected
    const entry = this.entries[this.selectedIndex];
    if (this.showValue && entry) {
      lines.push(`${bold("Key:")} ${fg(colors.primary)(entry.key)}`);
      lines.push(
        `${bold("Updated:")} ${
          entry.updated_at
            ? new Date(entry.updated_at * 1000).toISOString()
            : "unknown"
        }`
      );
      lines.push("");
      lines.push(bold("Value:"));
      const valueLines = this.formatDetailedValue(entry.value, width);
      for (const line of valueLines) {
        lines.push(line);
      }

      lines.push("");
      lines.push(bold(fg(colors.primary)("Press [Esc/v] to close")));
      return lines;
    }

    // Table header
    lines.push(
      dim("  Key                              Value                    ")
    );
    lines.push(
      dim("  ────────────────────────────── ─────────────────────────")
    );

    // KV entries
    const maxEntries = _height - lines.length - 2;
    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(maxEntries / 2),
        this.entries.length - maxEntries
      )
    );
    const visibleEntries = this.entries.slice(
      startIndex,
      startIndex + maxEntries
    );

    for (let i = 0; i < visibleEntries.length; i++) {
      const entry = visibleEntries[i];
      if (!entry) {
        continue;
      }
      const entryIndex = startIndex + i;
      const isSelected = entryIndex === this.selectedIndex;

      const key = entry.key.padEnd(32);
      const value = this.formatValue(entry.value).padEnd(24);

      if (isSelected) {
        lines.push(bold(fg(colors.primary)(`> ${key}  ${value}`)));
      } else {
        lines.push(`  ${key}  ${value}`);
      }
    }

    // Footer
    lines.push("");
    lines.push(dim(`  ${this.entries.length} entries | [↑↓]nav [Enter/v]view`));

    return lines;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createAgentFSKVStorePanel(): AgentFSKVStorePanel {
  return new AgentFSKVStorePanel();
}
