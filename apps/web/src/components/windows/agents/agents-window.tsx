/**
 * Agents Window - Full Agent Waves Management Desktop App
 *
 * Deep backend integration for orchestrator runs with:
 * - Real-time wave timeline visualization
 * - Agent cards with progress indicators
 * - Execution logs panel
 * - Runs list with filtering
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.3
 */

import type { NodeProps } from "@xyflow/react";

import {
  Activity,
  Bot,
  CheckCircle,
  ChevronLeft,
  Cpu,
  Filter,
  Layers,
  Loader2,
  PanelRight,
  Pause,
  Play,
  RefreshCw,
  Square,
  Terminal,
  Wand2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { BiolumBadge } from "@/components/tremor";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type RunStatus = "running" | "suspended" | "completed" | "failed" | "cancelled";

type AgentStatus = "pending" | "spawning" | "running" | "completed" | "failed";

interface Agent {
  id: string;
  name: string;
  type: "codex" | "droid" | "claude" | "roo";
  status: AgentStatus;
  progress: number;
  wave: number;
  parentId?: string;
  output?: string;
}

interface Wave {
  id: number;
  status: "pending" | "running" | "completed";
  agents: string[];
  startTime?: string;
  endTime?: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "warning" | "error" | "success";
  agentId: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
}

type ViewMode = "list" | "detail";

const agentsWindowDataSchema = z.object({
  type: z.literal("agents"),
  label: z.string().optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  runId: z.string().optional(),
  statusFilter: z
    .enum(["all", "running", "suspended", "completed", "failed", "cancelled"])
    .default("all"),
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function AgentsWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  const parsed = agentsWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : {
        type: "agents" as const,
        viewMode: "full" as const,
        statusFilter: "all" as const,
      };

  const [viewMode, setViewMode] = useState<ViewMode>(
    windowData.runId ? "detail" : "list"
  );
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    windowData.runId ?? null
  );
  const [statusFilter, setStatusFilter] = useState<"all" | RunStatus>(
    windowData.statusFilter
  );
  const [showLogs, setShowLogs] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Fetch runs list
  const { data: runsData, isLoading: isLoadingRuns } =
    trpc.orchestrator.runsList.useQuery(
      {
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 50,
      },
      { refetchInterval: viewMode === "list" ? 5000 : false }
    );

  // Fetch selected run details
  const { data: runDetail, isLoading: isLoadingDetail } =
    trpc.orchestrator.runsGet.useQuery(
      { runId: selectedRunId ?? "" },
      {
        enabled: Boolean(selectedRunId) && viewMode === "detail",
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          return status === "running" || status === "suspended" ? 2000 : false;
        },
      }
    );

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

  const runs = runsData?.runs ?? [];
  const runningCount = runs.filter((r) => r.status === "running").length;

  const handleSelectRun = useCallback((runId: string) => {
    setSelectedRunId(runId);
    setViewMode("detail");
    setSelectedAgentId(null);
  }, []);

  const handleBackToList = useCallback(() => {
    setViewMode("list");
    setSelectedRunId(null);
    setSelectedAgentId(null);
  }, []);

  const handlePause = useCallback(() => {
    if (selectedRunId) {
      pauseMutation.mutate({ runId: selectedRunId });
    }
  }, [selectedRunId, pauseMutation]);

  const handleResume = useCallback(() => {
    if (selectedRunId) {
      resumeMutation.mutate({ runId: selectedRunId });
    }
  }, [selectedRunId, resumeMutation]);

  const handleCancel = useCallback(() => {
    if (selectedRunId) {
      cancelMutation.mutate({ runId: selectedRunId });
    }
  }, [selectedRunId, cancelMutation]);

  // LOD rendering
  if (lod === "tiny") {
    return (
      <TinyDot
        color={runningCount > 0 ? "bg-biolum" : "bg-biolum-dim"}
        shadow={
          runningCount > 0
            ? "shadow-[0_0_8px_rgba(var(--biolum-rgb),1)] animate-pulse"
            : "shadow-biolum-dim/50"
        }
      />
    );
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-biolum/20"
        hoverColor="hover:border-biolum/40"
        icon={<Bot className="h-3 w-3" />}
        label={`Agents (${runningCount})`}
        textColor="text-biolum"
      />
    );
  }

  return (
    <WindowFrame
      actions={
        <div className="flex items-center gap-1">
          {viewMode === "detail" && (
            <Button
              className="h-6 w-6"
              onClick={() => setShowLogs(!showLogs)}
              size="icon"
              title="Toggle logs"
              variant="ghost"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          )}
          <Button
            className="h-6 w-6"
            onClick={() => {
              void utils.orchestrator.runsList.invalidate();
              void utils.orchestrator.runsGet.invalidate();
            }}
            size="icon"
            title="Refresh"
            variant="ghost"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      }
      height={500}
      id={id}
      selected={selected}
      title="Agent Waves"
      width={viewMode === "detail" && showLogs ? 800 : 500}
      windowType="agents"
    >
      {viewMode === "list" ? (
        <RunsList
          isLoading={isLoadingRuns}
          onSelectRun={handleSelectRun}
          onStatusFilterChange={setStatusFilter}
          runs={runs}
          statusFilter={statusFilter}
        />
      ) : (
        <RunDetail
          agents={runDetail?.agents ?? []}
          isLoading={isLoadingDetail}
          isPaused={runDetail?.status === "suspended"}
          onBack={handleBackToList}
          onCancel={handleCancel}
          onPause={handlePause}
          onResume={handleResume}
          run={runDetail}
          selectedAgentId={selectedAgentId}
          setSelectedAgentId={setSelectedAgentId}
          showLogs={showLogs}
          waves={runDetail?.waves ?? []}
        />
      )}
    </WindowFrame>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNS LIST VIEW
// ─────────────────────────────────────────────────────────────────────────────

interface RunsListProps {
  runs: {
    id: string;
    workflowId: string | null;
    requirement: string | null;
    status: string;
    created: string;
    agentCount: number;
    progress: number;
  }[];
  isLoading: boolean;
  onSelectRun: (runId: string) => void;
  statusFilter: "all" | RunStatus;
  onStatusFilterChange: (filter: "all" | RunStatus) => void;
}

const statusVariants: Record<
  string,
  React.ComponentProps<typeof BiolumBadge>["variant"]
> = {
  running: "default",
  completed: "success",
  failed: "error",
  suspended: "warning",
  cancelled: "default",
};

function RunsList({
  runs,
  isLoading,
  onSelectRun,
  statusFilter,
  onStatusFilterChange,
}: RunsListProps) {
  const sortedRuns = useMemo(
    () =>
      [...runs].sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      ),
    [runs]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Filter bar */}
      <div className="flex items-center justify-between border-white/5 border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-biolum-dim" />
          <Select
            onValueChange={(v) => onStatusFilterChange(v as "all" | RunStatus)}
            value={statusFilter}
          >
            <SelectTrigger className="h-7 w-[120px] text-xs">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Runs</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-biolum-faint text-xs">
          {runs.length} run{runs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Runs list */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-biolum-dim" />
            </div>
          )}
          {!isLoading && sortedRuns.length === 0 && (
            <div className="py-8 text-center text-biolum-faint text-sm">
              No runs found
            </div>
          )}
          {sortedRuns.map((run) => (
            <button
              className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2.5 text-left transition-all hover:border-biolum/30 hover:bg-white/10"
              key={run.id}
              onClick={() => onSelectRun(run.id)}
              type="button"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-biolum/10">
                {run.status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-biolum" />
                ) : (
                  <Layers className="h-4 w-4 text-biolum-dim" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-white">
                    {run.workflowId ?? run.id.slice(0, 8)}
                  </span>
                  <BiolumBadge
                    variant={statusVariants[run.status] ?? "default"}
                  >
                    {run.status}
                  </BiolumBadge>
                </div>
                <div className="flex items-center gap-2 text-biolum-faint text-xs">
                  <span>{new Date(run.created).toLocaleString()}</span>
                  <span>•</span>
                  <span>{run.agentCount} agents</span>
                  {run.status === "running" && (
                    <>
                      <span>•</span>
                      <span className="text-biolum">{run.progress}%</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN DETAIL VIEW
// ─────────────────────────────────────────────────────────────────────────────

interface RunDetailProps {
  run:
    | {
        id: string;
        status: string;
        requirement: string | null;
        progress: number;
      }
    | null
    | undefined;
  waves: Wave[];
  agents: Agent[];
  isLoading: boolean;
  isPaused: boolean;
  showLogs: boolean;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  onBack: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

function RunDetail({
  run,
  waves,
  agents,
  isLoading,
  isPaused,
  showLogs,
  selectedAgentId,
  setSelectedAgentId,
  onBack,
  onPause,
  onResume,
  onCancel,
}: RunDetailProps) {
  if (isLoading || !run) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-biolum-dim" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with controls */}
      <div className="flex items-center justify-between border-white/5 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            className="h-7 gap-1 text-xs"
            onClick={onBack}
            size="sm"
            variant="ghost"
          >
            <ChevronLeft className="h-3 w-3" />
            Back
          </Button>
          <div className="h-4 w-px bg-white/10" />
          <span className="font-medium text-sm">{run.id.slice(0, 8)}</span>
          <BiolumBadge variant={statusVariants[run.status] ?? "default"}>
            {run.status}
          </BiolumBadge>
        </div>
        <div className="flex items-center gap-1">
          {isPaused ? (
            <Button
              className="h-7 gap-1 text-xs"
              onClick={onResume}
              size="sm"
              variant="ghost"
            >
              <Play className="h-3 w-3" />
              Resume
            </Button>
          ) : (
            <Button
              className="h-7 gap-1 text-xs"
              disabled={run.status !== "running"}
              onClick={onPause}
              size="sm"
              variant="ghost"
            >
              <Pause className="h-3 w-3" />
              Pause
            </Button>
          )}
          <Button
            className="h-7 gap-1 text-red-400 text-xs"
            disabled={run.status === "completed" || run.status === "cancelled"}
            onClick={onCancel}
            size="sm"
            variant="ghost"
          >
            <Square className="h-3 w-3" />
            Cancel
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Wave timeline + agents */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Wave Timeline */}
          <WaveTimeline waves={waves} />

          {/* Agent Grid */}
          <div className="flex-1 overflow-auto p-3">
            {agents.length === 0 ? (
              <div className="flex h-full items-center justify-center text-biolum-dim">
                No agents spawned yet
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
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
        </div>

        {/* Right: Execution logs */}
        {showLogs && <ExecutionLogs agentId={selectedAgentId} runId={run.id} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WAVE TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

function WaveTimeline({ waves }: { waves: Wave[] }) {
  if (waves.length === 0) {
    return null;
  }

  return (
    <div className="border-white/5 border-b px-4 py-3">
      <div className="flex items-center gap-2">
        {waves.map((wave, index) => (
          <div className="flex items-center" key={wave.id}>
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full font-medium text-sm transition-all",
                wave.status === "completed" && "bg-green-500/20 text-green-400",
                wave.status === "running" &&
                  "animate-pulse bg-biolum/20 text-biolum",
                wave.status === "pending" && "bg-white/5 text-biolum-dim"
              )}
            >
              {wave.id}
            </div>
            {index < waves.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 w-8 transition-colors",
                  wave.status === "completed"
                    ? "bg-green-500/50"
                    : "bg-white/10"
                )}
              />
            )}
          </div>
        ))}

        <div className="ml-auto flex items-center gap-2 text-xs">
          {waves.map((wave) =>
            wave.status === "running" ? (
              <span className="text-biolum" key={wave.id}>
                Wave {wave.id}: {wave.agents.length} agent
                {wave.agents.length !== 1 ? "s" : ""} running
              </span>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT CARD
// ─────────────────────────────────────────────────────────────────────────────

const typeIcons: Record<Agent["type"], typeof Bot> = {
  codex: Terminal,
  droid: Cpu,
  claude: Bot,
  roo: Wand2,
};

const typeColors: Record<Agent["type"], string> = {
  codex: "text-green-400",
  droid: "text-blue-400",
  claude: "text-orange-400",
  roo: "text-pink-400",
};

function AgentCard({
  agent,
  isSelected,
  onClick,
}: {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = typeIcons[agent.type];

  return (
    <button
      className={cn(
        "flex flex-col rounded-lg border p-2.5 text-left transition-all",
        isSelected
          ? "border-biolum/30 bg-biolum/5"
          : "border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/10"
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-3.5 w-3.5", typeColors[agent.type])} />
          <span className="font-medium text-xs">{agent.name}</span>
        </div>
        <AgentStatusIndicator status={agent.status} />
      </div>

      {(agent.status === "running" || agent.status === "spawning") && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-biolum-dim">Progress</span>
            <span className="text-biolum">{agent.progress}%</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full transition-all",
                agent.status === "spawning"
                  ? "animate-pulse bg-yellow-500"
                  : "bg-biolum"
              )}
              style={{ width: `${agent.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-biolum-dim">
        <span>Wave {agent.wave}</span>
        <span>•</span>
        <span className="capitalize">{agent.type}</span>
      </div>
    </button>
  );
}

function AgentStatusIndicator({ status }: { status: AgentStatus }) {
  switch (status) {
    case "completed": {
      return <CheckCircle className="h-3.5 w-3.5 text-green-400" />;
    }
    case "failed": {
      return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    }
    case "running": {
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-biolum" />;
    }
    case "spawning": {
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />;
    }
    default: {
      return <div className="h-3.5 w-3.5 rounded-full bg-white/20" />;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION LOGS
// ─────────────────────────────────────────────────────────────────────────────

const levelColors: Record<string, string> = {
  info: "text-blue-400",
  warning: "text-yellow-400",
  error: "text-red-400",
  success: "text-green-400",
};

function ExecutionLogs({
  runId,
  agentId,
}: {
  runId: string;
  agentId: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = trpc.orchestrator.logsStream.useQuery(
    {
      runId,
      agentId: agentId ?? undefined,
      limit: 100,
    },
    { refetchInterval: 2000 }
  );

  const logs = data?.logs ?? [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <div className="flex w-72 flex-col border-white/5 border-l">
      <div className="flex items-center justify-between border-white/5 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-biolum-dim" />
          <span className="font-medium text-xs">
            {agentId ? "Agent Logs" : "Execution Logs"}
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 font-mono text-[10px]">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
            </div>
          )}
          {!isLoading && logs.length === 0 && (
            <div className="py-2 text-biolum-dim">No logs yet</div>
          )}
          {logs.map((log: LogEntry) => (
            <div className="flex gap-1.5 py-0.5" key={log.id}>
              <span className="flex-shrink-0 text-biolum-faint">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  "flex-shrink-0",
                  levelColors[log.type] ?? "text-biolum-dim"
                )}
              >
                [{log.type.toUpperCase().padEnd(7)}]
              </span>
              <span className="text-biolum-dim">{log.message}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default AgentsWindow;
