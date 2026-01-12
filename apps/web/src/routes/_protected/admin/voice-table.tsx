/**
 * Voice Operations with Table Component Integration
 *
 * Shows voice pool processes and latency metrics using the new Table component.
 */

import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { AlertTriangle, Monitor, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";

const REFRESH_INTERVAL_MS = 3000;

type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type VoiceStats = RouterOutputs["admin"]["getVoiceStats"];
type VoiceTelemetry = NonNullable<VoiceStats["telemetry"]>;

export const Route = createFileRoute("/_protected/admin/voice-table")({
  component: VoiceAdminRoute,
});

function VoiceAdminRoute() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-biolum/20 bg-biolum/5 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-biolum/10 p-2">
              <Monitor className="h-5 w-5 text-biolum" />
            </div>
            <div>
              <h3 className="font-semibold text-biolum text-sm">
                Table Component Demo
              </h3>
              <p className="text-biolum-dim text-xs">
                Using new Table component for voice pool data.
              </p>
            </div>
          </div>
        </div>
      </div>
      <VoiceAdminView />
    </div>
  );
}

export function VoiceAdminView() {
  const [_lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const {
    data: stats,
    error,
    isLoading,
    isRefetching,
  } = trpc.admin.getVoiceStats.useQuery(undefined, {
    refetchInterval: REFRESH_INTERVAL_MS,
    retry: false,
  });

  useEffect(() => {
    if (stats?.generatedAt) {
      setLastUpdated(new Date(stats.generatedAt));
    }
  }, [stats?.generatedAt]);

  const biometricRequired = isBiometricError(error);

  if (biometricRequired) {
    return <BiometricGate />;
  }

  if (isLoading) {
    return <VoiceAdminSkeleton />;
  }

  if (!stats) {
    return <EmptyState message="No stats available" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
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
      </div>

      {"message" in stats && stats.message ? (
        <MessageBanner message={stats.message as string} />
      ) : null}

      <Card className="bg-void-surface/40">
        <CardHeader>
          <CardTitle>STT Pool Processes</CardTitle>
          <CardDescription>
            Using Table component to display process health data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.sttPool?.health ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Process</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead>Last Ping</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.sttPool.health.map((process, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      Process #{index + 1}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          process.isHealthy
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-red-500/10 text-red-500"
                        )}
                        variant="outline"
                      >
                        {process.isHealthy ? "Healthy" : "Unhealthy"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {process.requestCount ?? 0}
                    </TableCell>
                    <TableCell className="font-mono">
                      {process.errorCount ?? 0}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatDuration(process.uptime ?? 0)}
                    </TableCell>
                    <TableCell className="font-mono text-biolum-dim">
                      {formatLastPing(process.lastPing)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-biolum-dim text-sm">
              Pool not initialized (cloud provider).
            </div>
          )}
        </CardContent>
      </Card>

      {stats.ttsPool?.health && (
        <Card className="bg-void-surface/40">
          <CardHeader>
            <CardTitle>TTS Pool Processes</CardTitle>
            <CardDescription>
              Text-to-Speech pool process health data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Process</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead>Last Ping</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.ttsPool.health.map((process, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      Process #{index + 1}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          process.isHealthy
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-red-500/10 text-red-500"
                        )}
                        variant="outline"
                      >
                        {process.isHealthy ? "Healthy" : "Unhealthy"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {process.requestCount ?? 0}
                    </TableCell>
                    <TableCell className="font-mono">
                      {process.errorCount ?? 0}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatDuration(process.uptime ?? 0)}
                    </TableCell>
                    <TableCell className="font-mono text-biolum-dim">
                      {formatLastPing(process.lastPing)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {stats.telemetry && (
        <Card className="bg-void-surface/40">
          <CardHeader>
            <CardTitle>Latency Metrics</CardTitle>
            <CardDescription>
              Telemetry data from Prometheus metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>P50</TableHead>
                  <TableHead>P95</TableHead>
                  <TableHead>Average</TableHead>
                  <TableHead>Samples</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">STT Latency</TableCell>
                  <TableCell className="text-biolum-dim">
                    Speech-to-text inference time
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatMetricValue(
                      stats.telemetry.sttLatency.p50,
                      stats.telemetry.sttLatency.unit
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatMetricValue(
                      stats.telemetry.sttLatency.p95,
                      stats.telemetry.sttLatency.unit
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatMetricValue(
                      stats.telemetry.sttLatency.average,
                      stats.telemetry.sttLatency.unit
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-biolum-dim">
                    {stats.telemetry.sttLatency.count}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">TTS Latency</TableCell>
                  <TableCell className="text-biolum-dim">
                    Text-to-speech synthesis time
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatMetricValue(
                      stats.telemetry.ttsLatency.p50,
                      stats.telemetry.ttsLatency.unit
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatMetricValue(
                      stats.telemetry.ttsLatency.p95,
                      stats.telemetry.ttsLatency.unit
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatMetricValue(
                      stats.telemetry.ttsLatency.average,
                      stats.telemetry.ttsLatency.unit
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-biolum-dim">
                    {stats.telemetry.ttsLatency.count}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Round Trip</TableCell>
                  <TableCell className="text-biolum-dim">
                    Client reported RTT
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatMetricValue(
                      stats.telemetry.roundTrip.p50,
                      stats.telemetry.roundTrip.unit
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatMetricValue(
                      stats.telemetry.roundTrip.p95,
                      stats.telemetry.roundTrip.unit
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatMetricValue(
                      stats.telemetry.roundTrip.average,
                      stats.telemetry.roundTrip.unit
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-biolum-dim">
                    {stats.telemetry.roundTrip.count}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BiometricGate() {
  return (
    <Card className="border border-yellow-400/30 bg-yellow-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          <ShieldAlert className="h-5 w-5" />
          Biometric verification required
        </CardTitle>
        <CardDescription>
          Re-authenticate with your passkey (Settings → Security) and retry to
          view voice operations data.
        </CardDescription>
      </CardHeader>
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
      <div className="h-12 w-64 animate-pulse rounded bg-void-surface/50" />
      <div className="h-64 w-full animate-pulse rounded-lg bg-void-surface/30" />
    </div>
  );
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

function isBiometricError(error: unknown): boolean {
  if (!error) {
    return false;
  }
  const maybe = error as {
    data?: { code?: string };
    message?: string;
    code?: string;
  };
  const code = maybe.data?.code ?? maybe.code;
  if (code === "FORBIDDEN" || code === "UNAUTHORIZED") {
    return true;
  }
  if (typeof maybe.message === "string") {
    return maybe.message.includes("biometric");
  }
  return false;
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
