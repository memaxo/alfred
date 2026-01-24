"use client";

/**
 * Execution Panel - Workflow run status and logs
 */

import { CheckCircle, Loader2, Square, X, XCircle } from "lucide-react";

import type {
  WorkflowEscalation,
  WorkflowStep,
} from "@/hooks/use-workflow-subscription";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ExecutionPanelProps = {
  isRunning: boolean;
  onClose: () => void;
  onStop?: () => void;
  steps: WorkflowStep[];
  error: Error | null;
  escalation?: WorkflowEscalation | null;
  className?: string;
};

export function ExecutionPanel({
  isRunning,
  onClose,
  onStop,
  steps,
  error,
  escalation,
  className,
}: ExecutionPanelProps) {
  return (
    <div className={cn("flex flex-col bg-void-surface", className)}>
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin text-biolum" />
          ) : error ? (
            <XCircle className="h-4 w-4 text-red-400" />
          ) : escalation ? (
            <XCircle className="h-4 w-4 text-amber-400" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-400" />
          )}
          <span className="font-medium text-sm">
            {isRunning
              ? "Running..."
              : error
                ? "Failed"
                : escalation
                  ? "Escalated"
                  : "Completed"}
          </span>
          {error && (
            <span className="ml-2 text-red-400 text-xs">{error.message}</span>
          )}
          {escalation && !error && (
            <span className="ml-2 text-amber-300 text-xs">
              {escalation.reason}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isRunning && onStop && (
            <Button
              className="h-6 w-6"
              onClick={onStop}
              size="icon"
              variant="ghost"
            >
              <Square className="h-3 w-3" />
            </Button>
          )}
          <Button
            className="h-6 w-6"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Steps */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-4">
          {escalation && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-amber-100">
              <div className="font-medium text-sm">Escalation details</div>
              <div className="mt-1 whitespace-pre-wrap text-xs">
                {escalation.details}
              </div>
              {escalation.suggestions && escalation.suggestions.length > 0 && (
                <div className="mt-2 text-xs">
                  <div className="font-medium">Suggestions</div>
                  <ul className="mt-1 list-inside list-disc">
                    {escalation.suggestions.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-4">
            {steps.map((step, idx) => (
              <div className="flex items-center gap-2" key={step.id}>
                <StepIcon status={step.status} />
                <div>
                  <div className="text-sm">{step.name}</div>
                  {step.status === "completed" && step.duration && (
                    <div className="text-biolum-dim text-xs">
                      {step.duration}ms
                    </div>
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div className="h-px w-8 bg-white/20" />
                )}
              </div>
            ))}
            {steps.length === 0 && !error && (
              <div className="text-biolum-faint text-sm">
                No steps yet. Click Run to start workflow.
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function StepIcon({ status }: { status: WorkflowStep["status"] }) {
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
