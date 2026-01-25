"use client";

/**
 * Agent Waves Application - Phase 2 Core Application
 *
 * Visualize orchestrator runs with wave-based agent execution.
 *
 * Features:
 * - Wave timeline showing execution phases
 * - Agent cards with progress indicators
 * - Spawn tree visualization
 * - Execution log panel
 * - Dependency graph
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.3
 */

import { Bot, Loader2, PanelRight, Pause, Play, Square } from "lucide-react";
import { useCallback, useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import { AgentCard } from "./agent-card";
import { ExecutionLog } from "./execution-log";
import { PlanPreview } from "./plan-preview";
import { WaveTimeline } from "./wave-timeline";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface AgentsAppProps {
  windowId?: string;
  className?: string;
  runId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function AgentsApp({
  windowId: _windowId,
  className,
  runId,
}: AgentsAppProps) {
  const [showLogs, setShowLogs] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  // Fetch run data if runId provided, otherwise fetch list of recent runs
  const { data: runData, isLoading: isLoadingRun } =
    trpc.orchestrator.runsGet.useQuery(
      { runId: runId ?? "" },
      { enabled: Boolean(runId) }
    );

  const { data: runsListData, isLoading: isLoadingList } =
    trpc.orchestrator.runsList.useQuery(
      { status: "running", limit: 1 },
      { enabled: !runId }
    );

  // Use the first running run if no runId provided
  const activeRun = runData ?? runsListData?.runs?.[0];
  const currentRunId = runId ?? activeRun?.id;

  // Mutations
  const pauseMutation = trpc.orchestrator.runsPause.useMutation({
    onSuccess: () => {
      void utils.orchestrator.runsGet.invalidate();
      void utils.orchestrator.runsList.invalidate();
    },
  });

  const resumeMutation = trpc.orchestrator.runsResume.useMutation({
    onSuccess: () => {
      void utils.orchestrator.runsGet.invalidate();
      void utils.orchestrator.runsList.invalidate();
    },
  });

  const cancelMutation = trpc.orchestrator.runsCancel.useMutation({
    onSuccess: () => {
      void utils.orchestrator.runsGet.invalidate();
      void utils.orchestrator.runsList.invalidate();
    },
  });

  const isPaused = activeRun?.status === "suspended";
  const isLoading = isLoadingRun || isLoadingList;

  const handlePause = useCallback(() => {
    if (currentRunId) {
      pauseMutation.mutate({ runId: currentRunId });
    }
  }, [currentRunId, pauseMutation]);

  const handleResume = useCallback(() => {
    if (currentRunId) {
      resumeMutation.mutate({ runId: currentRunId });
    }
  }, [currentRunId, resumeMutation]);

  const handleCancel = useCallback(() => {
    if (currentRunId) {
      cancelMutation.mutate({ runId: currentRunId });
    }
  }, [currentRunId, cancelMutation]);

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-void-surface",
          className
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin text-biolum-dim" />
      </div>
    );
  }

  const waves = activeRun?.waves ?? [];
  const agents = activeRun?.agents ?? [];

  return (
    <div
      className={cn("flex h-full w-full flex-col bg-void-surface", className)}
      data-app="agents"
    >
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">
            {currentRunId ? `Run: ${currentRunId.slice(0, 8)}` : "Agent Waves"}
          </span>
          {activeRun?.status && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs",
                activeRun.status === "running" &&
                  "bg-blue-500/20 text-blue-400",
                activeRun.status === "suspended" &&
                  "bg-yellow-500/20 text-yellow-400",
                activeRun.status === "completed" &&
                  "bg-green-500/20 text-green-400",
                activeRun.status === "failed" && "bg-red-500/20 text-red-400",
                activeRun.status === "cancelled" &&
                  "bg-gray-500/20 text-gray-400"
              )}
            >
              {activeRun.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isPaused ? (
            <Button
              className="h-7 gap-1 text-xs"
              disabled={resumeMutation.isPending || !currentRunId}
              onClick={handleResume}
              size="sm"
              variant="ghost"
            >
              <Play className="h-3 w-3" />
              Resume
            </Button>
          ) : (
            <Button
              className="h-7 gap-1 text-xs"
              disabled={
                pauseMutation.isPending ||
                !currentRunId ||
                activeRun?.status !== "running"
              }
              onClick={handlePause}
              size="sm"
              variant="ghost"
            >
              <Pause className="h-3 w-3" />
              Pause
            </Button>
          )}
          <Button
            className="h-7 gap-1 text-red-400 text-xs"
            disabled={
              cancelMutation.isPending ||
              !currentRunId ||
              activeRun?.status === "completed" ||
              activeRun?.status === "cancelled"
            }
            onClick={handleCancel}
            size="sm"
            variant="ghost"
          >
            <Square className="h-3 w-3" />
            Cancel
          </Button>
          <div className="mx-2 h-4 w-px bg-white/10" />
          <Button
            className="h-7 w-7"
            onClick={() => setShowLogs(!showLogs)}
            size="icon"
            variant="ghost"
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Wave Timeline + Agents */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Wave Timeline */}
          <WaveTimeline className="flex-shrink-0" waves={waves} />

          {/* Agent Cards */}
          <div className="flex-1 overflow-auto p-4">
            {agents.length === 0 ? (
              <div className="flex h-full items-center justify-center text-biolum-dim">
                {currentRunId
                  ? "No agents spawned yet"
                  : "No active runs. Start a workflow to see agents."}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                  <AgentCard
                    agent={agent}
                    isSelected={agent.id === selectedAgentId}
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Plan Preview */}
          <PlanPreview className="flex-shrink-0 border-white/5 border-t" />
        </div>

        {/* Execution Logs */}
        {showLogs && currentRunId && (
          <ExecutionLog
            agentId={selectedAgentId}
            className="w-80 flex-shrink-0 border-white/5 border-l"
            onClose={() => setShowLogs(false)}
            runId={currentRunId}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function AgentsAppWindow(props: WindowComponentProps) {
  return <AgentsApp className="h-full" windowId={props.window.id} />;
}

export default AgentsApp;
