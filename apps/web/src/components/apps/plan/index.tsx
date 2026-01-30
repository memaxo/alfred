/**
 * Plan Editor - Visual plan editor for ExecPlans
 *
 * Debug intents, research patterns, and create execution plans.
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 8.5
 */

import { BookOpen, Bug, LayoutGrid } from "lucide-react";
import { useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { cn } from "@/lib/utils";

import { IntentDebugger } from "./intent-debugger";
import { PatternLibrary } from "./pattern-library";
import { PlanCanvas } from "./plan-canvas";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanStep {
  id: string;
  name: string;
  type: "task" | "subtask" | "checkpoint" | "decision";
  status: "pending" | "running" | "completed" | "failed";
  dependencies: string[];
  estimate?: string;
}

export interface ExecPlan {
  id: string;
  name: string;
  purpose: string;
  steps: PlanStep[];
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function PlanApp({ window: _window }: WindowComponentProps) {
  const [tab, setTab] = useState<"canvas" | "debug" | "patterns">("canvas");
  const [selectedPlanId] = useState<string | null>("1");

  return (
    <div className="flex h-full flex-col bg-void">
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Plan Editor</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-white/5 border-b">
        {[
          { id: "canvas", icon: LayoutGrid, label: "Plan Canvas" },
          { id: "debug", icon: Bug, label: "Intent Debugger" },
          { id: "patterns", icon: BookOpen, label: "Patterns" },
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
        {tab === "canvas" && <PlanCanvas planId={selectedPlanId} />}
        {tab === "debug" && <IntentDebugger />}
        {tab === "patterns" && <PatternLibrary />}
      </div>
    </div>
  );
}

export function PlanAppWindow(props: WindowComponentProps) {
  return <PlanApp {...props} />;
}
