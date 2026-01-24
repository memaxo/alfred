/**
 * Metrics Panel - React Component
 *
 * Migrated from packages/tui/src/tui/panels/metrics/index.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";

import type { MetricsState } from "../../subscriptions/metrics";

import { colors, progressChars, sparklineChars } from "../../theme";
import { bold, dim, fg } from "../../typography";
import { useMetricsStore } from "../hooks/stores";

function clamp0(n: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function bar(value: number, width: number): string {
  const w = Math.max(4, Math.min(30, width));
  const v = Math.max(0, Math.min(1, value));
  const filled = Math.round(v * w);
  return (
    progressChars.filled.repeat(filled) +
    progressChars.empty.repeat(Math.max(0, w - filled))
  );
}

function sparkline(values: number[], width: number): string {
  if (values.length === 0) {
    return dim("(no data)");
  }
  const slice = values.length > width ? values.slice(-width) : values;
  const min = Math.min(...slice);
  const max = Math.max(...slice);
  const range = max - min;
  return slice
    .map((v) => {
      const t = range === 0 ? 0 : (v - min) / range;
      const idx = Math.min(
        sparklineChars.length - 1,
        Math.floor(t * (sparklineChars.length - 1))
      );
      return sparklineChars[idx] ?? sparklineChars[0];
    })
    .join("");
}

type MetricsPanelProps = {
  width: number;
  height: number;
  focused: boolean;
  x?: number;
  y?: number;
};

export function MetricsPanel({
  width,
  height,
  focused,
  x,
  y,
}: MetricsPanelProps) {
  const store = useMetricsStore();
  const [state, setState] = useState<MetricsState | null>(null);
  const [viewMode, setViewMode] = useState<
    "overview" | "latency" | "throughput"
  >("overview");

  const borderColor = focused ? "cyan" : undefined;

  useEffect(() => {
    if (!store) {
      return;
    }

    const unsub = store.subscribe((newState) => {
      setState(newState);
    });

    return unsub;
  }, [store]);

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!focused) {
        return;
      }

      if (event.name === "o") {
        setViewMode("overview");
        return;
      }
      if (event.name === "l") {
        setViewMode("latency");
        return;
      }
      if (event.name === "t") {
        setViewMode("throughput");
        return;
      }
    },
    [focused]
  );

  useKeyboard(handleKeyboard);

  if (!state) {
    return (
      <box
        border
        borderColor={borderColor}
        height={height}
        title="Metrics"
        width={width}
      >
        <text>{dim("  Loading metrics...")}</text>
      </box>
    );
  }

  const renderOverview = () => {
    const { system, latencyHistory, requestHistory } = state;
    const lines: string[] = [];

    const sparkW = Math.max(10, Math.min(24, width - 22));

    lines.push(
      `${bold("Requests/min")}  ${fg(colors.primary)(
        system.requestsPerMinute.toString()
      )}  ${fg(colors.primary)(sparkline(requestHistory, sparkW))}`
    );
    lines.push("");

    const errRate =
      system.requestsPerMinute > 0
        ? (system.errorsPerMinute / system.requestsPerMinute) * 100
        : 0;
    lines.push(
      `${bold("Errors/min")}    ${fg(colors.error)(
        system.errorsPerMinute.toString()
      )}  ${dim(`(${errRate.toFixed(1)}%)`)}`
    );
    lines.push("");

    const avgLatency =
      latencyHistory.length > 0
        ? latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length
        : 0;
    lines.push(
      `${bold("Latency (ms)")}  ${fg(colors.warning)(
        Math.round(avgLatency).toString()
      )}  ${fg(colors.warning)(sparkline(latencyHistory, sparkW))}`
    );
    lines.push("");

    lines.push(
      `${bold("CPU")}         ${fg(colors.success)(
        `${Math.round(clamp0(system.cpuPercent))}%`
      )}  ${fg(colors.success)(bar(clamp0(system.cpuPercent) / 100, sparkW))}`
    );
    lines.push(
      `${bold("Memory")}      ${fg(colors.success)(
        `${Math.round(clamp0(system.memoryUsageMb))} MB`
      )}  ${dim(`conns ${system.activeConnections}`)}`
    );

    // View mode hint
    lines.push("");
    lines.push(dim("[o]verview [l]atency [t]hroughput"));

    return lines;
  };

  const renderLatencyView = () => {
    const { routers, latencyHistory } = state;
    const lines: string[] = [];

    lines.push(bold(dim("Latency Breakdown")));
    lines.push("");

    const sparkW = Math.max(10, Math.min(30, width - 14));
    const avgLatency =
      latencyHistory.length > 0
        ? latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length
        : 0;
    lines.push(
      `  ${fg(colors.warning)(sparkline(latencyHistory, sparkW))} ${dim(
        `avg ${Math.round(avgLatency)}ms`
      )}`
    );
    lines.push("");

    lines.push(bold(dim("Router          p50   avg   p99   req  err")));
    const maxRows = Math.max(3, height - lines.length - 4);
    const rows = routers
      .slice()
      .sort((a, b) => b.requests - a.requests)
      .slice(0, maxRows);
    for (const r of rows) {
      const name = r.name.padEnd(14).slice(0, 14);
      const p50 = String(Math.round(r.latency.p50)).padStart(4);
      const avg = String(Math.round(r.latency.avg)).padStart(4);
      const p99 = String(Math.round(r.latency.p99)).padStart(4);
      const req = String(r.requests).padStart(4);
      const err = String(r.errors).padStart(3);
      lines.push(`  ${name}  ${p50}  ${avg}  ${p99}  ${req}  ${err}`);
    }

    lines.push("");
    lines.push(dim("[o]verview [l]atency [t]hroughput"));

    return lines;
  };

  const renderThroughputView = () => {
    const { system, requestHistory, latencyHistory } = state;
    const lines: string[] = [];

    lines.push(bold(dim("Throughput")));
    lines.push("");

    const sparkW = Math.max(10, Math.min(24, width - 22));
    lines.push(
      `${bold("Requests/min")}  ${fg(colors.primary)(
        system.requestsPerMinute.toString()
      )}  ${fg(colors.primary)(sparkline(requestHistory, sparkW))}`
    );
    lines.push("");

    // Throughput summary
    const summary = {
      requests: system.requestsPerMinute * 5,
      errors: system.errorsPerMinute * 5,
      successRate:
        system.requestsPerMinute > 0
          ? ((system.requestsPerMinute - system.errorsPerMinute) /
              system.requestsPerMinute) *
            100
          : 100,
      avgLatencyMs:
        latencyHistory.length > 0
          ? latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length
          : 0,
    };
    lines.push(
      `  success ${fg(colors.success)(`${summary.successRate.toFixed(1)}%`)}  ` +
        dim(`avg ${Math.round(summary.avgLatencyMs)}ms`)
    );
    lines.push(
      `  window ${dim("~5m")}: req ${summary.requests} err ${fg(colors.error)(
        summary.errors.toString()
      )}`
    );
    lines.push("");

    lines.push(dim(`connections ${system.activeConnections}`));
    lines.push(
      `cpu ${fg(colors.success)(
        `${Math.round(clamp0(system.cpuPercent))}%`
      )}  ${fg(colors.success)(bar(clamp0(system.cpuPercent) / 100, sparkW))}`
    );
    lines.push(dim(`mem ${Math.round(clamp0(system.memoryUsageMb))} MB`));

    lines.push("");
    lines.push(dim("[o]verview [l]atency [t]hroughput"));

    return lines;
  };

  const content =
    viewMode === "latency"
      ? renderLatencyView()
      : viewMode === "throughput"
        ? renderThroughputView()
        : renderOverview();

  return (
    <box
      border
      height={height}
      left={x}
      style={{
        borderColor: borderColor ?? "#FFFFFF",
        borderStyle: "single",
      }}
      title="Metrics"
      top={y}
      width={width}
    >
      <scrollbox focused={focused}>
        {content.map((line, i) => (
          <text content={line} key={i} />
        ))}
      </scrollbox>
    </box>
  );
}
