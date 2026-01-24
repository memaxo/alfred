"use client";

/**
 * Task Manager Application - Phase 3 System Application
 *
 * Monitor system processes, agent runs, and performance metrics.
 *
 * Features:
 * - Process list showing running agents
 * - Performance charts (CPU/memory)
 * - Network monitoring
 * - History of past runs
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.6
 */

import { Activity, Bot, Cpu, History, Network, RefreshCw } from "lucide-react";
import { useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { HistoryTab } from "./history-tab";
import { NetworkTab } from "./network-tab";
import { PerformanceChart } from "./performance-chart";
import { ProcessList } from "./process-list";
import { RunList } from "./run-list";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type TaskManagerAppProps = {
  windowId?: string;
  className?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function TaskManagerApp({
  windowId: _windowId,
  className,
}: TaskManagerAppProps) {
  const [tab, setTab] = useState<
    "runs" | "processes" | "performance" | "network" | "history"
  >("runs");

  return (
    <div
      className={cn("flex h-full w-full flex-col bg-void-surface", className)}
      data-app="taskmanager"
    >
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Task Manager</span>
        </div>

        <Button className="h-7 w-7" size="icon" variant="ghost">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="no-scrollbar flex overflow-x-auto border-white/5 border-b">
        <TabButton
          active={tab === "runs"}
          icon={<Bot className="h-4 w-4" />}
          label="Agent Runs"
          onClick={() => setTab("runs")}
        />
        <TabButton
          active={tab === "processes"}
          icon={<Cpu className="h-4 w-4" />}
          label="Processes"
          onClick={() => setTab("processes")}
        />
        <TabButton
          active={tab === "performance"}
          icon={<Activity className="h-4 w-4" />}
          label="Performance"
          onClick={() => setTab("performance")}
        />
        <TabButton
          active={tab === "network"}
          icon={<Network className="h-4 w-4" />}
          label="Network"
          onClick={() => setTab("network")}
        />
        <TabButton
          active={tab === "history"}
          icon={<History className="h-4 w-4" />}
          label="History"
          onClick={() => setTab("history")}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {tab === "runs" && <RunList />}
        {tab === "processes" && <ProcessList className="h-full" />}
        {tab === "performance" && <PerformanceChart className="h-full" />}
        {tab === "network" && <NetworkTab className="h-full" />}
        {tab === "history" && <HistoryTab className="h-full" />}
      </div>
    </div>
  );
}

function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition-colors",
        active
          ? "border-biolum text-biolum"
          : "border-transparent text-biolum-dim hover:text-biolum"
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function TaskManagerAppWindow(props: WindowComponentProps) {
  return <TaskManagerApp className="h-full" windowId={props.window.id} />;
}

export default TaskManagerApp;
