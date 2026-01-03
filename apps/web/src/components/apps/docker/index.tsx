"use client";

/**
 * Docker Manager Application - Phase 3 System Application
 *
 * Monitor and manage Docker containers with logs and resources.
 *
 * Features:
 * - Container list with status filters
 * - Real-time log streaming
 * - Resource charts (CPU, memory)
 * - AgentFS workspace linking
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.5
 */

import { Box, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { ContainerDetail } from "./container-detail";
import { ContainerList } from "./container-list";
import { LogsViewer } from "./logs-viewer";
import { ResourceChart } from "./resource-chart";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type DockerAppProps = {
  windowId?: string;
  className?: string;
};

export type Container = {
  id: string;
  name: string;
  image: string;
  status: "running" | "stopped" | "paused" | "exited";
  ports: string[];
  created: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  isAgentWorkspace: boolean;
  workspaceId?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function DockerApp({ windowId: _windowId, className }: DockerAppProps) {
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(
    null
  );
  const [filter, setFilter] = useState<"all" | "running" | "agent">("running");
  const [tab, setTab] = useState<"logs" | "resources">("logs");
  const utils = trpc.useUtils();

  // Fetch containers from backend
  const { data, isLoading, error } = trpc.deploy.containersList.useQuery(
    { filter },
    { refetchInterval: 5000 } // Refresh every 5 seconds
  );

  const containers: Container[] = (data?.containers ?? []).map((c) => ({
    ...c,
    status: c.status as Container["status"],
  }));

  const handleRefresh = () => {
    void utils.deploy.containersList.invalidate();
  };

  return (
    <div
      className={cn("flex h-full w-full flex-col bg-void-surface", className)}
      data-app="docker"
    >
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Docker</span>
        </div>

        <div className="flex items-center gap-1">
          <FilterButton
            active={filter === "all"}
            label="All"
            onClick={() => setFilter("all")}
          />
          <FilterButton
            active={filter === "running"}
            label="Running"
            onClick={() => setFilter("running")}
          />
          <FilterButton
            active={filter === "agent"}
            label="AgentFS"
            onClick={() => setFilter("agent")}
          />
          <div className="mx-2 h-4 w-px bg-white/10" />
          <Button
            className="h-7 w-7"
            onClick={handleRefresh}
            size="icon"
            variant="ghost"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Container List */}
        <ContainerList
          className="w-72 flex-shrink-0 border-white/5 border-r"
          containers={containers}
          error={error?.message}
          filter={filter}
          isLoading={isLoading}
          onSelect={setSelectedContainerId}
          selectedId={selectedContainerId}
        />

        {/* Detail + Tabs */}
        {selectedContainerId ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Container Detail */}
            <ContainerDetail
              className="flex-shrink-0 border-white/5 border-b"
              container={containers.find((c) => c.id === selectedContainerId)}
              containerId={selectedContainerId}
            />

            {/* Tab Selector */}
            <div className="flex border-white/5 border-b">
              <TabButton
                active={tab === "logs"}
                label="Logs"
                onClick={() => setTab("logs")}
              />
              <TabButton
                active={tab === "resources"}
                label="Resources"
                onClick={() => setTab("resources")}
              />
            </div>

            {/* Tab Content */}
            {tab === "logs" ? (
              <LogsViewer
                className="flex-1"
                containerId={selectedContainerId}
              />
            ) : (
              <ResourceChart
                className="flex-1"
                containerId={selectedContainerId}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-biolum-dim">
            <div className="text-center">
              <Box className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>Select a container</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded px-2 py-1 text-xs transition-colors",
        active ? "bg-biolum/10 text-biolum" : "text-biolum-dim hover:bg-white/5"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "border-b-2 px-4 py-2 text-sm transition-colors",
        active
          ? "border-biolum text-biolum"
          : "border-transparent text-biolum-dim hover:text-biolum"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function DockerAppWindow(props: WindowComponentProps) {
  return <DockerApp className="h-full" windowId={props.window.id} />;
}

export default DockerApp;
