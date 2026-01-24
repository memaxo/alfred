"use client";

/**
 * Insight Panel - AI-generated insights from knowledge graph
 */

import { Brain, Lightbulb, Loader2, TrendingUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type InsightPanelProps = {
  onClose: () => void;
  className?: string;
};

const typeIcons = {
  pattern: Brain,
  trend: TrendingUp,
  suggestion: Lightbulb,
};

export function InsightPanel({ onClose, className }: InsightPanelProps) {
  const { data, isLoading, error } = trpc.knowledge.insightsList.useQuery({
    resource: "default",
    limit: 10,
  });

  const insights = data?.insights ?? [];

  return (
    <div className={cn("flex flex-col bg-void-surface", className)}>
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-400" />
          <span className="font-medium text-sm">Insights</span>
        </div>
        <Button
          className="h-6 w-6"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
            </div>
          )}
          {error && (
            <div className="py-2 text-center text-red-400 text-xs">
              Failed to load insights
            </div>
          )}
          {!isLoading && insights.length === 0 && !error && (
            <div className="py-4 text-center text-biolum-dim text-sm">
              No insights available
            </div>
          )}
          {insights.map((insight) => {
            const Icon =
              typeIcons[insight.type as keyof typeof typeIcons] ?? Lightbulb;
            return (
              <div
                className="mb-2 rounded-lg border border-white/5 bg-white/5 p-3"
                key={insight.id}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-yellow-400" />
                  <span className="font-medium text-sm">{insight.title}</span>
                </div>
                <p className="text-biolum-dim text-xs">{insight.description}</p>
                <div className="mt-2 text-biolum-faint text-xs">
                  Confidence: {(insight.confidence * 100).toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
