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

import { Box, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import { ContainerDetail } from "./container-detail";
import { ContainerList } from "./container-list";
import { ContainerCreateDialog } from "./create-dialog";
import { LogsViewer } from "./logs-viewer";
import { NetworkCreateDialog } from "./network-dialog";
import { type DockerNetwork, NetworkList } from "./network-list";
import { ResourceChart } from "./resource-chart";
import { VolumeCreateDialog } from "./volume-dialog";
import { type DockerVolume, VolumeList } from "./volume-list";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DockerAppProps {
  windowId?: string;
  className?: string;
}

export interface Container {
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
}

type Mode = "containers" | "networks" | "volumes";

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function DockerApp({ windowId: _windowId, className }: DockerAppProps) {
  const [mode, setMode] = useState<Mode>("containers");
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(
    null
  );
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(
    null
  );
  const [selectedVolumeName, setSelectedVolumeName] = useState<string | null>(
    null
  );
  const [filter, setFilter] = useState<"all" | "running" | "agent">("running");
  const [tab, setTab] = useState<"logs" | "resources">("logs");
  const [createContainerOpen, setCreateContainerOpen] = useState(false);
  const [createNetworkOpen, setCreateNetworkOpen] = useState(false);
  const [createVolumeOpen, setCreateVolumeOpen] = useState(false);
  const utils = trpc.useUtils();

  // Fetch containers from backend
  const containersQuery = trpc.deploy.containersList.useQuery(
    { filter },
    { enabled: mode === "containers", refetchInterval: 5000 }
  );

  const networksQuery = trpc.deploy.networksList.useQuery(undefined, {
    enabled:
      mode === "networks" ||
      mode === "containers" ||
      createNetworkOpen ||
      createContainerOpen,
  });

  const volumesQuery = trpc.deploy.volumesList.useQuery(undefined, {
    enabled: mode === "volumes" || createVolumeOpen || createContainerOpen,
  });

  const containers: Container[] = (containersQuery.data?.containers ?? []).map(
    (c) => ({
      ...c,
      status: c.status as Container["status"],
    })
  );

  const networks: DockerNetwork[] = networksQuery.data?.networks ?? [];
  const volumes: DockerVolume[] = volumesQuery.data?.volumes ?? [];

  const handleRefresh = () => {
    if (mode === "containers") {
      void utils.deploy.containersList.invalidate();
      return;
    }
    if (mode === "networks") {
      void utils.deploy.networksList.invalidate();
      return;
    }
    void utils.deploy.volumesList.invalidate();
  };

  const handleCreate = () => {
    if (mode === "containers") {
      setCreateContainerOpen(true);
      return;
    }
    if (mode === "networks") {
      setCreateNetworkOpen(true);
      return;
    }
    setCreateVolumeOpen(true);
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
          <div className="mx-2 h-4 w-px bg-white/10" />
          <ModeButton
            active={mode === "containers"}
            label="Containers"
            onClick={() => {
              setMode("containers");
              setSelectedNetworkId(null);
              setSelectedVolumeName(null);
            }}
          />
          <ModeButton
            active={mode === "networks"}
            label="Networks"
            onClick={() => {
              setMode("networks");
              setSelectedContainerId(null);
              setSelectedVolumeName(null);
            }}
          />
          <ModeButton
            active={mode === "volumes"}
            label="Volumes"
            onClick={() => {
              setMode("volumes");
              setSelectedContainerId(null);
              setSelectedNetworkId(null);
            }}
          />
        </div>

        <div className="flex items-center gap-1">
          {mode === "containers" && (
            <>
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
            </>
          )}

          <Button
            className="h-7 gap-1 px-2"
            onClick={handleCreate}
            size="sm"
            variant="ghost"
          >
            <Plus className="h-4 w-4" />
            Create
          </Button>
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
        {mode === "containers" ? (
          <>
            <ContainerList
              className="w-72 flex-shrink-0 border-white/5 border-r"
              containers={containers}
              error={containersQuery.error?.message}
              filter={filter}
              isLoading={containersQuery.isLoading}
              onSelect={setSelectedContainerId}
              selectedId={selectedContainerId}
            />

            {selectedContainerId ? (
              <div className="flex flex-1 flex-col overflow-hidden">
                <ContainerDetail
                  className="flex-shrink-0 border-white/5 border-b"
                  container={containers.find(
                    (c) => c.id === selectedContainerId
                  )}
                  containerId={selectedContainerId}
                  networks={networks}
                  onRemoved={() => setSelectedContainerId(null)}
                />

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
              <EmptyDetail label="Select a container" />
            )}
          </>
        ) : mode === "networks" ? (
          <>
            <NetworkList
              className="w-72 flex-shrink-0 border-white/5 border-r"
              error={networksQuery.error?.message}
              isLoading={networksQuery.isLoading}
              networks={networks}
              onSelect={setSelectedNetworkId}
              selectedId={selectedNetworkId}
            />

            <NetworkDetail
              network={networks.find((n) => n.id === selectedNetworkId) ?? null}
              onRemoved={() => {
                setSelectedNetworkId(null);
              }}
            />
          </>
        ) : (
          <>
            <VolumeList
              className="w-72 flex-shrink-0 border-white/5 border-r"
              error={volumesQuery.error?.message}
              isLoading={volumesQuery.isLoading}
              onSelect={setSelectedVolumeName}
              selectedName={selectedVolumeName}
              volumes={volumes}
            />

            <VolumeDetail
              onRemoved={() => setSelectedVolumeName(null)}
              volume={
                volumes.find((v) => v.name === selectedVolumeName) ?? null
              }
            />
          </>
        )}
      </div>

      <ContainerCreateDialog
        networks={networks}
        onCreated={(id) => {
          void utils.deploy.containersList.invalidate();
          if (id) {
            setSelectedContainerId(id);
          }
        }}
        onOpenChange={setCreateContainerOpen}
        open={createContainerOpen}
      />

      <NetworkCreateDialog
        onCreated={() => {
          setSelectedNetworkId(null);
        }}
        onOpenChange={setCreateNetworkOpen}
        open={createNetworkOpen}
      />

      <VolumeCreateDialog
        onCreated={() => {
          setSelectedVolumeName(null);
        }}
        onOpenChange={setCreateVolumeOpen}
        open={createVolumeOpen}
      />
    </div>
  );
}

function EmptyDetail({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-biolum-dim">
      <div className="text-center">
        <Box className="mx-auto mb-4 h-12 w-12 opacity-20" />
        <p>{label}</p>
      </div>
    </div>
  );
}

function ModeButton({
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

function NetworkDetail({
  network,
  onRemoved,
}: {
  network: DockerNetwork | null;
  onRemoved: () => void;
}) {
  const utils = trpc.useUtils();
  const removeMutation = trpc.deploy.networksRemove.useMutation({
    onSuccess: () => {
      void utils.deploy.networksList.invalidate();
      onRemoved();
    },
  });

  if (!network) {
    return <EmptyDetail label="Select a network" />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-void-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-lg">{network.name}</h2>
          <p className="mt-1 text-biolum-dim text-sm">
            {network.driver} • {network.scope}
          </p>
          <p className="mt-1 text-biolum-dim text-xs">ID: {network.id}</p>
        </div>
        <Button
          disabled={removeMutation.isPending}
          onClick={() => removeMutation.mutate({ nameOrId: network.id })}
          size="sm"
          variant="outline"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

function VolumeDetail({
  volume,
  onRemoved,
}: {
  volume: DockerVolume | null;
  onRemoved: () => void;
}) {
  const utils = trpc.useUtils();
  const removeMutation = trpc.deploy.volumesRemove.useMutation({
    onSuccess: () => {
      void utils.deploy.volumesList.invalidate();
      onRemoved();
    },
  });

  if (!volume) {
    return <EmptyDetail label="Select a volume" />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-void-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-lg">{volume.name}</h2>
          <p className="mt-1 text-biolum-dim text-sm">
            Driver: {volume.driver}
          </p>
        </div>
        <Button
          disabled={removeMutation.isPending}
          onClick={() => removeMutation.mutate({ name: volume.name })}
          size="sm"
          variant="outline"
        >
          Remove
        </Button>
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
