import type { inferRouterOutputs } from "@trpc/server";

import {
  Activity,
  AlertTriangle,
  Clock,
  RefreshCw,
  Server,
  ShieldAlert,
  Signal,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BiometricGate, isBiometricError } from "@/components/admin/gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";

const REFRESH_INTERVAL_MS = 3000;

type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type VoiceStats = RouterOutputs["admin"]["getVoiceStats"];
type VoiceTelemetry = NonNullable<VoiceStats["telemetry"]>;
type PoolStats = NonNullable<VoiceStats["sttPool"]>;
type PoolProcess = PoolStats["health"][number];

export function VoiceAdminView() {
  const utils = trpc.useUtils();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const {
    data: stats,
    error,
    isLoading,
    isRefetching,
    refetch,
  } = trpc.admin.getVoiceStats.useQuery(undefined, {
    refetchInterval: REFRESH_INTERVAL_MS,
    retry: false,
  });

  useEffect(() => {
    if (stats?.generatedAt) {
      setLastUpdated(new Date(stats.generatedAt));
    }
  }, [stats?.generatedAt]);

  const restartMutation = trpc.admin.restartVoicePool.useMutation({
    onSuccess: (result) => {
      toast.success(
        result?.pool === "stt"
          ? "Speech-to-Text pool restarted"
          : "Text-to-Speech pool restarted"
      );
      utils.admin.getVoiceStats.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to restart pool");
    },
  });

  const clearSessionsMutation = trpc.admin.clearVoiceSessions.useMutation({
    onSuccess: (result) => {
      toast.success(
        result?.cleared
          ? `Cleared ${result.cleared} session${result.cleared === 1 ? "" : "s"}`
          : "Cleared lingering sessions"
      );
      utils.admin.getVoiceStats.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to clear sessions");
    },
  });

  const biometricRequired = isBiometricError(error);

  if (biometricRequired) {
    return <BiometricGate onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return <VoiceAdminSkeleton />;
  }

  if (!stats) {
    return <EmptyState message="No stats available" />;
  }

  const summaryCards = buildSummaryCards(stats, lastUpdated);

  const handleRestart = (pool: "stt" | "tts") => {
    const label = pool === "stt" ? "Speech-to-Text" : "Text-to-Speech";
    if (
      window.confirm(
        `Restart ${label}? Active sessions may experience a brief interruption.`
      )
    ) {
      restartMutation.mutate({ pool });
    }
  };

  const handleClearSessions = () => {
    if (
      window.confirm(
        "Clear all active voice sessions? This disconnects any ongoing calls."
      )
    ) {
      clearSessionsMutation.mutate();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="text-biolum-dim text-sm">Voice infrastructure</p>
          <h1 className="font-semibold text-2xl text-biolum">
            Voice Operations Console
          </h1>
        </div>
        {isRefetching && (
          <Badge className="text-xs" variant="outline">
            Syncing data...
          </Badge>
        )}
        <div className="flex-1" />
        <Button onClick={() => refetch()} variant="ghost">
          Refresh
        </Button>
        <Button
          className="gap-2"
          disabled={clearSessionsMutation.isPending}
          onClick={handleClearSessions}
          variant="outline"
        >
          <ShieldAlert className="h-4 w-4" />
          Clear Sessions
        </Button>
      </div>

      {"message" in stats && stats.message ? (
        <MessageBanner message={stats.message as string} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card data-testid="voice-admin-stat" key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-2xl tracking-tight">
                  {card.value}
                </CardTitle>
              </div>
              <span className="rounded-full bg-white/5 p-3 text-biolum">
                {card.icon}
              </span>
            </CardHeader>
            {card.meta && (
              <CardContent className="text-biolum-dim text-sm">
                {card.meta}
              </CardContent>
            )}
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <PoolPanel
          isRestarting={
            restartMutation.isPending &&
            restartMutation.variables?.pool === "stt"
          }
          onRestart={() => handleRestart("stt")}
          pool={stats.sttPool}
          title="Speech-to-Text Pool"
        />
        <PoolPanel
          isRestarting={
            restartMutation.isPending &&
            restartMutation.variables?.pool === "tts"
          }
          onRestart={() => handleRestart("tts")}
          pool={stats.ttsPool}
          title="Text-to-Speech Pool"
        />
      </section>

      <LatencyPanel telemetry={stats.telemetry} />
    </div>
  );
}

function buildSummaryCards(stats: VoiceStats, lastUpdated: Date | null) {
  return [
    {
      label: "Active Sessions",
      value: stats.activeSessions ?? 0,
      icon: <Activity className="h-5 w-5" />,
      meta: "Live voice sessions",
    },
    {
      label: "STT Utilization",
      value: formatUsage(stats.sttPool),
      icon: <Zap className="h-5 w-5" />,
      meta: stats.sttPool
        ? `${formatPercent(stats.sttPool.utilization)} used`
        : "Unavailable",
    },
    {
      label: "TTS Utilization",
      value: formatUsage(stats.ttsPool),
      icon: <Server className="h-5 w-5" />,
      meta: stats.ttsPool
        ? `${formatPercent(stats.ttsPool.utilization)} used`
        : "Unavailable",
    },
    {
      label: "Last Updated",
      value: lastUpdated ? lastUpdated.toLocaleTimeString() : "--",
      icon: <Clock className="h-5 w-5" />,
      meta: lastUpdated
        ? lastUpdated.toLocaleDateString()
        : "Awaiting telemetry",
    },
  ];
}

function PoolPanel({
  title,
  pool,
  onRestart,
  isRestarting,
}: {
  title: string;
  pool: PoolStats | null;
  onRestart: () => void;
  isRestarting: boolean;
}) {
  if (!pool) {
    return (
      <Card className="border-white/15 border-dashed bg-void-surface/40">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Pool not initialized (cloud provider).
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const utilization = Math.round((pool.utilization ?? 0) * 100);

  return (
    <Card className="bg-void-surface/40">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {pool.active} active / {pool.size} processes
          </CardDescription>
        </div>
        <Button
          className="gap-2"
          disabled={isRestarting}
          onClick={onRestart}
          size="sm"
          variant="secondary"
        >
          <RefreshCw
            className={cn("h-4 w-4", isRestarting && "animate-spin")}
          />
          Restart
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-biolum-dim text-sm">
            <span>Utilization</span>
            <span>{utilization}%</span>
          </div>
          <Progress value={utilization} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {pool.health?.map((process, index) => (
            <ProcessHealthCard index={index} key={index} process={process} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProcessHealthCard({
  process,
  index,
}: {
  process: PoolProcess;
  index: number;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 text-sm transition",
        process.isHealthy
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-red-500/30 bg-red-500/5"
      )}
    >
      <div className="mb-2 flex items-center justify-between font-mono text-xs">
        <span>Process #{index + 1}</span>
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            process.isHealthy ? "bg-emerald-400" : "bg-red-400"
          )}
        />
      </div>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-biolum-dim">Requests</dt>
          <dd className="font-mono">{process.requestCount ?? 0}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-biolum-dim">Errors</dt>
          <dd
            className={cn(
              "font-mono",
              process.errorCount ? "text-red-300" : undefined
            )}
          >
            {process.errorCount ?? 0}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-biolum-dim">Uptime</dt>
          <dd className="font-mono">{formatDuration(process.uptime ?? 0)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-biolum-dim">Last ping</dt>
          <dd className="font-mono">{formatLastPing(process.lastPing)}</dd>
        </div>
      </dl>
    </div>
  );
}

function LatencyPanel({ telemetry }: { telemetry?: VoiceTelemetry | null }) {
  if (!telemetry) {
    return (
      <Card className="border border-white/10 border-dashed bg-void-surface/30">
        <CardHeader>
          <CardTitle>Latency & Telemetry</CardTitle>
          <CardDescription>
            Telemetry is unavailable. Ensure voice metrics are enabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-biolum-dim text-sm">
            <Signal className="h-5 w-5 text-biolum" />
            <div>
              <p>No telemetry samples yet.</p>
              <p className="text-xs">
                Configure Prometheus scraping for voice metrics or enable local
                pools to populate real-time charts.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const telemetryCards = buildTelemetryCards(telemetry);

  return (
    <Card className="border border-white/10 bg-void-surface/30">
      <CardHeader>
        <CardTitle>Latency & Telemetry</CardTitle>
        <CardDescription>
          Rolling stats derived from Prometheus samples.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {telemetryCards.map((metric) => (
            <Card className="bg-white/5 text-sm" key={metric.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{metric.label}</CardTitle>
                <CardDescription>{metric.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-1 font-mono text-biolum text-xs">
                  <div className="flex justify-between">
                    <dt>P50</dt>
                    <dd>{metric.p50}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>P95</dt>
                    <dd>{metric.p95}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Avg</dt>
                    <dd>{metric.average}</dd>
                  </div>
                  <div className="flex justify-between text-biolum-dim">
                    <dt>Samples</dt>
                    <dd>{metric.samples}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MessageBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-biolum text-sm">
      <AlertTriangle className="h-5 w-5" />
      <span>{message}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-white/10 border-dashed bg-void-surface/40 p-10 text-center text-biolum-dim">
      {message}
    </div>
  );
}

function VoiceAdminSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-32 w-full" key={index} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton className="h-64 w-full" key={index} />
        ))}
      </div>
    </div>
  );
}

function formatUsage(pool: PoolStats | null | undefined) {
  if (!pool) {
    return "—";
  }
  return `${pool.active ?? 0} / ${pool.size ?? 0}`;
}

function formatPercent(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0%";
  }
  return `${Math.round(value * 100)}%`;
}

function formatDuration(ms: number) {
  if (!ms) {
    return "0s";
  }
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatLastPing(lastPing: number | null | undefined) {
  if (!lastPing) {
    return "—";
  }
  const deltaSeconds = Math.floor((Date.now() - lastPing) / 1000);
  if (deltaSeconds < 2) {
    return "live";
  }
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function buildTelemetryCards(telemetry: VoiceTelemetry) {
  const format = (summary: HistogramSummary) => ({
    p50: formatMetricValue(summary.p50, summary.unit),
    p95: formatMetricValue(summary.p95, summary.unit),
    average: formatMetricValue(summary.average, summary.unit),
    samples: summary.count,
  });

  const cards = [
    {
      label: "STT Latency",
      description: "Speech-to-text inference time",
      ...format(telemetry.sttLatency),
    },
    {
      label: "TTS Latency",
      description: "Text-to-speech synthesis time",
      ...format(telemetry.ttsLatency),
    },
    {
      label: "Round Trip",
      description: "Client reported RTT",
      ...format(telemetry.roundTrip),
    },
    {
      label: "Jitter",
      description: "Session jitter",
      ...format(telemetry.jitter),
    },
    {
      label: "Packet Loss",
      description: "Total packets lost",
      p50: `${telemetry.packetLossTotal ?? 0}`,
      p95: "—",
      average: "—",
      samples: telemetry.packetLossTotal ?? 0,
    },
  ];

  return cards;
}

type HistogramSummary = VoiceTelemetry["sttLatency"];

function formatMetricValue(
  value: number | null,
  unit: HistogramSummary["unit"]
) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  if (unit === "milliseconds") {
    return `${Math.round(value)} ms`;
  }
  if (value >= 1) {
    return `${value.toFixed(2)} s`;
  }
  return `${(value * 1000).toFixed(0)} ms`;
}
