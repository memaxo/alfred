"use client";

/**
 * Policy Viewer - Autonomy constraints and permission management
 *
 * View and manage ALFRED's policy decisions, autonomy constraints,
 * permission history, and approval workflows.
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 8.3
 */

import { CheckSquare, FileText, Shield, Sliders } from "lucide-react";
import { useState } from "react";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { cn } from "@/lib/utils";
import { ApprovalQueue } from "./approval-queue";
import { AutonomyControls } from "./autonomy-controls";
import { ConstraintList } from "./constraint-list";
import { DecisionLog } from "./decision-log";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type PolicyDecision = {
  id: string;
  timestamp: Date;
  action: string;
  scope: string;
  decision: "allowed" | "denied" | "escalated";
  reason: string;
  autonomyLevel: number;
};

export type AutonomyScope = {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function PolicyApp({ window: _window }: WindowComponentProps) {
  const [tab, setTab] = useState<
    "decisions" | "constraints" | "autonomy" | "approvals"
  >("decisions");

  return (
    <div className="flex h-full flex-col bg-void">
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Policy Viewer</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-white/5 border-b">
        {[
          { id: "decisions", icon: FileText, label: "Decision Log" },
          { id: "constraints", icon: Shield, label: "Constraints" },
          { id: "autonomy", icon: Sliders, label: "Autonomy" },
          { id: "approvals", icon: CheckSquare, label: "Approvals" },
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
        {tab === "decisions" && <DecisionLog />}
        {tab === "constraints" && <ConstraintList />}
        {tab === "autonomy" && <AutonomyControls />}
        {tab === "approvals" && <ApprovalQueue />}
      </div>
    </div>
  );
}

export function PolicyAppWindow(props: WindowComponentProps) {
  return <PolicyApp {...props} />;
}
