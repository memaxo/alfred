/**
 * Health Monitor Section
 *
 * Real-time deployment health status monitoring.
 * Displays health checks for all deployments with live updates.
 */

import { Activity, CheckCircle, Clock, RefreshCw, XCircle } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type HealthStatus = "healthy" | "unhealthy" | "unknown";

interface HealthCheck {
  app: string;
  type: "preview" | "production";
  status: HealthStatus;
  url: string | null;
  ts: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function HealthMonitorSection() {
  // tRPC subscription for real-time health updates
  const healthStream = trpc.deploy.healthStream.useSubscription(
    { intervalMs: 5000, authz: "web-ui" },
    {
      onError: (error) => {
        console.error("Health stream error:", error);
      },
    }
  );

  const utils = trpc.useUtils();

  // Transform and group data
  const healthChecks: HealthCheck[] = useMemo(() => {
    if (!healthStream.data) {
      return [];
    }
    return [healthStream.data];
  }, [healthStream.data]);

  // Group by status
  const grouped = useMemo(() => {
    const healthy = healthChecks.filter((h) => h.status === "healthy");
    const unhealthy = healthChecks.filter((h) => h.status === "unhealthy");
    const unknown = healthChecks.filter((h) => h.status === "unknown");
    return { healthy, unhealthy, unknown };
  }, [healthChecks]);

  const handleRefresh = () => {
    void utils.deploy.list.invalidate();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-12 items-center justify-between border-white/5 border-b px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <StatusIndicator status="healthy" />
            <span className="text-sm text-biolum-dim">
              {grouped.healthy.length} Healthy
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusIndicator status="unhealthy" />
            <span className="text-sm text-biolum-dim">
              {grouped.unhealthy.length} Unhealthy
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusIndicator status="unknown" />
            <span className="text-sm text-biolum-dim">
              {grouped.unknown.length} Unknown
            </span>
          </div>
        </div>

        <Button onClick={handleRefresh} size="sm" variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Health List */}
      <ScrollArea className="flex-1 p-4">
        {healthChecks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {/* Unhealthy first (priority) */}
            {grouped.unhealthy.map((check) => (
              <HealthCard check={check} key={`${check.app}-unhealthy`} />
            ))}
            {/* Unknown second */}
            {grouped.unknown.map((check) => (
              <HealthCard check={check} key={`${check.app}-unknown`} />
            ))}
            {/* Healthy last */}
            {grouped.healthy.map((check) => (
              <HealthCard check={check} key={`${check.app}-healthy`} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StatusIndicator({ status }: { status: HealthStatus }) {
  const colors: Record<HealthStatus, string> = {
    healthy: "bg-green-500",
    unhealthy: "bg-red-500",
    unknown: "bg-yellow-500",
  };

  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 rounded-full", colors[status])}
    />
  );
}

interface HealthCardProps {
  check: HealthCheck;
}

function HealthCard({ check }: HealthCardProps) {
  const StatusIcon =
    check.status === "healthy"
      ? CheckCircle
      : (check.status === "unhealthy"
        ? XCircle
        : Clock);

  const statusColors: Record<HealthStatus, string> = {
    healthy: "text-green-400 border-green-500/30 bg-green-500/10",
    unhealthy: "text-red-400 border-red-500/30 bg-red-500/10",
    unknown: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-3",
        statusColors[check.status]
      )}
    >
      <div className="flex items-center gap-3">
        <StatusIcon className="h-5 w-5" />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{check.app}</span>
            <Badge
              className={cn(
                "text-[10px]",
                check.type === "production"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-blue-500/20 text-blue-400"
              )}
            >
              {check.type}
            </Badge>
          </div>
          <p className="text-xs opacity-80">
            Last check: {formatTime(check.ts)}
          </p>
        </div>
      </div>

      {check.url && (
        <a
          className="text-xs opacity-80 hover:opacity-100 hover:underline"
          href={check.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {check.url.replace(/^https?:\/\//, "")}
        </a>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-biolum-dim">
      <Activity className="mb-4 h-12 w-12 opacity-20" />
      <p className="text-sm">No health data available</p>
      <p className="text-xs text-biolum-faint mt-1">
        Health checks will appear here when deployments are running
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleTimeString();
}
