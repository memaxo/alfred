"use client";

/**
 * Improvement Insights - AI-generated insights on learning patterns
 */

import { AlertCircle, Lightbulb, Target, TrendingUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Insight = {
  id: string;
  type: "pattern" | "improvement" | "goal" | "warning";
  title: string;
  description: string;
  confidence: number;
};

const mockInsights: Insight[] = [
  {
    id: "1",
    type: "improvement",
    title: "Coding accuracy improved 10%",
    description:
      "Your TypeScript code suggestions have significantly improved after learning from generic constraint errors.",
    confidence: 0.92,
  },
  {
    id: "2",
    type: "pattern",
    title: "Common error pattern detected",
    description:
      "Tendency to provide verbose responses to simple questions. Consider matching response length to question complexity.",
    confidence: 0.87,
  },
  {
    id: "3",
    type: "goal",
    title: "Goal: 95% reasoning accuracy",
    description:
      "Currently at 92%. Continue practicing clarifying questions before making assumptions.",
    confidence: 0.95,
  },
  {
    id: "4",
    type: "warning",
    title: "Planning estimates need calibration",
    description:
      "Task complexity estimates have been off by 20-30%. Consider adding buffer time for complex tasks.",
    confidence: 0.78,
  },
];

const typeIcons = {
  pattern: Lightbulb,
  improvement: TrendingUp,
  goal: Target,
  warning: AlertCircle,
};

const typeColors = {
  pattern: "border-purple-500/50 bg-purple-500/10 text-purple-400",
  improvement: "border-green-500/50 bg-green-500/10 text-green-400",
  goal: "border-blue-500/50 bg-blue-500/10 text-blue-400",
  warning: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
};

export function ImprovementInsights() {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {mockInsights.map((insight) => {
          const Icon = typeIcons[insight.type];
          const colors = typeColors[insight.type];

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
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
