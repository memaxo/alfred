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
import { createCognitivePanel } from "../panels/cognitive";
import { HeaderPanel } from "../panels/header";
import { createKnowledgePanel } from "../panels/knowledge";
import { createMetricsPanel } from "../panels/metrics";
import { ShortcutsPanel } from "../panels/shortcuts";
import { StatusPanel } from "../panels/status";
import { createVoicePanel } from "../panels/voice";
import { createWorkflowPanel } from "../panels/workflow";
import type { TerminalSize } from "../renderer";
import { clearScreen, getCurrentSize, writeAt } from "../renderer";
import type { CognitiveStateStore } from "../subscriptions/cognitive";
import type { MetricsStore } from "../subscriptions/metrics";
import type { VoiceStore } from "../subscriptions/voice";
import type { WorkflowStore } from "../subscriptions/workflow";
import { colors } from "../theme";
import {
  boxBottom,
  boxSide,
  boxTop,
  dim,
  fg,
  inverse,
  padRight,
} from "../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DashboardState = {
  layout: AdaptiveLayoutState;
  navigation: NavigationState;
  commandPalette: CommandPaletteState;
  running: boolean;
};

export type DashboardCallbacks = {
  /**
   * Return false to cancel quitting (e.g. user declined confirmation).
   */
  onQuit?: () => boolean | Promise<boolean>;
  onRefresh?: () => void;
  onMode?: (mode: "chat" | "debug" | "plan" | "help") => void | Promise<void>;
};

export type DashboardStores = {
  cognitive?: CognitiveStateStore;
  workflow?: WorkflowStore;
  metrics?: MetricsStore;
  voice?: VoiceStore;
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export class Dashboard {
  private readonly state: DashboardState;
  private readonly registry: PanelRegistry;
  private readonly callbacks: DashboardCallbacks;
  private readonly stores: DashboardStores;
  private readonly loadRegistry: boolean;
  private renderInterval: ReturnType<typeof setInterval> | null = null;
  private initPromise: Promise<void> | null = null;
  private keyCleanup: (() => void) | null = null;
  private paused = false;
  private quitting = false;

  constructor(
    callbacks: DashboardCallbacks = {},
    stores: DashboardStores = {},
    loadRegistry = true
  ) {
    this.callbacks = callbacks;
    this.stores = stores;
    this.loadRegistry = loadRegistry;
    this.registry = new PanelRegistry();

    // Initialize state
    this.state = {
      layout: createAdaptiveLayoutState("cognitive"),
      navigation: createNavigationState(DEFAULT_PANELS, 0),
      commandPalette: createCommandPaletteState(
        createStandardCommands({
          quit: () => {
            void this.requestQuit();
          },
          help: () => {
            void this.requestMode("help");
          },
          refresh: () => callbacks.onRefresh?.(),
          openMode: (mode) => {
            void this.requestMode(mode);
          },
          focusPanel: (id) => this.focusPanel(id),
          toggleFocusMode: () => this.toggleFocusMode(),
        })
      ),
      running: false,
    };

    // Register built-in panels asynchronously
    this.initPromise = this.registerBuiltinPanels().catch((_error) => {
      // Ignore init errors
    });
  }

  private async registerBuiltinPanels(): Promise<void> {
    this.registry.register(new HeaderPanel());
    this.registry.register(new StatusPanel());
    this.registry.register(new ShortcutsPanel());

    // Register core domain panels explicitly
    this.registry.register(createCognitivePanel(this.stores.cognitive));
    this.registry.register(createWorkflowPanel(this.stores.workflow));
    this.registry.register(createMetricsPanel(this.stores.metrics));
    this.registry.register(createVoicePanel(this.stores.voice));
    this.registry.register(createKnowledgePanel());

    // Load additional panels from package registry
    if (this.loadRegistry) {
      await this.loadRegistryPanels();
    }
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
        // Skip if already registered
        if (this.registry.get(panelDef.id)) {
          continue;
        }

        try {
          // Lazy load the panel via the factory function
          const PanelClassOrInstance = await panelDef.factory();
          let panelInstance: BasePanel;

          if (typeof PanelClassOrInstance === "function") {
            // It's a constructor
            panelInstance = new (
              PanelClassOrInstance as unknown as new () => BasePanel
            )();
          } else {
            panelInstance = PanelClassOrInstance as BasePanel;
          }

          // Basic validation
          if (panelInstance && typeof panelInstance.id === "string") {
            this.registry.register(panelInstance);
          }
        } catch (_error) {
          // Skip invalid panels
        }
      }
    } catch (_error) {
      // Skip registry loading on failure
    }
  }

  /**
   * Register a custom panel
   */
  registerPanel(panel: BasePanel): void {
    this.registry.register(panel);
  }

  /**
   * Access a panel instance (useful for wiring and tests).
   */
  getPanel<TPanel extends BasePanel = BasePanel>(id: string): TPanel | null {
    return (this.registry.get(id) as TPanel | undefined) ?? null;
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
    this.keyCleanup = keyInput.onKey(this.handleKey);
    keyInput.start();

    // Initial layout calculation
    const size = getCurrentSize();
    this.updateLayout(size);

    this.startRendering();

    // Handle resize
    if (process.stdout.isTTY) {
      process.stdout.on("resize", this.handleResize);
    }

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
    this.paused = false;

    // Stop input handling
    const keyInput = getKeyInput();
    this.keyCleanup?.();
    this.keyCleanup = null;
    keyInput.stop();

    // Stop render loop
    this.stopRendering();

    // Remove resize handler
    if (process.stdout.isTTY) {
      process.stdout.off("resize", this.handleResize);
    }

    // Cleanup panels
    this.registry.destroy();
  }

  /**
   * Request to quit the dashboard (may be cancelled)
   */
  private async requestQuit(): Promise<void> {
    if (this.quitting) {
      return;
    }
    this.quitting = true;

    // Pause dashboard rendering so modals/confirm prompts can render cleanly.
    this.pauseRendering();
    try {
      const res = this.callbacks.onQuit?.();
      const shouldQuit = res === undefined ? true : await res;

      if (!shouldQuit) {
        this.resumeRendering();
        return;
      }

      this.stop();
    } finally {
      this.quitting = false;
    }
  }

  private async requestMode(
    mode: "chat" | "debug" | "plan" | "help"
  ): Promise<void> {
    if (this.quitting) {
      return;
    }
    this.quitting = true;

    this.pauseRendering();
    try {
      await this.callbacks.onMode?.(mode);
      this.stop();
    } finally {
      this.quitting = false;
    }
  }

  private startRendering(): void {
    if (this.renderInterval) {
      return;
    }
    this.renderInterval = setInterval(() => {
      this.render();
    }, 33); // ~30 FPS
    this.renderInterval.unref?.();
  }

  private stopRendering(): void {
    if (!this.renderInterval) {
      return;
    }
    clearInterval(this.renderInterval);
    this.renderInterval = null;
  }

  private pauseRendering(): void {
    if (!this.state.running || this.paused) {
      return;
    }
    this.paused = true;
    this.stopRendering();
  }

  private resumeRendering(): void {
    if (!(this.state.running && this.paused)) {
      return;
    }
    this.paused = false;
    clearScreen();
    const size = getCurrentSize();
    this.updateLayout(size);
    this.render();
    this.startRendering();
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
      void this.requestQuit();
      return true;
    }

    // Mode switches (keyboard-friendly; also available via command palette).
    if (event.ctrl && !event.alt) {
      if (event.key === "d") {
        void this.requestMode("debug");
        return true;
      }
      if (event.key === "t") {
        void this.requestMode("chat");
        return true;
      }
      if (event.key === "p") {
        void this.requestMode("plan");
        return true;
      }
    }

    if (event.key === "?" && !event.ctrl && !event.alt) {
      void this.requestMode("help");
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
        quit: () => {
          void this.requestQuit();
        },
        help: () => {
          void this.requestMode("help");
        },
        refresh: () => this.callbacks.onRefresh?.(),
        openMode: (mode) => {
          void this.requestMode(mode);
        },
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
        quit: () => {
          void this.requestQuit();
        },
        help: () => {
          void this.requestMode("help");
        },
        refresh: () => this.callbacks.onRefresh?.(),
        openMode: (mode) => {
          void this.requestMode(mode);
        },
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

    // Render each panel directly
    for (const panel of this.registry.all()) {
      try {
        const panelLines = panel.render();
        const bounds = panel.bounds;

        if (panelLines.length === 0) {
          continue;
        }

        for (let i = 0; i < panelLines.length; i++) {
          const y = bounds.y + i;
          const line = panelLines[i];
          if (line && y < size.height) {
            writeAt(bounds.x, y, line);
          }
        }
      } catch (_error) {
        // Ignore panel render errors
      }
    }

    // Render command palette overlay if open
    if (this.state.commandPalette.isOpen) {
      this.renderCommandPalette(size);
    }
  }

  private renderCommandPalette(size: TerminalSize): void {
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

    // Render palette lines directly
    for (let i = 0; i < paletteLines.length; i++) {
      const lineY = y + i;
      const line = paletteLines[i];
      if (line && lineY < size.height) {
        writeAt(x, lineY, line);
      }
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createDashboard(
  options: {
    callbacks?: DashboardCallbacks;
    stores?: DashboardStores;
    loadRegistry?: boolean;
  } = {}
): Dashboard {
  return new Dashboard(
    options.callbacks ?? {},
    options.stores ?? {},
    options.loadRegistry ?? true
  );
}
