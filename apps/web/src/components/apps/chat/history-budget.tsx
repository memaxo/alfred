/**
 * History Budget Panel - Visualize conversation history token usage
 *
 * Shows how much of the context window is used by history,
 * with controls to adjust the budget allocation.
 *
 * @see @alfred/history package
 */

import type { UIMessage } from "@alfred/type/stream";

import { type BudgetSegment, computeBudgetUsage } from "@alfred/history/budget";
import { Clock, Settings2, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useBudgetStatus } from "@/hooks/use-budget-status";
import { cn } from "@/lib/utils";

interface HistoryBudgetProps {
  className?: string;
  messages?: readonly UIMessage[];
  conversationId?: string | null;
  onClearHistory?: () => void;
}

const SEGMENT_COLORS: Record<BudgetSegment, string> = {
  system: "bg-blue-500",
  user: "bg-orange-500",
  assistant: "bg-purple-500",
};

const SEGMENT_LABELS: Record<BudgetSegment, string> = {
  system: "System",
  user: "User",
  assistant: "Assistant",
};

export function HistoryBudget({
  className,
  messages = [],
  conversationId,
  onClearHistory,
}: HistoryBudgetProps) {
  // Fetch budget status for cost tracking
  const budgetStatus = useBudgetStatus(conversationId ?? null);

  // Compute budget usage from messages
  const budgetUsage = useMemo(
    () => computeBudgetUsage(messages, 128_000),
    [messages]
  );

  const usagePercent = budgetUsage.usagePercentage;

  // Find oldest message timestamp
  const oldestMessage = useMemo(() => {
    if (messages.length === 0) {
      return null;
    }
    const oldest = messages[0];
    if (oldest && "createdAt" in oldest && oldest.createdAt) {
      return new Date(oldest.createdAt as string | number);
    }
    return null;
  }, [messages]);

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
            {budgetUsage.total.toLocaleString()} /{" "}
            {budgetUsage.maxBudget.toLocaleString()} tokens
          </span>
          <span
            className={cn(usagePercent > 80 ? "text-red-400" : "text-biolum")}
          >
            {usagePercent.toFixed(0)}%
          </span>
        </div>
        <div className="flex h-2 gap-0.5 rounded-full bg-white/10">
          {budgetUsage.breakdown.map((segment) => (
            <div
              className={cn(
                "h-full first:rounded-l-full last:rounded-r-full",
                SEGMENT_COLORS[segment.segment]
              )}
              key={segment.segment}
              style={{
                width: `${(segment.tokens / budgetUsage.maxBudget) * 100}%`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Segment Legend */}
      <div className="mb-3 flex flex-wrap gap-3">
        {budgetUsage.breakdown.map((segment) => (
          <div className="flex items-center gap-1" key={segment.segment}>
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                SEGMENT_COLORS[segment.segment]
              )}
            />
            <span className="text-biolum-dim text-xs">
              {SEGMENT_LABELS[segment.segment]}:{" "}
              {segment.tokens.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div>
          <span className="text-biolum-dim">Messages:</span>{" "}
          <span className="text-biolum">{messages.length}</span>
        </div>
        {oldestMessage && (
          <div>
            <span className="text-biolum-dim">Oldest:</span>{" "}
            <span className="text-biolum">{formatTimeAgo(oldestMessage)}</span>
          </div>
        )}
        {budgetStatus.data && (
          <div>
            <span className="text-biolum-dim">Cost:</span>{" "}
            <span
              className={cn(
                budgetStatus.data.status === "exceeded"
                  ? "text-red-400"
                  : budgetStatus.data.status === "critical"
                    ? "text-orange-400"
                    : budgetStatus.data.status === "warning"
                      ? "text-yellow-400"
                      : "text-biolum"
              )}
            >
              ${budgetStatus.data.usedUsd.toFixed(4)} / $
              {budgetStatus.data.budgetUsd === Infinity
                ? "∞"
                : budgetStatus.data.budgetUsd.toFixed(2)}
              {budgetStatus.data.budgetUsd !== Infinity && (
                <> ({budgetStatus.data.percentUsed.toFixed(1)}%)</>
              )}
            </span>
          </div>
        )}
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
