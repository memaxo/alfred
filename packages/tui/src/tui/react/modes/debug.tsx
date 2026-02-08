/**
 * Debug Mode - React Component
 *
 * Real-time system diagnostics - cognitive state, metrics, logs.
 * Migrated from packages/tui/src/tui/modes/debug.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";

import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";

import type { MetricsState } from "../../subscriptions/metrics";

import { getApiClient } from "../../api/client";
import { useMetricsStore } from "../hooks/stores";

export interface DebugModeProps {
  isOpen: boolean;
  onClose: () => void;
}

type DebugPanel = "cognitive" | "metrics" | "active" | "logs";

interface CognitiveData {
  phase: string;
  autonomy: number;
  since?: number;
}

interface ActiveData {
  workflows: number;
  voiceSessions: number;
  subscriptions: number;
}

interface LogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: Date;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function DebugMode({ isOpen, onClose }: DebugModeProps) {
  const { width, height } = useTerminalDimensions();
  const [focusedPanel, setFocusedPanel] = useState<DebugPanel>("cognitive");
  const [cognitive, setCognitive] = useState<CognitiveData | null>(null);
  const [metrics, setMetrics] = useState<MetricsState | null>(null);
  const [active, setActive] = useState<ActiveData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = getApiClient();
  const metricsStore = useMetricsStore();

  useEffect(() => {
    if (!metricsStore) {
      return;
    }
    const unsub = metricsStore.subscribe((state) => {
      setMetrics(state);
    });
    return unsub;
  }, [metricsStore]);

  const refresh = useCallback(async () => {
    if (isRefreshing || !isOpen) {
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      // Fetch cognitive state
      const cognitiveResult = await apiClient.getCognitiveState();
      if (cognitiveResult.data) {
        setCognitive({
          phase: cognitiveResult.data.phase,
          autonomy: cognitiveResult.data.autonomy?.level ?? 0.5,
          since: cognitiveResult.data.ts,
        });
      }

      // Fetch admin stats
      const adminResult = await apiClient.getAdminStats();
      if (adminResult.data) {
        setActive({
          workflows:
            (adminResult.data.workflows?.active ?? 0) +
            (adminResult.data.workflows?.pending ?? 0),
          voiceSessions: adminResult.data.voice?.activeSessions ?? 0,
          subscriptions: 0,
        });
      }

      // Container logs (best-effort)
      const containers = await apiClient.listContainers("running");
      const alfred = containers.data?.containers
        ?.filter((c) => !c.name.includes("alfred-agentfs"))
        .find((c) => c.name.includes("alfred"));

      if (alfred?.id) {
        const logsResult = await apiClient.getContainerLogs(alfred.id, 200);
        const entries =
          logsResult.data?.logs?.map((l) => ({
            level: l.level,
            message: l.message,
            timestamp: new Date(l.timestamp),
          })) ?? [];
        setLogs(entries.slice(-200));
      } else if (logs.length === 0) {
        setLogs([]);
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setIsRefreshing(false);
    }
  }, [apiClient, isRefreshing, isOpen, logs.length]);

  useEffect(() => {
    if (isOpen) {
      void refresh();
      const interval = setInterval(refresh, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, refresh]);

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!isOpen) {
        return;
      }

      if (event.name === "escape" || event.name === "q") {
        onClose();
        return;
      }

      if (event.name === "r") {
        void refresh();
        return;
      }

      if (event.name === "tab") {
        const panels: DebugPanel[] = ["cognitive", "metrics", "active", "logs"];
        const currentIndex = panels.indexOf(focusedPanel);
        setFocusedPanel(
          panels[(currentIndex + 1) % panels.length] ?? "cognitive"
        );
        return;
      }

      // Direct panel access
      if (event.name === "c") {
        setFocusedPanel("cognitive");
      }
      if (event.name === "m") {
        setFocusedPanel("metrics");
      }
      if (event.name === "a") {
        setFocusedPanel("active");
      }
      if (event.name === "l") {
        setFocusedPanel("logs");
      }
    },
    [isOpen, onClose, refresh, focusedPanel]
  );

  useKeyboard(handleKeyboard);

  if (!isOpen) {
    return null;
  }

  const leftWidth = Math.floor(width / 2) - 1;
  const rightWidth = width - leftWidth - 3;

  const metricsSummary = metrics
    ? (() => {
        const totalRequests = metrics.system.requestsPerMinute;
        const errorRate =
          totalRequests > 0
            ? (metrics.system.errorsPerMinute / totalRequests) * 100
            : 0;
        const routerCount = Math.max(1, metrics.routers.length);
        const sum = metrics.routers.reduce(
          (acc, router) => {
            acc.p50 += router.latency.p50;
            acc.p99 += router.latency.p99;
            return acc;
          },
          { p50: 0, p99: 0 }
        );
        return {
          errorRate,
          latencyP50: Math.round(sum.p50 / routerCount),
          latencyP99: Math.round(sum.p99 / routerCount),
          requestsPerMin: totalRequests,
        };
      })()
    : null;

  return (
    <box
      height={height}
      left={0}
      style={{ backgroundColor: "#0A0E14" }}
      top={0}
      width={width}
    >
      <box
        border
        height={height - 1}
        style={{ borderStyle: "single", borderColor: "#39BAE6" }}
        title={`ALFRED Debug${isRefreshing ? " ⟳" : ""}`}
        width={width}
      >
        <scrollbox focused={true}>
          {error && (
            <text content={` Error: ${error}`} style={{ fg: "#E06C75" }} />
          )}

          <box style={{ flexDirection: "row" }}>
            {/* Left Column */}
            <box width={leftWidth}>
              {/* Cognitive Panel */}
              <text
                content=" Cognitive"
                style={{
                  fg: focusedPanel === "cognitive" ? "#39BAE6" : "#E6E6E6",
                  attributes: 1, // BOLD
                }}
              />
              {cognitive ? (
                <>
                  <text
                    content={`  Phase: ${cognitive.phase}`}
                    style={{ fg: "#39BAE6" }}
                  />
                  <text
                    content={`  Autonomy: ${(cognitive.autonomy * 100).toFixed(0)}%`}
                    style={{ fg: "#98C379" }}
                  />
                </>
              ) : (
                <text content="  Loading..." style={{ fg: "#8A9199" }} />
              )}
              <text content="" />

              {/* Active Panel */}
              <text
                content=" Active"
                style={{
                  fg: focusedPanel === "active" ? "#39BAE6" : "#E6E6E6",
                  attributes: 1, // BOLD
                }}
              />
              {active ? (
                <>
                  <text
                    content={`  Workflows: ${active.workflows}`}
                    style={{ fg: "#E6E6E6" }}
                  />
                  <text
                    content={`  Voice sessions: ${active.voiceSessions}`}
                    style={{ fg: "#E6E6E6" }}
                  />
                </>
              ) : (
                <text content="  Loading..." style={{ fg: "#8A9199" }} />
              )}
            </box>

            {/* Right Column */}
            <box width={rightWidth}>
              {/* Metrics Panel */}
              <text
                content=" Metrics"
                style={{
                  fg: focusedPanel === "metrics" ? "#39BAE6" : "#E6E6E6",
                  attributes: 1, // BOLD
                }}
              />
              {metricsSummary ? (
                <>
                  <text
                    content={`  Requests: ${metricsSummary.requestsPerMin}/min`}
                    style={{ fg: "#E6E6E6" }}
                  />
                  <text
                    content={`  Latency: ${metricsSummary.latencyP50}ms p50`}
                    style={{ fg: "#E6E6E6" }}
                  />
                  <text
                    content={`  Errors: ${metricsSummary.errorRate.toFixed(1)}%`}
                    style={{ fg: "#E06C75" }}
                  />
                </>
              ) : (
                <text content="  Loading..." style={{ fg: "#8A9199" }} />
              )}
              <text content="" />

              {/* Logs Panel */}
              <text
                content=" Logs"
                style={{
                  fg: focusedPanel === "logs" ? "#39BAE6" : "#E6E6E6",
                  attributes: 1, // BOLD
                }}
              />
              {logs.length === 0 ? (
                <text content="  No recent logs" style={{ fg: "#8A9199" }} />
              ) : (
                logs
                  .slice(-Math.max(3, Math.min(20, height - 18)))
                  .map((log, i) => (
                    <text
                      content={`  [${log.level.toUpperCase()}] ${truncate(log.message, Math.max(10, rightWidth - 8))}`}
                      key={i}
                      style={{
                        fg:
                          log.level === "error"
                            ? "#E06C75"
                            : log.level === "warn"
                              ? "#E5C07B"
                              : "#8A9199",
                      }}
                    />
                  ))
              )}
            </box>
          </box>
        </scrollbox>
      </box>

      {/* Footer */}
      <box
        height={1}
        style={{ backgroundColor: "#39BAE6" }}
        top={height - 1}
        width={width}
      >
        <text
          content=" [Tab] Navigate | [r] Refresh | [Esc] Back"
          style={{ fg: "#0A0E14" }}
        />
      </box>
    </box>
  );
}
