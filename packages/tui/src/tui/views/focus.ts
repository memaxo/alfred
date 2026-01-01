/**
 * ALFRED TUI Focus View
 *
 * Single-panel focus mode for detailed interaction with one panel.
 */

import { getKeyInput, isEscape, type KeyEvent } from "../input/keys";
import type { Rect } from "../layout/engine";
import type { BasePanel } from "../panels/base";
import type { TerminalSize } from "../renderer";
import { clearScreen, getCurrentSize, writeAt } from "../renderer";
import { colors } from "../theme";
import {
  boxBottom,
  boxSide,
  boxTop,
  center,
  dim,
  fg,
  padRight,
} from "../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type FocusViewState = {
  panel: BasePanel;
  running: boolean;
};

export type FocusViewCallbacks = {
  onExit?: () => void;
  onAction?: (action: string) => void;
};

// ─── Focus View ──────────────────────────────────────────────────────────────

export class FocusView {
  private readonly panel: BasePanel;
  private readonly callbacks: FocusViewCallbacks;
  private running = false;
  private renderInterval: ReturnType<typeof setInterval> | null = null;
  private keyCleanup: (() => void) | null = null;

  constructor(panel: BasePanel, callbacks: FocusViewCallbacks = {}) {
    this.panel = panel;
    this.callbacks = callbacks;
  }

  /**
   * Start focus view
   */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;

    // Setup input
    const keyInput = getKeyInput();
    this.keyCleanup = keyInput.onKey(this.handleKey);
    keyInput.start();

    // Initialize panel
    this.panel.init();
    this.panel.subscribe();

    // Update panel bounds to full screen
    const size = getCurrentSize();
    this.updateBounds(size);

    // Focus the panel
    this.panel.onFocus();

    // Start render loop
    this.renderInterval = setInterval(() => {
      this.render();
    }, 33);
    this.renderInterval.unref?.();

    // Handle resize
    if (process.stdout.isTTY) {
      process.stdout.on("resize", this.handleResize);
    }

    // Initial render
    this.render();
  }

  /**
   * Stop focus view
   */
  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;

    // Stop input
    const keyInput = getKeyInput();
    this.keyCleanup?.();
    this.keyCleanup = null;
    keyInput.stop();

    // Stop render loop
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }

    // Remove resize handler
    if (process.stdout.isTTY) {
      process.stdout.off("resize", this.handleResize);
    }

    // Cleanup panel
    this.panel.onBlur();
    this.panel.destroy();
  }

  /**
   * Exit focus view
   */
  exit(): void {
    this.stop();
    this.callbacks.onExit?.();
  }

  // ─── Layout ────────────────────────────────────────────────────────────────

  private readonly handleResize = (): void => {
    const size = getCurrentSize();
    this.updateBounds(size);
  };

  private updateBounds(size: TerminalSize): void {
    // Full screen with some padding for hints
    const bounds: Rect = {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height - 1, // Leave room for shortcut hints
    };
    this.panel.onResize(bounds);
  }

  // ─── Input Handling ────────────────────────────────────────────────────────

  private readonly handleKey = (event: KeyEvent): boolean => {
    // Exit on Escape
    if (isEscape(event)) {
      this.exit();
      return true;
    }

    // Let panel handle all other input
    return this.panel.handleKey(event);
  };

  // ─── Rendering ─────────────────────────────────────────────────────────────

  render(): void {
    const size = getCurrentSize();
    const lines: string[] = [];

    // Render panel
    const panelLines = this.panel.render();
    for (const line of panelLines) {
      lines.push(line);
    }

    // Render shortcut hints at bottom
    const hints = this.renderHints(size.width);
    lines.push(hints);

    // Write to terminal
    clearScreen();
    for (let y = 0; y < lines.length; y++) {
      writeAt(0, y, lines[y] ?? "");
    }
  }

  private renderHints(width: number): string {
    const hints = [
      { key: "Esc", desc: "Exit" },
      { key: "j/k", desc: "Navigate" },
      { key: "Enter", desc: "Select" },
    ];

    const hintStrings = hints.map((h) => {
      const key = fg(colors.primary)(`[${h.key}]`);
      const desc = dim(h.desc);
      return `${key} ${desc}`;
    });

    const separator = "  ";
    const hintLine = hintStrings.join(separator);

    return center(hintLine, width);
  }
}

// ─── Temporary Focus ─────────────────────────────────────────────────────────

/**
 * Show a panel in focus mode temporarily
 * Returns when user presses Escape
 */
export function showFocused(
  panel: BasePanel,
  callbacks: FocusViewCallbacks = {}
): Promise<void> {
  return new Promise((resolve) => {
    const view = new FocusView(panel, {
      ...callbacks,
      onExit: () => {
        callbacks.onExit?.();
        resolve();
      },
    });
    view.start();
  });
}

// ─── Modal Dialog ────────────────────────────────────────────────────────────

export type ModalOptions = {
  title: string;
  message: string;
  buttons?: { label: string; value: string }[];
  defaultButton?: string;
};

export function showModal(options: ModalOptions): Promise<string | null> {
  const {
    title,
    message,
    buttons = [{ label: "OK", value: "ok" }],
    defaultButton = buttons[0]?.value,
  } = options;

  return new Promise((resolve) => {
    let selectedIndex = buttons.findIndex((b) => b.value === defaultButton);
    if (selectedIndex === -1) {
      selectedIndex = 0;
    }

    const keyInput = getKeyInput();
    let cleanup: (() => void) | null = null;

    const handleKey = (event: KeyEvent): boolean => {
      if (event.key === "escape") {
        cleanup?.();
        resolve(null);
        return true;
      }

      if (event.key === "enter") {
        cleanup?.();
        resolve(buttons[selectedIndex]?.value ?? null);
        return true;
      }

      if (event.key === "left" || event.key === "h") {
        selectedIndex = Math.max(0, selectedIndex - 1);
        renderModal();
        return true;
      }

      if (event.key === "right" || event.key === "l") {
        selectedIndex = Math.min(buttons.length - 1, selectedIndex + 1);
        renderModal();
        return true;
      }

      if (event.key === "tab") {
        selectedIndex = (selectedIndex + 1) % buttons.length;
        renderModal();
        return true;
      }

      return true;
    };

    const renderModal = () => {
      const size = getCurrentSize();
      const width = Math.min(50, size.width - 4);
      const x = Math.floor((size.width - width) / 2);
      const y = Math.floor(size.height / 2) - 3;

      const primary = fg(colors.primary);
      const muted = fg(colors.muted);

      const lines: string[] = [];
      lines.push(boxTop(width, title, true));
      lines.push(`${boxSide(true)}${padRight("", width - 2)}${boxSide(true)}`);
      lines.push(
        `${boxSide(true)}${padRight(` ${message}`, width - 2)}${boxSide(true)}`
      );
      lines.push(`${boxSide(true)}${padRight("", width - 2)}${boxSide(true)}`);

      // Buttons
      const buttonLine = buttons
        .map((b, i) => {
          const isSelected = i === selectedIndex;
          if (isSelected) {
            return primary(`[ ${b.label} ]`);
          }
          return muted(`  ${b.label}  `);
        })
        .join(" ");

      lines.push(
        `${boxSide(true)}${center(buttonLine, width - 2)}${boxSide(true)}`
      );
      lines.push(`${boxSide(true)}${padRight("", width - 2)}${boxSide(true)}`);
      lines.push(boxBottom(width, true));

      for (let i = 0; i < lines.length; i++) {
        writeAt(x, y + i, lines[i] ?? "");
      }
    };

    cleanup = keyInput.onKey(handleKey);
    keyInput.start();
    renderModal();
  });
}

// ─── Confirm Dialog ──────────────────────────────────────────────────────────

export async function confirm(
  message: string,
  title = "Confirm"
): Promise<boolean> {
  const result = await showModal({
    title,
    message,
    buttons: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
    defaultButton: "no",
  });
  return result === "yes";
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createFocusView(
  panel: BasePanel,
  callbacks: FocusViewCallbacks = {}
): FocusView {
  return new FocusView(panel, callbacks);
}
