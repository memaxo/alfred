"use client";

/**
 * History Budget Panel - Visualize conversation history token usage
 *
 * Shows how much of the context window is used by history,
 * with controls to adjust the budget allocation.
 *
 * @see @alfred/history package
 */

import { Clock, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HistoryBudgetProps = {
  className?: string;
  onClearHistory?: () => void;
};

type BudgetSegment = {
  label: string;
  tokens: number;
  color: string;
};

// Mock data - would come from @alfred/history
const mockBudget = {
  total: 128_000,
  used: 45_000,
  segments: [
    { label: "System", tokens: 2000, color: "bg-blue-500" },
    { label: "History", tokens: 28_000, color: "bg-purple-500" },
    { label: "RAG Context", tokens: 10_000, color: "bg-green-500" },
    { label: "User Message", tokens: 5000, color: "bg-orange-500" },
  ] as BudgetSegment[],
  messageCount: 24,
  oldestMessage: new Date(Date.now() - 1000 * 60 * 60 * 2),
};

export function HistoryBudget({
  className,
  onClearHistory,
}: HistoryBudgetProps) {
  const usagePercent = (mockBudget.used / mockBudget.total) * 100;

  return (
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-white/5 p-3",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">History Budget</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            className="h-6 w-6"
            onClick={onClearHistory}
            size="icon"
            variant="ghost"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button className="h-6 w-6" size="icon" variant="ghost">
            <Settings2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Usage Bar */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-biolum-dim">
            {mockBudget.used.toLocaleString()} /{" "}
            {mockBudget.total.toLocaleString()} tokens
          </span>
          <span
            className={cn(usagePercent > 80 ? "text-red-400" : "text-biolum")}
          >
            {usagePercent.toFixed(0)}%
          </span>
        </div>
        <div className="flex h-2 gap-0.5 rounded-full bg-white/10">
          {mockBudget.segments.map((segment) => (
            <div
              className={cn(
                "h-full first:rounded-l-full last:rounded-r-full",
                segment.color
              )}
              key={segment.label}
              style={{ width: `${(segment.tokens / mockBudget.total) * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* Segment Legend */}
      <div className="mb-3 flex flex-wrap gap-3">
        {mockBudget.segments.map((segment) => (
          <div className="flex items-center gap-1" key={segment.label}>
            <div className={cn("h-2 w-2 rounded-full", segment.color)} />
            <span className="text-biolum-dim text-xs">
              {segment.label}: {segment.tokens.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs">
        <div>
          <span className="text-biolum-dim">Messages:</span>{" "}
          <span className="text-biolum">{mockBudget.messageCount}</span>
        </div>
        <div>
          <span className="text-biolum-dim">Oldest:</span>{" "}
          <span className="text-biolum">
            {formatTimeAgo(mockBudget.oldestMessage)}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return `${Math.floor(minutes / 60)}h ago`;
}
