/**
 * ALFRED TUI
 *
 * Main entry point for the terminal user interface.
 */

import { renderFarewell } from "./intro/greeting";
import { runIntroSequence } from "./intro/sequence";
import {
  createChatMode,
  createDebugMode,
  createHelpMode,
  createPlanMode,
  runMode,
} from "./modes";
import {
  cleanupTerminal,
  clearScreen,
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
import type { DashboardStores } from "./views/dashboard";
import { createDashboard } from "./views/dashboard";
import { confirm } from "./views/focus";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TuiOptions = {
  skipIntro?: boolean;
  skipChecks?: boolean;
  useMockData?: boolean;
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

      // Main view loop: dashboard <-> modes (bounded by MAX_TRANSITIONS)
      await this.runLoop();
      await this.cleanup();
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Quit the application
   */
  async quit(): Promise<boolean> {
    // Check for active workflows
    const activeWorkflows = this.workflowStore.getActive();
    if (activeWorkflows.length > 0) {
      const shouldQuit = await confirm(
        `${activeWorkflows.length} workflow(s) are still active. Quit anyway?`,
        "Confirm Exit"
      );
      if (!shouldQuit) {
        return false;
      }
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

  private connectStoresToDashboard(): DashboardStores {
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
    // Show farewell message
    const size = getCurrentSize();
    const farewell = renderFarewell();
    writeAt(0, Math.floor(size.height / 2), farewell);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Cleanup subscriptions
    resetSubscriptionManager();

    // Restore terminal
    cleanupTerminal();
    showCursor();
  }

  private maxTransitions(): number {
    const raw = process.env.ALFRED_TUI_MAX_TRANSITIONS;
    if (!raw) {
      return 32;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 32;
    }
    return parsed;
  }

  private async runLoop(): Promise<void> {
    type Step =
      | { type: "dashboard" }
      | { type: "mode"; mode: "chat" | "debug" | "plan" | "help" }
      | { type: "quit" };

    let step: Step = { type: "dashboard" };
    let transitions = 0;
    const max = this.maxTransitions();

    while (this.running && step.type !== "quit") {
      transitions++;
      if (transitions > max) {
        throw new Error("tui_max_transitions");
      }

      if (step.type === "dashboard") {
        step = await this.runDashboardStep();
        continue;
      }

      if (step.type === "mode") {
        await this.runModeStep(step.mode);
        step = { type: "dashboard" };
      }
    }
  }

  private async runDashboardStep(): Promise<
    | { type: "quit" }
    | { type: "mode"; mode: "chat" | "debug" | "plan" | "help" }
  > {
    return await new Promise((resolve) => {
      const stores = this.connectStoresToDashboard();
      const dashboard = createDashboard({
        callbacks: {
          onQuit: async () => {
            const shouldQuit = await this.quit();
            if (shouldQuit) {
              resolve({ type: "quit" });
            }
            return shouldQuit;
          },
          onRefresh: () => this.refresh(),
          onMode: (mode) => {
            resolve({ type: "mode", mode });
          },
        },
        stores,
      });
      void dashboard.start();
    });
  }

  private async runModeStep(
    mode: "chat" | "debug" | "plan" | "help"
  ): Promise<void> {
    clearScreen();

    const callbacks = { managedTerminal: true };
    if (mode === "chat") {
      await runMode(createChatMode(callbacks));
      return;
    }
    if (mode === "debug") {
      await runMode(createDebugMode(callbacks));
      return;
    }
    if (mode === "help") {
      await runMode(createHelpMode(callbacks));
      return;
    }
    await runMode(createPlanMode(callbacks));
  }
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

export async function runTui(options: TuiOptions = {}): Promise<void> {
  const app = new TuiApp(options);
  await app.run();
}

// ─── Re-exports ──────────────────────────────────────────────────────────────
// Use explicit re-exports to avoid duplicate symbol conflicts

// ─── Phase 4: Interactive Modes ──────────────────────────────────────────────
export * from "./api";
export * from "./components";
export * from "./input";
export * from "./intro";
export * from "./layout";
export {
  BaseMode,
  ChatMode,
  createChatMode,
  createDebugMode,
  createPlanMode,
  DebugMode,
  PlanMode,
  runChatMode,
  runDebugMode,
  runMode,
  runPlanMode,
} from "./modes";
export {
  // Base panel types
  BasePanel,
  // Domain panels
  CognitivePanel,
  createCognitivePanel,
  createKnowledgePanel,
  createMetricsPanel,
  createVoicePanel,
  createWorkflowPanel,
  KnowledgePanel,
  MetricsPanel,
  VoicePanel,
  WorkflowPanel,
} from "./panels";
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
export * from "./views";
