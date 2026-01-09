/**
 * ALFRED TUI
 *
 * Main entry point for the terminal user interface.
 */

import { renderFarewell } from "./intro/greeting";
import { runIntroSequence } from "./intro/sequence";
import { createReactTui } from "./react";
import {
  cleanupTerminal,
  getCurrentSize,
  setupTerminal,
  showCursor,
  writeAt,
} from "./renderer";
import {
  createCognitiveStore,
  setupCognitiveSubscription,
} from "./subscriptions/cognitive";
import {
  getSubscriptionManager,
  resetSubscriptionManager,
} from "./subscriptions/manager";
import {
  createMetricsStore,
  setupMetricsSubscription,
} from "./subscriptions/metrics";
import {
  createVoiceStore,
  setupVoiceSubscription,
} from "./subscriptions/voice";
import {
  createWorkflowStore,
  setupWorkflowSubscription,
} from "./subscriptions/workflow";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TuiOptions = {
  skipIntro?: boolean;
  skipChecks?: boolean;
  useMockData?: boolean;
  initialMode?: "chat" | "debug" | "plan" | "help";
  headless?: boolean;
};

// ─── TUI Application ─────────────────────────────────────────────────────────

export class TuiApp {
  private readonly options: TuiOptions;
  private running = false;

  // Stores for data
  private readonly cognitiveStore = createCognitiveStore();
  private readonly workflowStore = createWorkflowStore();
  private readonly voiceStore = createVoiceStore();
  private readonly metricsStore = createMetricsStore();

  constructor(options: TuiOptions = {}) {
    this.options = {
      skipIntro: process.env.ALFRED_TUI_SKIP_INTRO === "true",
      ...options,
    };
    // Ensure env var takes precedence if true, or options take precedence if true
    if (process.env.ALFRED_TUI_SKIP_INTRO === "true") {
      this.options.skipIntro = true;
    }
  }

  /**
   * Run the TUI application
   */
  async run(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    process.on("uncaughtException", (error) => {
      cleanupTerminal();
      process.stderr.write(`UNCAUGHT EXCEPTION IN TUI: ${String(error)}\n`);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
      cleanupTerminal();
      process.stderr.write(`UNHANDLED REJECTION IN TUI: ${String(reason)}\n`);
      process.exit(1);
    });

    try {
      // Setup terminal for TUI mode
      setupTerminal();

      // Run intro sequence
      if (!this.options.skipIntro) {
        await runIntroSequence({
          skipAnimation: false,
          skipChecks: this.options.skipChecks,
        });
      }

      // Setup subscriptions
      this.setupSubscriptions();

      // Start OpenTUI React renderer
      const stores = this.connectStoresToDashboard();
      const reactTui = createReactTui({
        stores,
        initialMode: this.options.initialMode,
        headless: this.options.headless,
        callbacks: {
          onQuit: () => {
            const shouldQuit = this.quit();
            if (shouldQuit) {
              reactTui.stop();
            }
            return shouldQuit;
          },
          onRefresh: () => this.refresh(),
          onMode: (_mode) => {
            // Modes are now handled within the React dashboard
          },
        },
      });

      await reactTui.start();

      if (this.options.headless) {
        const msRaw = process.env.ALFRED_TUI_HEADLESS_MS ?? "250";
        const ms = Number.parseInt(msRaw, 10);
        const delay = Number.isFinite(ms) && ms > 0 ? ms : 250;
        await new Promise((resolve) => {
          const t = setTimeout(resolve, delay);
          (t as unknown as { unref?: () => void }).unref?.();
        });

        this.running = false;
        reactTui.stop();
        await this.cleanup();
        return;
      }

      // Keep running until this.running is false (set in quit())
      while (this.running) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await this.cleanup();
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Quit the application
   */
  quit(): boolean {
    // Check for active workflows
    const activeWorkflows = this.workflowStore.getActive();
    if (activeWorkflows.length > 0) {
      // For now, let's just proceed with quit to avoid complex async modal wiring here
    }

    this.running = false;
    return true;
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private setupSubscriptions(): void {
    const manager = getSubscriptionManager();
    const useMockData = this.options.useMockData ?? true;

    setupCognitiveSubscription({
      manager,
      store: this.cognitiveStore,
      useMockData,
    });

    setupWorkflowSubscription({
      manager,
      store: this.workflowStore,
      useMockData,
    });

    setupVoiceSubscription({
      manager,
      store: this.voiceStore,
      useMockData,
    });

    setupMetricsSubscription({
      manager,
      store: this.metricsStore,
      useMockData,
    });
  }

  private connectStoresToDashboard() {
    return {
      cognitive: this.cognitiveStore,
      workflow: this.workflowStore,
      metrics: this.metricsStore,
      voice: this.voiceStore,
    };
  }

  private refresh(): void {
    // Reset subscriptions
    resetSubscriptionManager();
    this.setupSubscriptions();
  }

  private async cleanup(): Promise<void> {
    if (process.stdout.isTTY) {
      // Show farewell message
      const size = getCurrentSize();
      const farewell = renderFarewell();
      writeAt(0, Math.floor(size.height / 2), farewell);

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Cleanup subscriptions
    resetSubscriptionManager();

    // Restore terminal
    cleanupTerminal();
    showCursor();
  }
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

export async function runTui(options: TuiOptions = {}): Promise<void> {
  const app = new TuiApp(options);
  await app.run();
}

// ─── Re-exports ──────────────────────────────────────────────────────────────
// Use explicit re-exports to avoid duplicate symbol conflicts

export * from "./api";
export * from "./intro";
export * from "./react";
export * from "./renderer";
export * from "./subscriptions";
export * from "./theme";
export {
  bg,
  bold,
  center,
  dim,
  fg,
  inverse,
  italic,
  padLeft,
  padRight,
  progressBar,
  sparkline,
  truncate,
  underline,
} from "./typography";
