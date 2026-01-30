import {
  Activity,
  CheckCircle2,
  Clock,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { Virtuoso } from "react-virtuoso";

import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

export function RunList() {
  const {
    data: runs,
    isLoading,
    error,
  } = trpc.workflow.listRuns.useQuery({
    limit: 50,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Activity className="h-6 w-6 animate-spin text-biolum" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-400 text-sm italic">
        Failed to load agent runs
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="p-8 text-center text-biolum-dim text-sm italic">
        No recent activity
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-white/5 border-b px-4 py-2 font-medium text-biolum-dim text-xs uppercase tracking-widest">
        <span className="w-8">Status</span>
        <span className="flex-1">Requirement</span>
        <span className="w-24 text-right">Started</span>
        <span className="w-16" />
      </div>
      <div className="flex-1">
        <Virtuoso
          className="h-full"
          data={runs}
          itemContent={(_, run) => <RunRow key={run.id} run={run} />}
        />
      </div>
    </div>
  );
}

type RunStatus =
  | "running"
  | "completed"
  | "failed"
  | "suspended"
  | "cancelled"
  | "pending";

interface Run {
  id: string;
  status: RunStatus;
  requirement?: string | null;
  created: string | null;
  projectId?: string | null;
}

function RunRow({ run }: { run: Run }) {
  const statusConfig = {
    running: { icon: PlayCircle, color: "text-emerald-400", label: "Running" },
    completed: { icon: CheckCircle2, color: "text-blue-400", label: "Done" },
    failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
    suspended: { icon: Clock, color: "text-amber-400", label: "Paused" },
    cancelled: {
      icon: XCircle,
      color: "text-biolum-faint",
      label: "Cancelled",
    },
    pending: { icon: Clock, color: "text-biolum-dim", label: "Pending" },
  };

  const config =
    statusConfig[run.status as keyof typeof statusConfig] ||
    statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className="group flex items-center gap-4 border-white/5 border-b px-4 py-3 transition-colors hover:bg-white/5">
      <div className="flex w-8 justify-center">
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-biolum text-sm">
          {run.requirement}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[10px] text-biolum-dim uppercase tracking-wide opacity-60">
            {run.id.slice(0, 8)}
          </span>
          {run.projectId && (
            <span className="text-[10px] text-emerald-500/60 uppercase tracking-wide">
              {run.projectId.slice(0, 8)}
            </span>
          )}
        </div>
      </div>
      <div className="w-24 text-right text-[10px] text-biolum-dim">
        {run.created ? formatRelativeTime(new Date(run.created)) : "—"}
      </div>
      <div className="flex w-16 justify-end opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          className="h-7 text-[10px]"
          onClick={() => {
            // Open reasoning viewer
          }}
          size="sm"
          variant="ghost"
        >
          Details
        </Button>
      </div>
    </div>
  );
}
