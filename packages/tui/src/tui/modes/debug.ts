/**
 * ALFRED TUI Debug Mode
 *
 * Real-time system diagnostics - cognitive state, metrics, logs.
 */

import { getApiClient } from "../api/client";
import {
  createStatusBarState,
  DEBUG_HINTS,
  renderHintBar,
  type StatusBarState,
} from "../components/status";
import type { KeyEvent } from "../input/keys";
import { isEscape, isQuit } from "../input/keys";
import type { TerminalSize } from "../renderer";
import { colors } from "../theme";
import {
  bold,
  boxBottom,
  boxSide,
  boxTop,
  dim,
  fg,
  padRight,
  progressBar,
  sparkline,
} from "../typography";
import { BaseMode, type ModeCallbacks } from "./base";

// ─── Types ───────────────────────────────────────────────────────────────────

type DebugPanel = "cognitive" | "metrics" | "active" | "logs";

type CognitiveData = {
  phase: string;
  autonomy: number;
  since?: number;
};

type MetricsData = {
  requestsPerMin: number;
  latencyP50: number;
  latencyP99: number;
  errorRate: number;
  latencyHistory: number[];
};

type ActiveData = {
  workflows: number;
  voiceSessions: number;
  subscriptions: number;
};

type LogEntry = {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: Date;
};

type DebugModeState = {
  status: StatusBarState;
  focusedPanel: DebugPanel;
  cognitive: CognitiveData | null;
  metrics: MetricsData | null;
  active: ActiveData | null;
  logs: LogEntry[];
  lastRefresh: Date | null;
  isRefreshing: boolean;
  error: string | null;
};

// ─── Debug Mode ──────────────────────────────────────────────────────────────

export class DebugMode extends BaseMode {
  private state!: DebugModeState;
  private readonly apiClient = getApiClient();
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(callbacks: ModeCallbacks = {}) {
    super(callbacks);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  protected init(): void {
    this.state = {
      status: {
        ...createStatusBarState("ALFRED Debug"),
        connectionStatus: "connecting",
        keyHints: DEBUG_HINTS,
      },
      focusedPanel: "cognitive",
      cognitive: null,
      metrics: null,
      active: null,
      logs: this.getMockLogs(),
      lastRefresh: null,
      isRefreshing: false,
      error: null,
    };

    // Initial refresh
    void this.refresh();

    // Auto-refresh every 5 seconds
    this.refreshInterval = setInterval(() => {
      void this.refresh();
    }, 5000);
  }

  protected cleanup(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // ─── Input Handling ──────────────────────────────────────────────────────────

  protected handleKey(event: KeyEvent): boolean {
    // Exit
    if (isEscape(event) || isQuit(event)) {
      this.exit();
      return true;
    }

    // Refresh
    if (event.key === "r") {
      void this.refresh();
      return true;
    }

    // Panel navigation
    if (event.key === "tab" || event.key === "l" || event.key === "right") {
      this.nextPanel();
      return true;
    }

    if (
      (event.key === "tab" && event.shift) ||
      event.key === "h" ||
      event.key === "left"
    ) {
      this.prevPanel();
      return true;
    }

    // Direct panel access
    if (event.key === "c") {
      this.state.focusedPanel = "cognitive";
      return true;
    }

    if (event.key === "m") {
      this.state.focusedPanel = "metrics";
      return true;
    }

    if (event.key === "a") {
      this.state.focusedPanel = "active";
      return true;
    }

    if (event.key === "l") {
      this.state.focusedPanel = "logs";
      return true;
    }

    return false;
  }

  private nextPanel(): void {
    const panels: DebugPanel[] = ["cognitive", "metrics", "active", "logs"];
    const currentIndex = panels.indexOf(this.state.focusedPanel);
    this.state.focusedPanel =
      panels[(currentIndex + 1) % panels.length] ?? "cognitive";
  }

  private prevPanel(): void {
    const panels: DebugPanel[] = ["cognitive", "metrics", "active", "logs"];
    const currentIndex = panels.indexOf(this.state.focusedPanel);
    this.state.focusedPanel =
      panels[(currentIndex - 1 + panels.length) % panels.length] ?? "cognitive";
  }

  // ─── Data Refresh ────────────────────────────────────────────────────────────

  private async refresh(): Promise<void> {
    if (this.state.isRefreshing) {
      return;
    }

    this.state.isRefreshing = true;
    this.state.error = null;

    try {
      // Fetch cognitive state
      const cognitiveResult = await this.apiClient.getCognitiveState();
      if (cognitiveResult.data) {
        this.state.cognitive = {
          phase: cognitiveResult.data.phase,
          autonomy: cognitiveResult.data.autonomy?.level ?? 0.5,
          since: cognitiveResult.data.ts,
        };
      }

      // Fetch admin stats for active data
      const adminResult = await this.apiClient.getAdminStats();
      if (adminResult.data) {
        this.state.active = {
          workflows:
            (adminResult.data.workflows?.active ?? 0) +
            (adminResult.data.workflows?.pending ?? 0),
          voiceSessions: adminResult.data.voice?.activeSessions ?? 0,
          subscriptions: 0,
        };
      }

      // Generate mock metrics (would come from Prometheus in production)
      this.state.metrics = this.getMockMetrics();

      // Update connection status
      this.state.status.connectionStatus = "connected";
      this.state.lastRefresh = new Date();
    } catch (error) {
      this.state.error = (error as Error).message;
      this.state.status.connectionStatus = "disconnected";
    } finally {
      this.state.isRefreshing = false;
    }
  }

  private getMockMetrics(): MetricsData {
    const history = this.state.metrics?.latencyHistory ?? [];
    const newLatency = 30 + Math.random() * 40;
    const latencyHistory = [...history.slice(-19), newLatency];

    return {
      requestsPerMin: Math.floor(800 + Math.random() * 400),
      latencyP50: Math.floor(35 + Math.random() * 20),
      latencyP99: Math.floor(100 + Math.random() * 50),
      errorRate: Math.random() * 0.5,
      latencyHistory,
    };
  }

  private getMockLogs(): LogEntry[] {
    return [
      {
        level: "info",
        message: "Voice pool initialized",
        timestamp: new Date(),
      },
      {
        level: "debug",
        message: "Cognitive transition: idle -> capturing",
        timestamp: new Date(Date.now() - 5000),
      },
      {
        level: "info",
        message: "Workflow started: run_abc123",
        timestamp: new Date(Date.now() - 10_000),
      },
      {
        level: "warn",
        message: "Rate limit approaching (80%)",
        timestamp: new Date(Date.now() - 30_000),
      },
    ];
  }

  // ─── Rendering ───────────────────────────────────────────────────────────────

  protected render(size: TerminalSize): string[] {
    const lines: string[] = [];
    const { width, height } = size;

    // Header
    const refreshIndicator = this.state.isRefreshing
      ? fg(colors.primary)(" ⟳")
      : "";
    lines.push(boxTop(width, `ALFRED Debug${refreshIndicator}`, true));

    // Content area
    const contentHeight = height - 4; // Header, bottom border, hints
    const contentLines = this.renderContent(width - 2, contentHeight);

    for (const line of contentLines) {
      lines.push(
        `${boxSide(true)}${padRight(line, width - 2)}${boxSide(true)}`
      );
    }

    // Pad to fill height
    while (lines.length < height - 2) {
      lines.push(`${boxSide(true)}${" ".repeat(width - 2)}${boxSide(true)}`);
    }

    // Bottom border
    lines.push(boxBottom(width, true));

    // Hints
    lines.push(renderHintBar(this.state.status.keyHints, width));

    return lines;
  }

  private renderContent(width: number, _height: number): string[] {
    const lines: string[] = [];

    // Error display
    if (this.state.error) {
      lines.push(fg(colors.error)(` Error: ${this.state.error}`));
      lines.push("");
    }

    // Split into two columns
    const leftWidth = Math.floor(width / 2) - 1;
    const rightWidth = width - leftWidth - 3;

    // Top row: Cognitive | Metrics
    const cognitiveLines = this.renderCognitivePanel(leftWidth);
    const metricsLines = this.renderMetricsPanel();
    const topRowHeight = Math.max(cognitiveLines.length, metricsLines.length);

    for (let i = 0; i < topRowHeight; i++) {
      const left = cognitiveLines[i] ?? "";
      const right = metricsLines[i] ?? "";
      lines.push(
        `${padRight(left, leftWidth)} │ ${padRight(right, rightWidth)}`
      );
    }

    // Separator
    lines.push(dim(`${"─".repeat(leftWidth)}─┼─${"─".repeat(rightWidth)}`));

    // Bottom row: Active | Logs
    const activeLines = this.renderActivePanel();
    const logsLines = this.renderLogsPanel(rightWidth);
    const bottomRowHeight = Math.max(activeLines.length, logsLines.length);

    for (let i = 0; i < bottomRowHeight; i++) {
      const left = activeLines[i] ?? "";
      const right = logsLines[i] ?? "";
      lines.push(
        `${padRight(left, leftWidth)} │ ${padRight(right, rightWidth)}`
      );
    }

    return lines;
  }

  private renderCognitivePanel(_width: number): string[] {
    const lines: string[] = [];
    const focused = this.state.focusedPanel === "cognitive";
    const title = focused ? fg(colors.primary)("Cognitive") : "Cognitive";
    lines.push(bold(title));

    if (!this.state.cognitive) {
      lines.push(dim(" Loading..."));
      return lines;
    }

    const { phase, autonomy, since } = this.state.cognitive;

    // Phase
    const phaseColor = this.getPhaseColor(phase);
    lines.push(` Phase: ${fg(phaseColor)(phase)}`);

    // Autonomy
    const autonomyColor = this.getAutonomyColor(autonomy);
    const autonomyBar = progressBar(autonomy, 15, { color: autonomyColor });
    lines.push(` Autonomy: ${autonomyBar} ${(autonomy * 100).toFixed(0)}%`);

    // Since
    if (since) {
      const ago = this.formatTimeAgo(since);
      lines.push(dim(` Since: ${ago}`));
    }

    return lines;
  }

  private renderMetricsPanel(): string[] {
    const lines: string[] = [];
    const focused = this.state.focusedPanel === "metrics";
    const title = focused ? fg(colors.primary)("Metrics") : "Metrics";
    lines.push(bold(title));

    if (!this.state.metrics) {
      lines.push(dim(" Loading..."));
      return lines;
    }

    const {
      requestsPerMin,
      latencyP50,
      latencyP99,
      errorRate,
      latencyHistory,
    } = this.state.metrics;

    lines.push(` Requests: ${requestsPerMin}/min`);
    lines.push(` Latency: ${latencyP50}ms p50 / ${latencyP99}ms p99`);
    lines.push(` Errors: ${errorRate.toFixed(1)}%`);

    // Sparkline
    if (latencyHistory.length > 0) {
      const spark = sparkline(latencyHistory, colors.primary);
      lines.push(` Trend: ${spark}`);
    }

    return lines;
  }

  private renderActivePanel(): string[] {
    const lines: string[] = [];
    const focused = this.state.focusedPanel === "active";
    const title = focused ? fg(colors.primary)("Active") : "Active";
    lines.push(bold(title));

    if (!this.state.active) {
      lines.push(dim(" Loading..."));
      return lines;
    }

    const { workflows, voiceSessions, subscriptions } = this.state.active;

    lines.push(` Workflows: ${workflows}`);
    lines.push(` Voice sessions: ${voiceSessions}`);
    lines.push(` Subscriptions: ${subscriptions}`);

    return lines;
  }

  private renderLogsPanel(width: number): string[] {
    const lines: string[] = [];
    const focused = this.state.focusedPanel === "logs";
    const title = focused ? fg(colors.primary)("Logs") : "Logs";
    lines.push(bold(title));

    if (this.state.logs.length === 0) {
      lines.push(dim(" No recent logs"));
      return lines;
    }

    for (const log of this.state.logs.slice(0, 5)) {
      const levelColor = this.getLogLevelColor(log.level);
      const levelTag = fg(levelColor)(`[${log.level.toUpperCase()}]`);
      const message =
        log.message.length > width - 10
          ? `${log.message.slice(0, width - 13)}...`
          : log.message;
      lines.push(` ${levelTag} ${message}`);
    }

    return lines;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private getPhaseColor(phase: string): string {
    switch (phase) {
      case "idle":
        return colors.muted;
      case "capturing":
        return colors.primary;
      case "thinking":
        return colors.warning;
      case "deciding":
        return colors.primary;
      case "executing":
        return colors.success;
      case "reflecting":
        return colors.textMuted;
      default:
        return colors.text;
    }
  }

  private getAutonomyColor(level: number): string {
    if (level >= 0.7) {
      return colors.success;
    }
    if (level >= 0.5) {
      return colors.primary;
    }
    if (level >= 0.3) {
      return colors.warning;
    }
    return colors.error;
  }

  private getLogLevelColor(level: LogEntry["level"]): string {
    switch (level) {
      case "info":
        return colors.primary;
      case "warn":
        return colors.warning;
      case "error":
        return colors.error;
      case "debug":
        return colors.muted;
    }
  }

  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createDebugMode(callbacks: ModeCallbacks = {}): DebugMode {
  return new DebugMode(callbacks);
}

export function runDebugMode(): Promise<void> {
  const mode = createDebugMode();
  return new Promise((resolve) => {
    mode.callbacks.onExit = () => resolve();
    mode.start();
  });
}
