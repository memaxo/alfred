import { createFileRoute } from "@tanstack/react-router";
import { Activity, RefreshCw, Server, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/admin/voice")({
  component: VoiceAdmin,
});

function VoiceAdmin() {
  const utils = trpc.useUtils();
  const { data: stats, isLoading } = trpc.admin.getVoiceStats.useQuery(
    undefined,
    {
      refetchInterval: 2000,
    }
  );

  const restartMutation = trpc.admin.restartVoicePool.useMutation({
    onSuccess: () => {
      utils.admin.getVoiceStats.invalidate();
    },
  });

  const handleRestart = (pool: "stt" | "tts") => {
    if (confirm(`Are you sure you want to restart the ${pool.toUpperCase()} pool?`)) {
      restartMutation.mutate({ pool });
    }
  };

  if (isLoading) {
    return <div>Loading stats...</div>;
  }

  if (!stats) {
    return <div>No stats available</div>;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          icon={<Activity className="h-5 w-5 text-blue-400" />}
          label="Active Sessions"
          value={stats.activeSessions}
        />
        <StatCard
          icon={<Zap className="h-5 w-5 text-yellow-400" />}
          label="STT Usage"
          value={`${stats.sttPool?.active ?? 0} / ${stats.sttPool?.size ?? 0}`}
        />
        <StatCard
          icon={<Server className="h-5 w-5 text-green-400" />}
          label="TTS Usage"
          value={`${stats.ttsPool?.active ?? 0} / ${stats.ttsPool?.size ?? 0}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <PoolStatus
          title="STT Pool (Speech-to-Text)"
          pool={stats.sttPool}
          onRestart={() => handleRestart("stt")}
          isRestarting={restartMutation.isPending && restartMutation.variables?.pool === "stt"}
        />
        <PoolStatus
          title="TTS Pool (Text-to-Speech)"
          pool={stats.ttsPool}
          onRestart={() => handleRestart("tts")}
          isRestarting={restartMutation.isPending && restartMutation.variables?.pool === "tts"}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
      <div className="rounded-full bg-white/5 p-3">{icon}</div>
      <div>
        <p className="text-biolum-dim text-sm">{label}</p>
        <p className="font-bold text-2xl text-biolum">{value}</p>
      </div>
    </div>
  );
}

function PoolStatus({
  title,
  pool,
  onRestart,
  isRestarting,
}: {
  title: string;
  pool: any;
  onRestart: () => void;
  isRestarting: boolean;
}) {
  if (!pool) {
    return (
      <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6">
        <h3 className="mb-4 font-semibold text-lg">{title}</h3>
        <p className="text-biolum-dim">Pool not initialized (Cloud mode?)</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-6 backdrop-blur-xl">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-semibold text-lg">{title}</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onRestart}
          disabled={isRestarting}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRestarting ? "animate-spin" : ""}`} />
          Restart Pool
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {pool.health.map((proc: any, i: number) => (
          <div
            key={i}
            className={`relative overflow-hidden rounded-xl border p-4 transition-all ${
              proc.isHealthy
                ? "border-green-500/20 bg-green-500/5"
                : "border-red-500/20 bg-red-500/5"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs opacity-70">Process #{i + 1}</span>
              <div
                className={`h-2 w-2 rounded-full ${
                  proc.isHealthy ? "bg-green-500" : "bg-red-500"
                }`}
              />
            </div>
            
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-biolum-dim">Requests</span>
                <span className="font-mono">{proc.requestCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-biolum-dim">Errors</span>
                <span className={`font-mono ${proc.errorCount > 0 ? "text-red-400" : ""}`}>
                  {proc.errorCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-biolum-dim">Uptime</span>
                <span className="font-mono">{formatUptime(proc.uptime)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
