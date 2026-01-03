"use client";

/**
 * Execution Panel - Workflow run status and logs
 */

import { CheckCircle, Loader2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ExecutionPanelProps = {
  isRunning: boolean;
  onClose: () => void;
  className?: string;
};

// Mock execution steps
const mockSteps = [
  { id: "1", name: "On Schedule", status: "completed", duration: 5 },
  { id: "2", name: "Fetch Data", status: "completed", duration: 250 },
  { id: "3", name: "Check Status", status: "running", duration: 0 },
  { id: "4", name: "Send Alert", status: "pending" },
];

export function ExecutionPanel({
  isRunning,
  onClose,
  className,
}: ExecutionPanelProps) {
  return (
    <div className={cn("flex flex-col bg-void-surface", className)}>
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin text-biolum" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-400" />
          )}
          <span className="font-medium text-sm">
            {isRunning ? "Running..." : "Completed"}
          </span>
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

      {/* Steps */}
      <ScrollArea className="flex-1">
        <div className="flex items-center gap-4 p-4">
          {mockSteps.map((step, idx) => (
            <div className="flex items-center gap-2" key={step.id}>
              <StepIcon status={step.status} />
              <div>
                <div className="text-sm">{step.name}</div>
                {step.status === "completed" && (
                  <div className="text-biolum-dim text-xs">
                    {step.duration}ms
                  </div>
                )}
              </div>
              {idx < mockSteps.length - 1 && (
                <div className="h-px w-8 bg-white/20" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function StepIcon({ status }: { status: string }) {
  if (status === "completed") {
    return <CheckCircle className="h-5 w-5 text-green-400" />;
  }
  if (status === "running") {
    return <Loader2 className="h-5 w-5 animate-spin text-biolum" />;
  }
  if (status === "failed") {
    return <XCircle className="h-5 w-5 text-red-400" />;
  }
  return <div className="h-5 w-5 rounded-full border-2 border-white/20" />;
}
