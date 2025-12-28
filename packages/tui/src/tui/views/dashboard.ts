/**
 * ALFRED TUI Dashboard View
 *
 * Main dashboard composition with multiple panels.
 */

import { getRegistry } from "../../registry";
import type { CommandPaletteState } from "../input/commands";
import {
  createCommandPaletteActions,
  createCommandPaletteState,
  createStandardCommands,
} from "../input/commands";
import { getKeyInput, type KeyEvent } from "../input/keys";
import {
  createNavigationActions,
  createNavigationState,
  DEFAULT_PANELS,
  type NavigationState,
} from "../input/navigation";
import {
  type AdaptiveLayoutState,
  calculateAdaptiveLayout,
  createAdaptiveLayoutActions,
  createAdaptiveLayoutState,
} from "../layout/adaptive";
import { type BasePanel, PanelRegistry } from "../panels/base";
import { HeaderPanel } from "../panels/header";
import { ShortcutsPanel } from "../panels/shortcuts";
import { StatusPanel } from "../panels/status";
import type { TerminalSize } from "../renderer";
import { clearScreen, getCurrentSize, writeAt } from "../renderer";
import { colors } from "../theme";
import {
  boxBottom,
  boxSide,
  boxTop,
  dim,
  fg,
  inverse,
  padRight,
  visibleLength,
} from "../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DashboardState = {
  layout: AdaptiveLayoutState;
  navigation: NavigationState;
  commandPalette: CommandPaletteState;
  running: boolean;
};

export type DashboardCallbacks = {
  onQuit?: () => void;
  onHelp?: () => void;
  onRefresh?: () => void;
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export class Dashboard {
  private readonly state: DashboardState;
  private readonly registry: PanelRegistry;
  private readonly callbacks: DashboardCallbacks;
  private renderInterval: ReturnType<typeof setInterval> | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(callbacks: DashboardCallbacks = {}) {
    this.callbacks = callbacks;
    this.registry = new PanelRegistry();

    // Initialize state
    this.state = {
      layout: createAdaptiveLayoutState("cognitive"),
      navigation: createNavigationState(DEFAULT_PANELS, 0),
      commandPalette: createCommandPaletteState(
        createStandardCommands({
          quit: () => this.quit(),
          help: () => callbacks.onHelp?.(),
          refresh: () => callbacks.onRefresh?.(),
          focusPanel: (id) => this.focusPanel(id),
          toggleFocusMode: () => this.toggleFocusMode(),
        })
      ),
      running: false,
    };

    // Register built-in panels asynchronously
    this.initPromise = this.registerBuiltinPanels();
  }

  private async registerBuiltinPanels(): Promise<void> {
    this.registry.register(new HeaderPanel());
    this.registry.register(new StatusPanel());
    this.registry.register(new ShortcutsPanel());

    // Load panels from package registry
    await this.loadRegistryPanels();
  }

  private async loadRegistryPanels(): Promise<void> {
    try {
      const packageRegistry = getRegistry();

      // Initialize if not already done
      if (packageRegistry.getAll().length === 0) {
        await packageRegistry.initialize();
      }

      const panels = packageRegistry.getAllPanels();

      for (const panelDef of panels) {
        try {
          // Lazy load the panel via the factory function
          const panelInstance = await panelDef.factory();
          this.registry.register(panelInstance as BasePanel);
        } catch (error) {
          console.error(
            `[Dashboard] Failed to load panel ${panelDef.id} from ${panelDef.package}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("[Dashboard] Failed to load registry panels:", error);
    }
  }

  /**
   * Register a custom panel
   */
  registerPanel(panel: BasePanel): void {
    this.registry.register(panel);
  }

  /**
   * Start the dashboard
   */
  async start(): Promise<void> {
    if (this.state.running) {
      return;
    }

    // Wait for panel initialization
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }

    this.state.running = true;

    // Setup input handling
    const keyInput = getKeyInput();
    keyInput.onKey(this.handleKey);
    keyInput.start();

    // Initial layout calculation
    const size = getCurrentSize();
    this.updateLayout(size);

    // Start render loop
    this.renderInterval = setInterval(() => {
      this.render();
    }, 33); // ~30 FPS

    // Handle resize
    process.stdout.on("resize", this.handleResize);

    // Initial render
    this.render();
  }

  /**
   * Stop the dashboard
   */
  stop(): void {
    if (!this.state.running) {
      return;
    }
    this.state.running = false;

    // Stop input handling
    const keyInput = getKeyInput();
    keyInput.stop();

    // Stop render loop
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }

    // Remove resize handler
    process.stdout.off("resize", this.handleResize);

    // Cleanup panels
    this.registry.destroy();
  }

  /**
   * Quit the dashboard
   */
  quit(): void {
    this.stop();
    this.callbacks.onQuit?.();
  }

  // ─── Layout ────────────────────────────────────────────────────────────────

  private readonly handleResize = (): void => {
    const size = getCurrentSize();
    this.updateLayout(size);
  };

  private updateLayout(size: TerminalSize): void {
    const layoutActions = createAdaptiveLayoutActions(
      () => this.state.layout,
      (layout) => {
        this.state.layout = layout;
      }
    );
    layoutActions.updateForSize(size);

    // Calculate panel bounds
    const bounds = calculateAdaptiveLayout(this.state.layout, size);
    this.registry.updateBounds(bounds);
  }

  // ─── Input Handling ────────────────────────────────────────────────────────

  private readonly handleKey = (event: KeyEvent): boolean => {
    // Command palette takes priority when open
    if (this.state.commandPalette.isOpen) {
      return this.handleCommandPaletteKey(event);
    }

    // Global shortcuts
    if (event.key === "q" && !event.ctrl && !event.alt) {
      this.quit();
      return true;
    }

    if (event.key === "?" && !event.ctrl && !event.alt) {
      this.callbacks.onHelp?.();
      return true;
    }

    if (event.key === ":" && !event.ctrl && !event.alt) {
      this.openCommandPalette();
      return true;
    }

    if (event.key === "space" && !event.ctrl && !event.alt) {
      this.toggleFocusMode();
      return true;
    }

    // Navigation
    if (event.key === "tab") {
      const actions = createNavigationActions(
        () => this.state.navigation,
        (nav) => {
          this.state.navigation = nav;
          this.syncFocus();
        }
      );
      if (event.shift) {
        actions.focusPrev();
      } else {
        actions.focusNext();
      }
      return true;
    }

    // Number keys for direct panel access
    if (/^[1-9]$/.test(event.key)) {
      const index = Number.parseInt(event.key, 10) - 1;
      const actions = createNavigationActions(
        () => this.state.navigation,
        (nav) => {
          this.state.navigation = nav;
          this.syncFocus();
        }
      );
      actions.focusByIndex(index);
      return true;
    }

    // Let focused panel handle input
    const focusedPanel = this.registry.get(this.state.navigation.focusedId);
    if (focusedPanel) {
      return focusedPanel.handleKey(event);
    }

    return false;
  };

  private handleCommandPaletteKey(event: KeyEvent): boolean {
    const actions = createCommandPaletteActions(
      createStandardCommands({
        quit: () => this.quit(),
        help: () => this.callbacks.onHelp?.(),
        refresh: () => this.callbacks.onRefresh?.(),
        focusPanel: (id) => this.focusPanel(id),
        toggleFocusMode: () => this.toggleFocusMode(),
      }),
      () => this.state.commandPalette,
      (cp) => {
        this.state.commandPalette = cp;
      }
    );

    if (event.key === "escape") {
      actions.close();
      return true;
    }

    if (event.key === "enter") {
      actions.executeSelected();
      return true;
    }

    if (event.key === "up") {
      actions.selectPrev();
      return true;
    }

    if (event.key === "down") {
      actions.selectNext();
      return true;
    }

    if (event.key === "backspace") {
      const newQuery = this.state.commandPalette.query.slice(0, -1);
      actions.setQuery(newQuery);
      return true;
    }

    if (event.key.length === 1 && !event.ctrl && !event.alt) {
      actions.setQuery(this.state.commandPalette.query + event.key);
      return true;
    }

    return true;
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  focusPanel(id: string): void {
    const actions = createNavigationActions(
      () => this.state.navigation,
      (nav) => {
        this.state.navigation = nav;
        this.syncFocus();
      }
    );
    actions.focusById(id);
  }

  toggleFocusMode(): void {
    const layoutActions = createAdaptiveLayoutActions(
      () => this.state.layout,
      (layout) => {
        this.state.layout = layout;
      }
    );
    layoutActions.toggleFocusMode();
    this.updateLayout(getCurrentSize());
  }

  openCommandPalette(): void {
    const actions = createCommandPaletteActions(
      createStandardCommands({
        quit: () => this.quit(),
        help: () => this.callbacks.onHelp?.(),
        refresh: () => this.callbacks.onRefresh?.(),
        focusPanel: (id) => this.focusPanel(id),
        toggleFocusMode: () => this.toggleFocusMode(),
      }),
      () => this.state.commandPalette,
      (cp) => {
        this.state.commandPalette = cp;
      }
    );
    actions.open();
  }

  private syncFocus(): void {
    this.registry.setFocused(this.state.navigation.focusedId);

    // Update shortcuts panel context
    const shortcutsPanel = this.registry.get("shortcuts") as
      | ShortcutsPanel
      | undefined;
    if (shortcutsPanel) {
      shortcutsPanel.setContext("panel");
    }
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  render(): void {
    const size = getCurrentSize();
    const lines: string[] = [];

    // Render each panel
    for (const panel of this.registry.all()) {
      const panelLines = panel.render();
      const bounds = panel.bounds;

      for (let i = 0; i < panelLines.length; i++) {
        const y = bounds.y + i;
        const line = panelLines[i];
        if (line && y < size.height) {
          while (lines.length <= y) {
            lines.push(" ".repeat(size.width));
          }
          // Insert panel line at correct position
          const existingLine = lines[y] ?? " ".repeat(size.width);
          const before = existingLine.slice(0, bounds.x);
          const after = existingLine.slice(bounds.x + visibleLength(line));
          lines[y] = before + line + after;
        }
      }
    }

    // Render command palette overlay if open
    if (this.state.commandPalette.isOpen) {
      this.renderCommandPalette(lines, size);
    }

    // Write to terminal
    clearScreen();
    for (let y = 0; y < lines.length; y++) {
      writeAt(0, y, lines[y] ?? "");
    }
  }

  private renderCommandPalette(lines: string[], size: TerminalSize): void {
    const { query, filteredCommands, selectedIndex } =
      this.state.commandPalette;

    const width = Math.min(60, size.width - 4);
    const height = Math.min(10, filteredCommands.length + 3);
    const x = Math.floor((size.width - width) / 2);
    const y = Math.floor((size.height - height) / 2);

    const primary = fg(colors.primary);
    const muted = fg(colors.muted);

    // Draw command palette box
    const paletteLines: string[] = [];

    // Top border
    paletteLines.push(boxTop(width, "Commands", true));

    // Search input
    const inputLine = ` ${primary(">")} ${query}${dim("▌")}`;
    paletteLines.push(
      `${boxSide(true)}${padRight(inputLine, width - 2)}${boxSide(true)}`
    );

    // Separator
    paletteLines.push(
      `${boxSide(true)}${dim("─".repeat(width - 2))}${boxSide(true)}`
    );

    // Commands
    const visibleCommands = filteredCommands.slice(0, height - 4);
    for (let i = 0; i < visibleCommands.length; i++) {
      const cmd = visibleCommands[i];
      if (!cmd) {
        continue;
      }
      const isSelected = i === selectedIndex;
      const prefix = isSelected ? inverse(" > ") : "   ";
      const label = isSelected ? primary(cmd.label) : cmd.label;
      const shortcut = cmd.shortcut ? muted(` [${cmd.shortcut}]`) : "";
      const line = `${prefix}${label}${shortcut}`;
      paletteLines.push(
        `${boxSide(true)}${padRight(line, width - 2)}${boxSide(true)}`
      );
    }

    // Bottom border
    paletteLines.push(boxBottom(width, true));

    // Overlay on existing lines
    for (let i = 0; i < paletteLines.length; i++) {
      const lineY = y + i;
      const line = paletteLines[i];
      if (line && lineY < size.height) {
        while (lines.length <= lineY) {
          lines.push(" ".repeat(size.width));
        }
        const existingLine = lines[lineY] ?? " ".repeat(size.width);
        const before = existingLine.slice(0, x);
        const after = existingLine.slice(x + width);
        lines[lineY] = before + line + after;
      }
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createDashboard(callbacks: DashboardCallbacks = {}): Dashboard {
  return new Dashboard(callbacks);
}
