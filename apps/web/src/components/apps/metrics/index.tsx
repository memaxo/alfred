/**
 * Metrics Dashboard - Prometheus metrics visualization
 *
 * Query editor, alert configuration, and custom dashboards.
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 8.6
 */

import { BarChart3, Bell, Code, LayoutDashboard, Search } from "lucide-react";
import { useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { cn } from "@/lib/utils";

import { AlertConfig } from "./alert-config";
import { DashboardBuilder } from "./dashboard-builder";
import { MetricExplorer } from "./metric-explorer";
import { QueryEditor } from "./query-editor";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Metric {
  name: string;
  help: string;
  type: "counter" | "gauge" | "histogram" | "summary";
  values: {
    value: number;
    labels: Record<string, string>;
  }[];
  aggregator: string;
}

export interface MetricQuery {
  id: string;
  query: string;
  name: string;
  interval: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function MetricsApp({ window: _window }: WindowComponentProps) {
  const [tab, setTab] = useState<"explorer" | "query" | "alerts" | "dashboard">(
    "dashboard"
  );

  return (
    <div className="flex h-full flex-col bg-void">
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-biolum" />
          <span className="font-medium text-biolum text-sm">
            Metrics Dashboard
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-white/5 border-b bg-void-surface/30">
        {[
          { id: "dashboard", icon: LayoutDashboard, label: "Overview" },
          { id: "explorer", icon: Search, label: "Explorer" },
          { id: "query", icon: Code, label: "Query" },
          { id: "alerts", icon: Bell, label: "Alerts" },
        ].map((t) => (
          <button
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm transition-colors",
              tab === t.id
                ? "border-biolum border-b-2 text-biolum"
                : "text-biolum-dim hover:text-biolum"
            )}
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            type="button"
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === "explorer" && <MetricExplorer />}
        {tab === "query" && <QueryEditor />}
        {tab === "alerts" && <AlertConfig />}
        {tab === "dashboard" && <DashboardBuilder />}
      </div>
    </div>
  );
}

export function MetricsAppWindow(props: WindowComponentProps) {
  return <MetricsApp {...props} />;
}
