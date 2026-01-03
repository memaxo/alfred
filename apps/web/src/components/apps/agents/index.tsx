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

import { Bot, PanelRight, Pause, Play, Square } from "lucide-react";
import { useCallback, useState } from "react";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgentCard } from "./agent-card";
import { ExecutionLog } from "./execution-log";
import { PlanPreview } from "./plan-preview";
import { WaveTimeline } from "./wave-timeline";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AgentsAppProps = {
  windowId?: string;
  className?: string;
  runId?: string;
};

type AgentStatus = "pending" | "spawning" | "running" | "completed" | "failed";

type Agent = {
  id: string;
  name: string;
  type: "codex" | "droid" | "claude" | "roo";
  status: AgentStatus;
  progress: number;
  wave: number;
  parentId?: string;
  output?: string;
};

type Wave = {
  id: number;
  status: "pending" | "running" | "completed";
  agents: string[];
  startTime?: Date;
  endTime?: Date;
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const mockWaves: Wave[] = [
  {
    id: 1,
    status: "completed",
    agents: ["1"],
    startTime: new Date(Date.now() - 60_000),
    endTime: new Date(Date.now() - 30_000),
  },
  {
    id: 2,
    status: "running",
    agents: ["2", "3"],
    startTime: new Date(Date.now() - 30_000),
  },
  { id: 3, status: "pending", agents: ["4", "5", "6"] },
];

const mockAgents: Agent[] = [
  {
    id: "1",
    name: "Planner",
    type: "claude",
    status: "completed",
    progress: 100,
    wave: 1,
  },
  {
    id: "2",
    name: "Frontend",
    type: "codex",
    status: "running",
    progress: 65,
    wave: 2,
    parentId: "1",
  },
  {
    id: "3",
    name: "Backend",
    type: "droid",
    status: "running",
    progress: 45,
    wave: 2,
    parentId: "1",
  },
  {
    id: "4",
    name: "Tests",
    type: "roo",
    status: "pending",
    progress: 0,
    wave: 3,
    parentId: "2",
  },
  {
    id: "5",
    name: "Docs",
    type: "claude",
    status: "pending",
    progress: 0,
    wave: 3,
    parentId: "2",
  },
  {
    id: "6",
    name: "Review",
    type: "claude",
    status: "pending",
    progress: 0,
    wave: 3,
    parentId: "3",
  },
];

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
  const [isPaused, setIsPaused] = useState(false);

  const handlePause = useCallback(() => {
    setIsPaused(true);
    // TODO: Call orchestrator.pause(runId)
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    // TODO: Call orchestrator.resume(runId)
  }, []);

  const handleCancel = useCallback(() => {
    // TODO: Call orchestrator.cancel(runId)
  }, []);

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
            {runId ? `Run: ${runId.slice(0, 8)}` : "Agent Waves"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {isPaused ? (
            <Button
              className="h-7 gap-1 text-xs"
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
          <WaveTimeline className="flex-shrink-0" waves={mockWaves} />

          {/* Agent Cards */}
          <div className="flex-1 overflow-auto p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mockAgents.map((agent) => (
                <AgentCard
                  agent={agent}
                  isSelected={agent.id === selectedAgentId}
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                />
              ))}
            </div>
          </div>

          {/* Plan Preview */}
          <PlanPreview className="flex-shrink-0 border-white/5 border-t" />
        </div>

        {/* Execution Logs */}
        {showLogs && (
          <ExecutionLog
            agentId={selectedAgentId}
            className="w-80 flex-shrink-0 border-white/5 border-l"
            onClose={() => setShowLogs(false)}
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
