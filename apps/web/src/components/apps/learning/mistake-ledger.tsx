"use client";

/**
 * Mistake Ledger - Chronological list of errors and corrections
 */

import { AlertTriangle, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { LearningEntry } from "./index";

type MistakeLedgerProps = {
  timeRange: "day" | "week" | "month";
};

const mockEntries: LearningEntry[] = [
  {
    id: "1",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    category: "reasoning",
    error:
      "Assumed user wanted code refactoring when they asked about documentation",
    correction: "Ask clarifying questions before assuming intent",
    severity: "medium",
    resolved: true,
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    category: "coding",
    error: "Generated code with TypeScript errors in generic constraints",
    correction: "Validate type constraints before suggesting code",
    severity: "high",
    resolved: true,
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    category: "planning",
    error: "Underestimated task complexity in ExecPlan",
    correction: "Include buffer time for complex tasks",
    severity: "low",
    resolved: false,
  },
  {
    id: "4",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    category: "communication",
    error: "Response was too verbose for a simple question",
    correction: "Match response length to question complexity",
    severity: "low",
    resolved: true,
  },
];

const severityColors = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-red-400",
};

const categoryColors = {
  reasoning: "bg-purple-500/20 text-purple-400",
  coding: "bg-blue-500/20 text-blue-400",
  planning: "bg-orange-500/20 text-orange-400",
  communication: "bg-green-500/20 text-green-400",
};

export function MistakeLedger({ timeRange: _timeRange }: MistakeLedgerProps) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {mockEntries.map((entry) => (
          <div
            className="rounded-lg border border-white/10 bg-white/5 p-3"
            key={entry.id}
          >
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs",
                    categoryColors[entry.category]
                  )}
                >
                  {entry.category}
                </span>
                <span className={cn("text-xs", severityColors[entry.severity])}>
                  {entry.severity}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {entry.resolved ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                )}
                <span className="text-biolum-dim text-xs">
                  {formatTimeAgo(entry.timestamp)}
                </span>
              </div>
            </div>

            <div className="mb-2">
              <div className="mb-1 text-biolum-dim text-xs">Error</div>
              <p className="text-sm">{entry.error}</p>
            </div>

            <div>
              <div className="mb-1 text-biolum-dim text-xs">Correction</div>
              <p className="text-biolum text-sm">{entry.correction}</p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function formatTimeAgo(date: Date): string {
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
