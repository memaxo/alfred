/**
 * ALFRED TUI AgentFS File Browser Panel
 *
 * Virtual filesystem browser for AgentFS workspaces.
 */

import type { KeyEvent } from "../../input/keys";
import type { DirEntry } from "../../subscriptions/agentfs";
import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";
import { BasePanel } from "../base";

// ─── File Browser Panel ──────────────────────────────────────────────────────

export class AgentFSBrowserPanel extends BasePanel {
  readonly id = "agentfs-browser";
  readonly label = "AgentFS Browser";

  private currentPath = "/";
  private entries: DirEntry[] = [];
  private selectedIndex = 0;
  private loading = false;
  private error: string | null = null;

  private readonly fileIcon = (entry: DirEntry): string => {
    if (entry.isDirectory) {
      return fg(colors.primary)("📁");
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) {
      return fg(colors.warning)("📜");
    }
    if (entry.name.endsWith(".json")) {
      return fg(colors.success)("📋");
    }
    if (entry.name.endsWith(".md")) {
      return fg(colors.primary)("📝");
    }
    return "📄";
  };

  private formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);

    if (diffMins < 1) {
      return "just now";
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    return date.toLocaleDateString();
  }

  setEntries(entries: DirEntry[]): void {
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

  setCurrentPath(path: string): void {
    this.currentPath = path;
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
    const entry = this.entries[this.selectedIndex];
    if (event.key === "enter" && entry) {
      if (entry.isDirectory) {
        this.currentPath =
          this.currentPath === "/"
            ? `/${entry.name}`
            : `${this.currentPath}/${entry.name}`;
        this.selectedIndex = 0;
      }
      return true;
    }
    if (event.key === "escape" && this.currentPath !== "/") {
      const parts = this.currentPath.split("/");
      parts.pop();
      this.currentPath = parts.join("/") || "/";
      this.selectedIndex = 0;
      return true;
    }

    return false;
  }

  renderContent(): string[] {
    const width = this.contentBounds.width;
    const height = this.contentBounds.height;

    if (this.loading) {
      return [dim("  Loading AgentFS filesystem...")];
    }

    if (this.error) {
      return [
        fg(colors.error)("✗ Error:"),
        dim(`  ${this.error}`),
        "",
        dim("  Press [ESC] to go back"),
      ];
    }

    const lines: string[] = [];

    // Path header
    lines.push(bold(dim("Path: ")));
    lines.push(fg(colors.primary)(`  ${this.currentPath}`));
    lines.push("");

    // File list
    const maxEntries = height - lines.length - 2;
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

    if (visibleEntries.length === 0) {
      lines.push(dim("  (empty directory)"));
    } else {
      for (let i = 0; i < visibleEntries.length; i++) {
        const entry = visibleEntries[i];
        if (!entry) {
          continue;
        }
        const entryIndex = startIndex + i;
        const isSelected = entryIndex === this.selectedIndex;

        const icon = this.fileIcon(entry);
        const name = entry.name;
        const size =
          entry.size !== undefined ? `${this.formatSize(entry.size)} ` : "";
        const time =
          entry.mtime !== undefined ? `${this.formatTime(entry.mtime)}` : "";

        // Truncate name to fit
        const maxNameWidth = width - 4 - size.length - time.length - 2;
        const truncatedName =
          name.length > maxNameWidth
            ? `${name.slice(0, maxNameWidth - 1)}…`
            : name;
        const paddedName = truncatedName.padEnd(maxNameWidth);

        if (isSelected) {
          lines.push(
            bold(
              fg(colors.primary)(
                `> ${icon} ${paddedName}${dim(size)}${dim(time)}`
              )
            )
          );
        } else {
          lines.push(`  ${icon} ${paddedName}${dim(size)}${dim(time)}`);
        }
      }
    }

    // Footer with count
    lines.push("");
    lines.push(
      dim(`  ${this.entries.length} item(s) | [↑↓]nav [Enter]open [Esc]back`)
    );

    return lines;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createAgentFSBrowserPanel(): AgentFSBrowserPanel {
  return new AgentFSBrowserPanel();
}
