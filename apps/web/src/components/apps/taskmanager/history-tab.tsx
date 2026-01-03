"use client";

/**
 * History Tab - Past agent runs and workflow executions
 */

import { Bot, Calendar, CheckCircle, Clock, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type HistoryTabProps = {
  className?: string;
};

type HistoryItem = {
  id: string;
  type: "agent" | "workflow";
  name: string;
  status: "success" | "failure" | "cancelled";
  startTime: Date;
  duration: number;
  tokenUsage?: number;
};

// Mock history
const mockHistory: HistoryItem[] = [
  {
    id: "1",
    type: "agent",
    name: "Phase 2 Implementation",
    status: "success",
    startTime: new Date(Date.now() - 1_800_000),
    duration: 1200,
    tokenUsage: 45_000,
  },
  {
    id: "2",
    type: "workflow",
    name: "CI Pipeline #412",
    status: "success",
    startTime: new Date(Date.now() - 3_600_000),
    duration: 180,
  },
  {
    id: "3",
    type: "agent",
    name: "Phase 1 Shell Components",
    status: "success",
    startTime: new Date(Date.now() - 7_200_000),
    duration: 900,
    tokenUsage: 32_000,
  },
  {
    id: "4",
    type: "agent",
    name: "Voice Router Fix",
    status: "failure",
    startTime: new Date(Date.now() - 10_800_000),
    duration: 300,
    tokenUsage: 8000,
  },
  {
    id: "5",
    type: "workflow",
    name: "Deploy Preview",
    status: "cancelled",
    startTime: new Date(Date.now() - 14_400_000),
    duration: 60,
  },
];

export function HistoryTab({ className }: HistoryTabProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {/* Summary */}
      <div className="flex items-center gap-6 border-white/5 border-b p-4">
        <div>
          <div className="font-semibold text-2xl">{mockHistory.length}</div>
          <div className="text-biolum-dim text-xs">Total Runs</div>
        </div>
        <div>
          <div className="font-semibold text-2xl text-green-400">
            {mockHistory.filter((h) => h.status === "success").length}
          </div>
          <div className="text-biolum-dim text-xs">Succeeded</div>
        </div>
        <div>
          <div className="font-semibold text-2xl text-red-400">
            {mockHistory.filter((h) => h.status === "failure").length}
          </div>
          <div className="text-biolum-dim text-xs">Failed</div>
        </div>
      </div>

      {/* History list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {mockHistory.map((item) => (
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
      : item.status === "failure"
        ? XCircle
        : Clock;
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
          {item.startTime.toLocaleTimeString()}
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
