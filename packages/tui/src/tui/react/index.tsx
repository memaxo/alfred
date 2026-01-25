/**
 * OpenTUI React TUI Entry Point
 *
 * Creates the OpenTUI React root and renders the dashboard.
 */

/** @jsxImportSource @opentui/react */

import { type CliRenderer, createCliRenderer } from "@opentui/core";
import { createRoot, type Root } from "@opentui/react";

import type { TuiStores } from "./hooks/stores";

import { Dashboard, type DashboardCallbacks } from "./dashboard";

export interface ReactTuiOptions {
  stores: TuiStores;
  callbacks: DashboardCallbacks;
  initialMode?: "chat" | "debug" | "plan" | "help";
  headless?: boolean;
}

export class ReactTuiApp {
  private renderer: CliRenderer | null = null;
  private root: Root | null = null;
  private readonly stores: TuiStores;
  private readonly callbacks: DashboardCallbacks;
  private readonly initialMode?: "chat" | "debug" | "plan" | "help";
  private readonly headless?: boolean;

  constructor(options: ReactTuiOptions) {
    this.stores = options.stores;
    this.callbacks = options.callbacks;
    this.initialMode = options.initialMode;
    this.headless = options.headless;
  }

  async start(): Promise<void> {
    // Create CLI renderer (async factory)
    this.renderer = await createCliRenderer({
      exitOnCtrlC: !this.headless,
      useAlternateScreen: !this.headless,
      useThread: !this.headless, // Disable threading in headless/CI
      gatherStats: !this.headless, // Disable stats gathering in headless
    });

    // Create React root and render dashboard
    this.root = createRoot(this.renderer);
    this.root.render(
      <Dashboard
        callbacks={this.callbacks}
        initialMode={this.initialMode}
        stores={this.stores}
      />
    );

    // Start the renderer
    this.renderer.start();
  }

  stop(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
  }
}

export function createReactTui(options: ReactTuiOptions): ReactTuiApp {
  return new ReactTuiApp(options);
}

export { Dashboard } from "./dashboard";
export * from "./hooks";
