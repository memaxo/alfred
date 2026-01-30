/**
 * Deployments Section
 *
 * List and manage all deployments (preview and production).
 * Supports filtering, status updates, and promotion workflows.
 */

import {
  CheckCircle,
  ChevronRight,
  Cloud,
  ExternalLink,
  Globe,
  RefreshCw,
  Rocket,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type DeploymentType = "preview" | "production";
type DeploymentStatus = "running" | "active" | "stopped" | "failed" | "removed";

interface Deployment {
  id: string;
  app: string;
  type: DeploymentType;
  status: DeploymentStatus;
  domain: string;
  url: string;
  containerName: string | null;
  containerId: string | null;
  port: number | null;
  healthUrl: string | null;
  created: string | null;
  updated: string | null;
  metadata: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function DeploymentsSection() {
  const [filter, setFilter] = useState<DeploymentType | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // tRPC queries
  const deploymentsQuery = trpc.deploy.list.useQuery(
    { type: filter === "all" ? undefined : filter },
    { refetchInterval: 10_000 }
  );

  const utils = trpc.useUtils();

  // Transform data
  const deployments: Deployment[] = useMemo(() => {
    const raw = deploymentsQuery.data ?? [];
    return raw.map((d) => ({
      id: d.id,
      app: d.app,
      type: (d.type ?? "preview") as DeploymentType,
      status: (d.status ?? "running") as DeploymentStatus,
      domain: d.domain ?? "",
      url: d.url ?? "",
      containerName: d.containerName ?? null,
      containerId: d.containerId ?? null,
      port: d.port ?? null,
      healthUrl: d.healthUrl ?? null,
      created: d.created ?? null,
      updated: d.updated ?? null,
      metadata: (d.metadata ?? {}) as Record<string, unknown>,
    }));
  }, [deploymentsQuery.data]);

  const selectedDeployment = useMemo(
    () => deployments.find((d) => d.id === selectedId),
    [deployments, selectedId]
  );

  // Mutations
  const removeMutation = trpc.deploy.removeRecord.useMutation({
    onSuccess: () => {
      void utils.deploy.list.invalidate();
      setDeleteDialogOpen(false);
      setSelectedId(null);
    },
  });

  // Handlers
  const handleRefresh = useCallback(() => {
    void utils.deploy.list.invalidate();
  }, [utils]);

  const handleDelete = useCallback(() => {
    if (selectedId) {
      removeMutation.mutate({ id: selectedId });
    }
  }, [removeMutation, selectedId]);

  return (
    <div className="flex h-full">
      {/* Deployments List */}
      <div
        className={cn(
          "flex flex-col border-white/5 border-r transition-all",
          selectedId ? "w-80" : "flex-1"
        )}
      >
        {/* Toolbar */}
        <div className="flex h-12 items-center justify-between border-white/5 border-b px-3">
          <div className="flex items-center gap-1">
            <FilterButton
              active={filter === "all"}
              label="All"
              onClick={() => setFilter("all")}
            />
            <FilterButton
              active={filter === "preview"}
              label="Preview"
              onClick={() => setFilter("preview")}
            />
            <FilterButton
              active={filter === "production"}
              label="Production"
              onClick={() => setFilter("production")}
            />
          </div>

          <Button
            disabled={deploymentsQuery.isRefetching}
            onClick={handleRefresh}
            size="icon"
            variant="ghost"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                deploymentsQuery.isRefetching && "animate-spin"
              )}
            />
          </Button>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {deployments.length === 0 ? (
            <EmptyState isLoading={deploymentsQuery.isLoading} />
          ) : (
            <div className="space-y-1 p-2">
              {deployments.map((deployment) => (
                <DeploymentCard
                  isSelected={deployment.id === selectedId}
                  key={deployment.id}
                  onClick={() => setSelectedId(deployment.id)}
                  deployment={deployment}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Detail Panel */}
      {selectedDeployment && (
        <DeploymentDetail
          deployment={selectedDeployment}
          onClose={() => setSelectedId(null)}
          onDelete={() => setDeleteDialogOpen(true)}
        />
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Deployment</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the deployment for{" "}
              <strong>{selectedDeployment?.app}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
              disabled={removeMutation.isPending}
              onClick={handleDelete}
            >
              {removeMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

interface FilterButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function FilterButton({ active, label, onClick }: FilterButtonProps) {
  return (
    <button
      className={cn(
        "rounded-lg px-2.5 py-1 text-xs transition-colors",
        active
          ? "bg-biolum/20 text-biolum"
          : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

interface DeploymentCardProps {
  isSelected: boolean;
  onClick: () => void;
  deployment: Deployment;
}

function DeploymentCard({
  isSelected,
  onClick,
  deployment,
}: DeploymentCardProps) {
  return (
    <button
      className={cn(
        "w-full rounded-lg p-3 text-left transition-all",
        isSelected ? "bg-biolum/10 ring-1 ring-biolum/30" : "hover:bg-white/5"
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start gap-2">
        <StatusIcon status={deployment.status} type={deployment.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-sm">
              {deployment.app}
            </span>
            <TypeBadge type={deployment.type} />
          </div>
          <p className="truncate text-biolum-dim text-xs">
            {deployment.domain}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-biolum-faint text-xs">
            <span>{formatRelativeTime(deployment.updated)}</span>
            {deployment.port && <span>• Port {deployment.port}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

function StatusIcon({
  status,
  type,
}: {
  status: DeploymentStatus;
  type: DeploymentType;
}) {
  const isProduction = type === "production";

  if (status === "active" || status === "running") {
    return (
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
          isProduction
            ? "bg-green-500/20 text-green-400"
            : "bg-blue-500/20 text-blue-400"
        )}
      >
        <CheckCircle className="h-4 w-4" />
      </div>
    );
  }

  if (status === "failed" || status === "stopped") {
    return (
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
        <XCircle className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-biolum-dim">
      <Cloud className="h-4 w-4" />
    </div>
  );
}

function TypeBadge({ type }: { type: DeploymentType }) {
  const config: Record<DeploymentType, { className: string; label: string }> = {
    preview: {
      className: "bg-blue-500/20 text-blue-400",
      label: "Preview",
    },
    production: {
      className: "bg-green-500/20 text-green-400",
      label: "Prod",
    },
  };

  return (
    <Badge className={cn("text-[10px]", config[type].className)}>
      {config[type].label}
    </Badge>
  );
}

interface DeploymentDetailProps {
  deployment: Deployment;
  onClose: () => void;
  onDelete: () => void;
}

function DeploymentDetail({
  deployment,
  onClose,
  onDelete,
}: DeploymentDetailProps) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-white/5 border-b px-4">
        <div className="flex items-center gap-2 min-w-0">
          <Rocket className="h-4 w-4 text-biolum flex-shrink-0" />
          <span className="font-medium text-sm truncate">{deployment.app}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            className="h-8 w-8 text-red-400 hover:bg-red-500/10"
            onClick={onDelete}
            size="icon"
            variant="ghost"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button onClick={onClose} size="icon" variant="ghost">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Status Card */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={deployment.status} />
              <TypeBadge type={deployment.type} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <MetadataItem
                icon={<Globe className="h-3.5 w-3.5" />}
                label="Domain"
                value={deployment.domain}
              />
              <MetadataItem
                icon={<Cloud className="h-3.5 w-3.5" />}
                label="Container"
                value={deployment.containerName ?? "N/A"}
              />
              {deployment.port && (
                <MetadataItem
                  icon={<Rocket className="h-3.5 w-3.5" />}
                  label="Port"
                  value={String(deployment.port)}
                />
              )}
              <MetadataItem
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                label="Updated"
                value={formatRelativeTime(deployment.updated)}
              />
            </div>
          </div>

          {/* URL */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-biolum-dim">
              URL
            </h4>
            <a
              className="flex items-center gap-2 text-biolum hover:underline"
              href={deployment.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {deployment.url}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Metadata */}
          {Object.keys(deployment.metadata).length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-biolum-dim">
                Metadata
              </h4>
              <pre className="max-h-48 overflow-auto text-xs text-biolum-dim">
                {JSON.stringify(deployment.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function StatusBadge({ status }: { status: DeploymentStatus }) {
  const config: Record<DeploymentStatus, { className: string; label: string }> =
    {
      running: { className: "bg-blue-500/20 text-blue-400", label: "Running" },
      active: { className: "bg-green-500/20 text-green-400", label: "Active" },
      stopped: { className: "bg-gray-500/20 text-gray-400", label: "Stopped" },
      failed: { className: "bg-red-500/20 text-red-400", label: "Failed" },
      removed: { className: "bg-gray-500/20 text-gray-400", label: "Removed" },
    };

  return (
    <Badge className={cn("text-xs", config[status].className)}>
      {config[status].label}
    </Badge>
  );
}

interface MetadataItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function MetadataItem({ icon, label, value }: MetadataItemProps) {
  return (
    <div className="flex items-center gap-2 text-biolum-dim">
      {icon}
      <span className="text-biolum-faint">{label}:</span>
      <span className="truncate text-biolum">{value}</span>
    </div>
  );
}

interface EmptyStateProps {
  isLoading: boolean;
}

function EmptyState({ isLoading }: EmptyStateProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-biolum-dim" />
      </div>
    );
  }

  return (
    <div className="flex h-64 flex-col items-center justify-center px-8 text-center">
      <Cloud className="mb-4 h-12 w-12 text-biolum-dim/50" />
      <p className="text-biolum-dim text-sm">No deployments found.</p>
      <p className="mt-1 text-biolum-faint text-xs">
        Create a preview deployment to get started.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatRelativeTime(date: string | null | undefined): string {
  if (!date) {
    return "Unknown";
  }
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${days}d ago`;
}
