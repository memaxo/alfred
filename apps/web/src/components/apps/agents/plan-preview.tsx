"use client";

/**
 * Plan Preview - Inline plan display
 */

import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type PlanPreviewProps = {
  className?: string;
};

export function PlanPreview({ className }: PlanPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn("bg-void-surface", className)}>
      <button
        className="flex w-full items-center justify-between px-4 py-2 text-left"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-biolum-dim" />
          <span className="font-medium text-sm">Execution Plan</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-biolum-dim text-xs">
            3 subtasks
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-biolum-dim" />
        ) : (
          <ChevronUp className="h-4 w-4 text-biolum-dim" />
        )}
      </button>

      {isExpanded && (
        <div className="border-white/5 border-t px-4 py-3">
          <div className="space-y-2">
            <PlanTask
              description="Implement new chat components"
              status="completed"
              title="1. Create Chat App"
            />
            <PlanTask
              description="Set up Monaco editor with AI suggestions"
              status="running"
              title="2. Build Code Editor"
            />
            <PlanTask
              description="Wave timeline and agent visualization"
              status="pending"
              title="3. Agent Waves UI"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PlanTask({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: "pending" | "running" | "completed";
}) {
  return (
    <div className="flex items-start gap-2">
      <div
        className={cn(
          "mt-1 h-2 w-2 flex-shrink-0 rounded-full",
          status === "completed" && "bg-green-500",
          status === "running" && "animate-pulse bg-biolum",
          status === "pending" && "bg-white/20"
        )}
      />
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-biolum-dim text-xs">{description}</div>
      </div>
    </div>
  );
}
