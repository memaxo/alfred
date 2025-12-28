/**
 * ALFRED TUI Base Panel
 *
 * Abstract base class for all TUI panels with lifecycle hooks.
 */

import type { KeyEvent } from "../input/keys";
import type { Rect } from "../layout/engine";
import { colors } from "../theme";
import {
  boxBottom,
  boxSide,
  boxTop,
  dim,
  fg,
  padRight,
  truncate,
} from "../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PanelContext = {
  bounds: Rect;
  focused: boolean;
  visible: boolean;
};

export type Unsubscriber = () => void;

// ─── Base Panel ──────────────────────────────────────────────────────────────

export abstract class BasePanel {
  abstract readonly id: string;
  abstract readonly label: string;

  protected _focused = false;
  protected _visible = true;
  protected _bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  protected subscriptions: Unsubscriber[] = [];

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Called when panel is first created
   */
  init(): void {
    // Override in subclass
  }

  /**
   * Called when panel is destroyed
   */
  destroy(): void {
    this.unsubscribeAll();
  }

  /**
   * Called when panel gains focus
   */
  onFocus(): void {
    this._focused = true;
  }

  /**
   * Called when panel loses focus
   */
  onBlur(): void {
    this._focused = false;
  }

  /**
   * Called when panel bounds change
   */
  onResize(bounds: Rect): void {
    this._bounds = bounds;
  }

  /**
   * Called when panel becomes visible
   */
  onShow(): void {
    this._visible = true;
  }

  /**
   * Called when panel is hidden
   */
  onHide(): void {
    this._visible = false;
  }

  // ─── Subscriptions ───────────────────────────────────────────────────────

  /**
   * Subscribe to data sources - override in subclass
   */
  subscribe(): Unsubscriber {
    return () => {};
  }

  protected addSubscription(unsub: Unsubscriber): void {
    this.subscriptions.push(unsub);
  }

  protected unsubscribeAll(): void {
    for (const unsub of this.subscriptions) {
      try {
        unsub();
      } catch {
        // Ignore cleanup errors
      }
    }
    this.subscriptions = [];
  }

  // ─── Input Handling ──────────────────────────────────────────────────────

  /**
   * Handle key input when focused - return true if handled
   */
  handleKey(_event: KeyEvent): boolean {
    return false;
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  /**
   * Render panel content - override in subclass
   */
  abstract renderContent(): string[];

  /**
   * Render full panel with border
   */
  render(): string[] {
    const { width, height } = this._bounds;
    if (width < 4 || height < 3) {
      return [];
    }

    const lines: string[] = [];
    const contentWidth = width - 2;
    const contentHeight = height - 2;

    // Top border with title
    lines.push(boxTop(width, this.label, this._focused));

    // Content
    const content = this.renderContent();
    for (let i = 0; i < contentHeight; i++) {
      const contentLine = content[i] ?? "";
      const paddedContent = padRight(
        truncate(contentLine, contentWidth),
        contentWidth
      );
      lines.push(
        `${boxSide(this._focused)}${paddedContent}${boxSide(this._focused)}`
      );
    }

    // Bottom border
    lines.push(boxBottom(width, this._focused));

    return lines;
  }

  // ─── Accessors ───────────────────────────────────────────────────────────

  get focused(): boolean {
    return this._focused;
  }

  get visible(): boolean {
    return this._visible;
  }

  get bounds(): Rect {
    return this._bounds;
  }

  get contentBounds(): Rect {
    return {
      x: this._bounds.x + 1,
      y: this._bounds.y + 1,
      width: Math.max(0, this._bounds.width - 2),
      height: Math.max(0, this._bounds.height - 2),
    };
  }
}

// ─── Simple Panel Implementation ─────────────────────────────────────────────

export class SimplePanel extends BasePanel {
  readonly id: string;
  readonly label: string;
  private lines: string[] = [];

  constructor(id: string, label: string) {
    super();
    this.id = id;
    this.label = label;
  }

  setContent(lines: string[]): void {
    this.lines = lines;
  }

  renderContent(): string[] {
    return this.lines;
  }
}

// ─── Panel Registry ──────────────────────────────────────────────────────────

export class PanelRegistry {
  private readonly panels = new Map<string, BasePanel>();

  register(panel: BasePanel): void {
    this.panels.set(panel.id, panel);
    panel.init();
  }

  unregister(id: string): void {
    const panel = this.panels.get(id);
    if (panel) {
      panel.destroy();
      this.panels.delete(id);
    }
  }

  get(id: string): BasePanel | undefined {
    return this.panels.get(id);
  }

  all(): BasePanel[] {
    return Array.from(this.panels.values());
  }

  updateBounds(layouts: Map<string, Rect>): void {
    for (const [id, bounds] of layouts) {
      const panel = this.panels.get(id);
      if (panel) {
        panel.onResize(bounds);
      }
    }
  }

  setFocused(id: string): void {
    for (const panel of this.panels.values()) {
      if (panel.id === id) {
        if (!panel.focused) {
          panel.onFocus();
        }
      } else if (panel.focused) {
        panel.onBlur();
      }
    }
  }

  destroy(): void {
    for (const panel of this.panels.values()) {
      panel.destroy();
    }
    this.panels.clear();
  }
}

// ─── Rendering Helpers ───────────────────────────────────────────────────────

export function renderLabel(
  label: string,
  value: string,
  width: number
): string {
  const labelText = dim(`${label}:`);
  const valueText = value;
  const padding = width - label.length - 1 - value.length;
  return `${labelText}${" ".repeat(Math.max(1, padding))}${valueText}`;
}

export function renderProgressRow(
  label: string,
  value: number,
  barWidth: number,
  color: string = colors.primary
): string {
  const labelText = dim(label);
  const clampedValue = Math.max(0, Math.min(1, value));
  const percentage = Math.round(clampedValue * 100);
  const filledWidth = Math.round(clampedValue * barWidth);
  const emptyWidth = Math.max(0, barWidth - filledWidth);

  const filled = fg(color)("█".repeat(filledWidth));
  const empty = dim("░".repeat(emptyWidth));
  const percentText = dim(`${percentage}%`.padStart(4));

  return `${labelText} ${filled}${empty} ${percentText}`;
}

export function renderSeparator(width: number, char = "─"): string {
  return dim(char.repeat(width));
}

export function renderEmptyState(message: string, width: number): string[] {
  const centered = message.padStart(Math.floor((width + message.length) / 2));
  return ["", dim(centered), ""];
}
