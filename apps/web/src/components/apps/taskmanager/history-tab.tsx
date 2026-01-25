"use client";

/**
 * History Tab - Past agent runs and workflow executions
 */

import {
  Bot,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

import { BiometricGate, isBiometricError } from "@/components/admin/gate";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface HistoryTabProps {
  className?: string;
}

interface HistoryItem {
  id: string;
  type: "agent" | "workflow";
  name: string;
  status: "success" | "failure" | "cancelled";
  startTime: string;
  duration: number;
  tokenUsage?: number;
}

export function HistoryTab({ className }: HistoryTabProps) {
  const { data, isLoading, error, refetch } = trpc.admin.taskHistory.useQuery(
    { limit: 50 },
    {
      retry: false,
    }
  );

  if (isBiometricError(error)) {
    return (
      <div className="p-4">
        <BiometricGate onRetry={() => refetch()} />
      </div>
    );
  }

  const history: HistoryItem[] = data?.history ?? [];

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Summary */}
      <div className="flex items-center gap-6 border-white/5 border-b p-4">
        <div>
          <div className="font-semibold text-2xl">{history.length}</div>
          <div className="text-biolum-dim text-xs">Total Runs</div>
        </div>
        <div>
          <div className="font-semibold text-2xl text-green-400">
            {history.filter((h) => h.status === "success").length}
          </div>
          <div className="text-biolum-dim text-xs">Succeeded</div>
        </div>
        <div>
          <div className="font-semibold text-2xl text-red-400">
            {history.filter((h) => h.status === "failure").length}
          </div>
          <div className="text-biolum-dim text-xs">Failed</div>
        </div>
      </div>

      {/* History list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
            </div>
          )}
          {error && (
            <div className="py-2 text-center text-red-400 text-xs">
              Failed to load history
            </div>
          )}
          {!isLoading && history.length === 0 && !error && (
            <div className="py-4 text-center text-biolum-dim text-sm">
              No history found
            </div>
          )}
          {history.map((item) => (
            <HistoryRow item={item} key={item.id} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const StatusIcon =
    item.status === "success"
      ? CheckCircle
      : (item.status === "failure"
        ? XCircle
        : Clock);
  const statusColors = {
    success: "text-green-400",
    failure: "text-red-400",
    cancelled: "text-yellow-400",
  };

  return (
    <div className="mb-2 rounded-lg border border-white/5 bg-white/5 p-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {item.type === "agent" ? (
            <Bot className="h-4 w-4 text-biolum-dim" />
          ) : (
            <Clock className="h-4 w-4 text-biolum-dim" />
          )}
          <span className="font-medium text-sm">{item.name}</span>
        </div>
        <StatusIcon className={cn("h-4 w-4", statusColors[item.status])} />
      </div>
      <div className="mt-2 flex items-center gap-4 text-biolum-dim text-xs">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(item.startTime).toLocaleTimeString()}
        </span>
        <span>{formatDuration(item.duration)}</span>
        {item.tokenUsage && (
          <span>{(item.tokenUsage / 1000).toFixed(0)}k tokens</span>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}
