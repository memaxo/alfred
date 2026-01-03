"use client";

/**
 * Insight Panel - AI-generated insights from knowledge graph
 */

import { Brain, Lightbulb, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type InsightPanelProps = {
  onClose: () => void;
  className?: string;
};

// Mock insights
const mockInsights = [
  {
    id: "1",
    type: "pattern",
    title: "Emerging cluster",
    description:
      "Desktop Shell, Window Manager, and Tiling form a densely connected cluster.",
    confidence: 0.87,
  },
  {
    id: "2",
    type: "trend",
    title: "Growing topic",
    description: "ReactFlow mentions increased 40% in the last week.",
    confidence: 0.82,
  },
  {
    id: "3",
    type: "suggestion",
    title: "Missing link",
    description:
      "Consider connecting ALFRED to Voice interface—related context detected.",
    confidence: 0.75,
  },
];

const typeIcons = {
  pattern: Brain,
  trend: TrendingUp,
  suggestion: Lightbulb,
};

export function InsightPanel({ onClose, className }: InsightPanelProps) {
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
          {mockInsights.map((insight) => {
            const Icon = typeIcons[insight.type as keyof typeof typeIcons];
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
