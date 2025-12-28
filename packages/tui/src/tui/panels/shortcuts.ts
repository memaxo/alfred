/**
 * ALFRED TUI Shortcuts Panel
 *
 * Context-sensitive keyboard shortcut hints at the bottom of the screen.
 */

import { dim, inverse, padRight } from "../typography";
import { BasePanel } from "./base";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Shortcut = {
  key: string;
  description: string;
  visible?: boolean;
};

export type ShortcutGroup = {
  name: string;
  shortcuts: Shortcut[];
};

// ─── Default Shortcuts ───────────────────────────────────────────────────────

export const GLOBAL_SHORTCUTS: Shortcut[] = [
  { key: "Tab", description: "Next panel" },
  { key: "q", description: "Quit" },
  { key: "?", description: "Help" },
  { key: ":", description: "Commands" },
];

export const PANEL_SHORTCUTS: Shortcut[] = [
  { key: "j/k", description: "Navigate" },
  { key: "Space", description: "Expand" },
  { key: "Enter", description: "Select" },
];

export const MODAL_SHORTCUTS: Shortcut[] = [
  { key: "Esc", description: "Close" },
  { key: "Enter", description: "Confirm" },
  { key: "↑/↓", description: "Navigate" },
];

// ─── Shortcut Rendering ──────────────────────────────────────────────────────

function renderShortcut(shortcut: Shortcut): string {
  const keyStyle = inverse(` ${shortcut.key} `);
  const descStyle = dim(shortcut.description);
  return `${keyStyle} ${descStyle}`;
}

function getShortcutWidth(shortcut: Shortcut): number {
  // Key in brackets + space + description
  return shortcut.key.length + 3 + shortcut.description.length;
}

// ─── Shortcuts Panel ─────────────────────────────────────────────────────────

export class ShortcutsPanel extends BasePanel {
  readonly id = "shortcuts";
  readonly label = "Shortcuts";

  private shortcuts: Shortcut[] = GLOBAL_SHORTCUTS;

  setContext(context: "global" | "panel" | "modal" | "command"): void {
    switch (context) {
      case "global":
        this.shortcuts = GLOBAL_SHORTCUTS;
        break;
      case "panel":
        this.shortcuts = [...PANEL_SHORTCUTS, ...GLOBAL_SHORTCUTS.slice(1)];
        break;
      case "modal":
        this.shortcuts = MODAL_SHORTCUTS;
        break;
      case "command":
        this.shortcuts = [
          { key: "Esc", description: "Cancel" },
          { key: "Enter", description: "Execute" },
          { key: "↑/↓", description: "Select" },
        ];
        break;
    }
  }

  setShortcuts(shortcuts: Shortcut[]): void {
    this.shortcuts = shortcuts;
  }

  renderContent(): string[] {
    const width = this.contentBounds.width;
    const visibleShortcuts = this.shortcuts.filter((s) => s.visible !== false);

    // Calculate how many shortcuts fit
    const shortcutWidths = visibleShortcuts.map(getShortcutWidth);
    const separator = "  ";
    const separatorWidth = separator.length;

    const fittingShortcuts: Shortcut[] = [];
    let totalWidth = 0;

    for (let i = 0; i < visibleShortcuts.length; i++) {
      const shortcut = visibleShortcuts[i];
      const shortcutWidth = shortcutWidths[i];
      if (shortcut === undefined || shortcutWidth === undefined) {
        continue;
      }

      const additionalWidth =
        fittingShortcuts.length > 0
          ? shortcutWidth + separatorWidth
          : shortcutWidth;

      if (totalWidth + additionalWidth <= width) {
        fittingShortcuts.push(shortcut);
        totalWidth += additionalWidth;
      } else {
        break;
      }
    }

    const rendered = fittingShortcuts.map(renderShortcut).join(separator);
    return [rendered];
  }

  render(): string[] {
    const { width } = this._bounds;
    if (width < 10) {
      return [];
    }

    const lines: string[] = [];

    // Top separator
    lines.push(dim("─".repeat(width)));

    // Shortcuts line
    const content = this.renderContent();
    for (const line of content) {
      lines.push(padRight(` ${line}`, width));
    }

    return lines;
  }
}

// ─── Contextual Shortcuts Builder ────────────────────────────────────────────

export class ShortcutBuilder {
  private readonly shortcuts: Shortcut[] = [];

  add(key: string, description: string): this {
    this.shortcuts.push({ key, description });
    return this;
  }

  addIf(condition: boolean, key: string, description: string): this {
    if (condition) {
      this.shortcuts.push({ key, description });
    }
    return this;
  }

  build(): Shortcut[] {
    return [...this.shortcuts];
  }

  static global(): ShortcutBuilder {
    return new ShortcutBuilder()
      .add("Tab", "Next")
      .add("q", "Quit")
      .add("?", "Help")
      .add(":", "Cmd");
  }

  static panel(canScroll = true, canSelect = false): ShortcutBuilder {
    const builder = new ShortcutBuilder();
    if (canScroll) {
      builder.add("j/k", "Scroll");
    }
    builder.add("Space", "Expand");
    if (canSelect) {
      builder.add("Enter", "Select");
    }
    return builder.add("Tab", "Next").add("q", "Quit");
  }

  static modal(): ShortcutBuilder {
    return new ShortcutBuilder()
      .add("Esc", "Cancel")
      .add("Enter", "Confirm")
      .add("↑/↓", "Navigate");
  }

  static search(): ShortcutBuilder {
    return new ShortcutBuilder()
      .add("Esc", "Cancel")
      .add("Enter", "Search")
      .add("↑/↓", "History");
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createShortcutsPanel(): ShortcutsPanel {
  return new ShortcutsPanel();
}
