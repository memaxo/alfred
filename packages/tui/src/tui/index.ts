/**
 * ALFRED TUI
 *
 * Main entry point for the terminal user interface.
 */

import { renderFarewell } from "./intro/greeting";
import { runIntroSequence } from "./intro/sequence";
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
  private quitResolver?: () => void;

  // Stores for data
  private readonly cognitiveStore = createCognitiveStore();
  private readonly workflowStore = createWorkflowStore();
  private readonly voiceStore = createVoiceStore();
  private readonly metricsStore = createMetricsStore();

  constructor(options: TuiOptions = {}) {
    this.options = options;
  }

  /**
   * Run the TUI application
   */
  async run(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

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

      // Create and start dashboard
      const dashboard = createDashboard({
        onQuit: () => this.quit(),
        onHelp: () => this.showHelp(),
        onRefresh: () => this.refresh(),
      });

      // Subscribe stores to update panels
      this.connectStoresToDashboard(dashboard);

      // Start dashboard
      dashboard.start();

      // Wait for quit signal
      await this.waitForQuit();

      // Cleanup
      dashboard.stop();
      await this.cleanup();
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Quit the application
   */
  async quit(): Promise<void> {
    // Check for active workflows
    const activeWorkflows = this.workflowStore.getActive();
    if (activeWorkflows.length > 0) {
      const shouldQuit = await confirm(
        `${activeWorkflows.length} workflow(s) are still active. Quit anyway?`,
        "Confirm Exit"
      );
      if (!shouldQuit) {
        return;
      }
    }

    this.running = false;
    this.quitResolver?.();
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

  private connectStoresToDashboard(
    _dashboard: ReturnType<typeof createDashboard>
  ): void {
    // TODO: Connect stores to dashboard panels
    // This will be implemented when domain panels are created
  }

  private showHelp(): void {}

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

  private waitForQuit(): Promise<void> {
    return new Promise((resolve) => {
      this.quitResolver = resolve;
    });
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
