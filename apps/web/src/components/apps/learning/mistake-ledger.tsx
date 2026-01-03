"use client";

/**
 * Mistake Ledger - Chronological list of errors and corrections
 */

import { AlertTriangle, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type MistakeLedgerProps = {
  timeRange: "day" | "week" | "month";
};

// Compute time filter based on range
function getTimeFilter(range: "day" | "week" | "month"): string | undefined {
  const now = new Date();
  switch (range) {
    case "day":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "month":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return;
  }
}

const categoryColors: Record<string, string> = {
  reasoning: "bg-purple-500/20 text-purple-400",
  coding: "bg-blue-500/20 text-blue-400",
  planning: "bg-orange-500/20 text-orange-400",
  communication: "bg-green-500/20 text-green-400",
  uncategorized: "bg-gray-500/20 text-gray-400",
};

export function MistakeLedger({ timeRange }: MistakeLedgerProps) {
  const since = getTimeFilter(timeRange);
  const { data, isLoading, error } = trpc.cognitive.feedbackList.useQuery({
    limit: 50,
    since,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-biolum-dim" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        Failed to load feedback history
      </div>
    );
  }

  const entries = data?.entries ?? [];

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-biolum-dim">
        No feedback entries in this time range
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {entries.map((entry) => (
          <div
            className="rounded-lg border border-white/10 bg-white/5 p-3"
            key={entry.id}
          >
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs",
                    categoryColors[entry.category] ??
                      categoryColors.uncategorized
                  )}
                >
                  {entry.category}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                <span className="text-biolum-dim text-xs">
                  {formatTimeAgo(entry.timestamp)}
                </span>
              </div>
            </div>

            <div className="mb-2">
              <div className="mb-1 text-biolum-dim text-xs">Cause</div>
              <p className="text-sm">{entry.cause}</p>
            </div>

            <div>
              <div className="mb-1 text-biolum-dim text-xs">Effect</div>
              <p className="text-biolum text-sm">{entry.effect}</p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
