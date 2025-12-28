/**
 * ALFRED TUI Metrics Panel
 *
 * Main performance metrics visualization panel.
 */

import type { KeyEvent } from "../../input/keys";
import type { MetricsState } from "../../subscriptions/metrics";
import {
  createMetricsStore,
  type MetricsStore,
} from "../../subscriptions/metrics";
import { colors } from "../../theme";
import { bold, dim } from "../../typography";
import { BasePanel } from "../base";
import { renderRouterLatencyTable } from "./latency";
import { labeledSparkline, renderSparklineWithStats } from "./sparklines";
import {
  renderConnections,
  renderErrorRate,
  renderRequestRate,
  renderResourceUsage,
  renderThroughputSummary,
} from "./throughput";

// ─── Metrics Panel ───────────────────────────────────────────────────────────

export class MetricsPanel extends BasePanel {
  readonly id = "metrics";
  readonly label = "Metrics";

  private readonly store: MetricsStore;
  private state: MetricsState | null = null;
  private viewMode: "overview" | "latency" | "throughput" = "overview";

  constructor(store?: MetricsStore) {
    super();
    this.store = store ?? createMetricsStore();
  }

  init(): void {
    const unsub = this.store.subscribe((state) => {
      this.state = state;
    });
    this.addSubscription(unsub);
  }

  handleKey(event: KeyEvent): boolean {
    // View mode switching
    if (event.key === "o") {
      this.viewMode = "overview";
      return true;
    }
    if (event.key === "l") {
      this.viewMode = "latency";
      return true;
    }
    if (event.key === "t") {
      this.viewMode = "throughput";
      return true;
    }

    return false;
  }

  renderContent(): string[] {
    const width = this.contentBounds.width;
    const height = this.contentBounds.height;

    if (!this.state) {
      return [dim("  Loading metrics...")];
    }

    switch (this.viewMode) {
      case "latency":
        return this.renderLatencyView(width, height);
      case "throughput":
        return this.renderThroughputView(width, height);
      default:
        return this.renderOverview(width, height);
    }
  }

  private renderOverview(width: number, height: number): string[] {
    if (!this.state) {
      return [];
    }
    const lines: string[] = [];
    const { system, latencyHistory, requestHistory } = this.state;

    // Request rate with sparkline
    const requestLines = renderRequestRate(
      system.requestsPerMinute,
      requestHistory,
      width
    );
    for (const line of requestLines) {
      lines.push(line);
    }
    lines.push("");

    // Error rate
    const errorLines = renderErrorRate(
      system.errorsPerMinute,
      system.requestsPerMinute,
      latencyHistory // Using latency history as proxy for error history
    );
    for (const line of errorLines) {
      lines.push(line);
    }
    lines.push("");

    // Latency sparkline
    const latencyLine = labeledSparkline("Latency (ms)", latencyHistory, {
      width: Math.min(width - 20, 20),
      color: colors.warning,
    });
    lines.push(latencyLine);
    lines.push("");

    // Resource usage (if space permits)
    const remainingHeight = height - lines.length;
    if (remainingHeight > 3) {
      const resourceLines = renderResourceUsage(
        system.memoryUsageMb,
        system.cpuPercent
      );
      for (const line of resourceLines) {
        lines.push(line);
      }

      lines.push(renderConnections(system.activeConnections));
    }

    // View mode hint
    lines.push("");
    lines.push(dim("[o]verview [l]atency [t]hroughput"));

    return lines;
  }

  private renderLatencyView(width: number, height: number): string[] {
    if (!this.state) {
      return [];
    }
    const lines: string[] = [];
    const { routers, latencyHistory } = this.state;

    lines.push(bold(dim("Latency Breakdown")));
    lines.push("");

    // Latency sparkline
    const sparkLines = renderSparklineWithStats(
      "Overall",
      latencyHistory,
      width,
      { color: colors.warning, showMinMax: true }
    );
    for (const line of sparkLines) {
      lines.push(line);
    }
    lines.push("");

    // Router latency table
    const tableHeight = Math.max(3, height - lines.length - 3);
    const tableLines = renderRouterLatencyTable(routers, width, tableHeight);
    for (const line of tableLines) {
      lines.push(line);
    }

    lines.push("");
    lines.push(dim("[o]verview [l]atency [t]hroughput"));

    return lines;
  }

  private renderThroughputView(width: number, _height: number): string[] {
    if (!this.state) {
      return [];
    }
    const lines: string[] = [];
    const { system, requestHistory } = this.state;

    lines.push(bold(dim("Throughput")));
    lines.push("");

    // Request rate with sparkline
    const requestLines = renderRequestRate(
      system.requestsPerMinute,
      requestHistory,
      width
    );
    for (const line of requestLines) {
      lines.push(line);
    }
    lines.push("");

    // Throughput summary
    const summary = {
      requests: system.requestsPerMinute * 5, // 5 min total
      errors: system.errorsPerMinute * 5,
      successRate:
        system.requestsPerMinute > 0
          ? ((system.requestsPerMinute - system.errorsPerMinute) /
              system.requestsPerMinute) *
            100
          : 100,
      avgLatencyMs:
        this.state?.latencyHistory.length > 0
          ? this.state?.latencyHistory.reduce((a, b) => a + b, 0) /
            this.state?.latencyHistory.length
          : 0,
    };
    const summaryLines = renderThroughputSummary(summary, width);
    for (const line of summaryLines) {
      lines.push(line);
    }
    lines.push("");

    // Connections and resources
    lines.push(renderConnections(system.activeConnections));
    const resourceLines = renderResourceUsage(
      system.memoryUsageMb,
      system.cpuPercent
    );
    for (const line of resourceLines) {
      lines.push(line);
    }

    lines.push("");
    lines.push(dim("[o]verview [l]atency [t]hroughput"));

    return lines;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createMetricsPanel(store?: MetricsStore): MetricsPanel {
  return new MetricsPanel(store);
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export * from "./latency";
export * from "./sparklines";
export * from "./throughput";
