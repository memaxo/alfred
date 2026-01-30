/**
 * Improvement Insights - AI-generated insights on learning patterns
 */

import {
  AlertCircle,
  Lightbulb,
  Loader2,
  Target,
  TrendingUp,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type InsightType = "pattern" | "improvement" | "concern";

const typeIcons: Record<
  InsightType,
  React.ComponentType<{ className?: string }>
> = {
  pattern: Lightbulb,
  improvement: TrendingUp,
  concern: AlertCircle,
};

const typeColors: Record<InsightType, string> = {
  pattern: "border-purple-500/50 bg-purple-500/10 text-purple-400",
  improvement: "border-green-500/50 bg-green-500/10 text-green-400",
  concern: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
};

export function ImprovementInsights() {
  const { data, isLoading, error } = trpc.cognitive.insightsList.useQuery();

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
        Failed to load insights
      </div>
    );
  }

  const insights = data?.insights ?? [];

  if (insights.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-biolum-dim">
        <div className="text-center">
          <Target className="mx-auto mb-2 h-8 w-8" />
          <p>No insights available yet</p>
          <p className="text-xs">
            Insights will appear as learning patterns emerge
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {insights.map((insight) => {
          const insightType = insight.type as InsightType;
          const Icon = typeIcons[insightType] ?? Lightbulb;
          const colors = typeColors[insightType] ?? typeColors.pattern;

          return (
            <div
              className={cn("rounded-lg border p-4", colors)}
              key={insight.id}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{insight.title}</span>
                </div>
                <span className="text-xs opacity-70">
                  {(insight.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
              <p className="text-sm opacity-80">{insight.description}</p>
              {insight.actionable && (
                <div className="mt-2">
                  <span className="rounded bg-white/10 px-2 py-0.5 text-xs">
                    Actionable
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
