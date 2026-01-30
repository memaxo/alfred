/**
 * Learning Dashboard - ALFRED's learning progress and self-improvement
 *
 * Visualize mistake ledger, self-corrections, and continuous improvement metrics.
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 8.2
 */

import { AlertCircle, BarChart3, Brain, Target } from "lucide-react";
import { useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { cn } from "@/lib/utils";

import { AccuracyChart } from "./accuracy-chart";
import { ImprovementInsights } from "./improvement-insights";
import { MistakeLedger } from "./mistake-ledger";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface LearningEntry {
  id: string;
  timestamp: Date;
  category: "reasoning" | "coding" | "planning" | "communication";
  error: string;
  correction: string;
  severity: "low" | "medium" | "high";
  resolved: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function LearningApp({ window: _window }: WindowComponentProps) {
  const [tab, setTab] = useState<"ledger" | "accuracy" | "insights">("ledger");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month">("week");

  return (
    <div className="flex h-full flex-col bg-void">
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Learning Dashboard</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Range */}
          <div className="flex rounded-lg border border-white/10">
            {(["day", "week", "month"] as const).map((range) => (
              <button
                className={cn(
                  "px-2 py-1 text-xs transition-colors",
                  timeRange === range
                    ? "bg-biolum/20 text-biolum"
                    : "text-biolum-dim hover:text-biolum"
                )}
                key={range}
                onClick={() => setTimeRange(range)}
                type="button"
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-white/5 border-b">
        {[
          { id: "ledger", icon: AlertCircle, label: "Mistake Ledger" },
          { id: "accuracy", icon: BarChart3, label: "Accuracy" },
          { id: "insights", icon: Target, label: "Insights" },
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
        {tab === "ledger" && <MistakeLedger timeRange={timeRange} />}
        {tab === "accuracy" && <AccuracyChart timeRange={timeRange} />}
        {tab === "insights" && <ImprovementInsights />}
      </div>
    </div>
  );
}

export function LearningAppWindow(props: WindowComponentProps) {
  return <LearningApp {...props} />;
}
