"use client";

/**
 * Variable Inspector - Workflow variable values
 */

import { Variable, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface VariableInspectorProps {
  onClose: () => void;
  className?: string;
}

// Mock variables
const mockVariables = [
  { name: "trigger.timestamp", value: "2026-01-03T09:30:00Z", type: "string" },
  { name: "trigger.source", value: "schedule", type: "string" },
  { name: "fetch.response", value: { status: 200, data: [] }, type: "object" },
  { name: "fetch.duration", value: 250, type: "number" },
  { name: "condition.result", value: true, type: "boolean" },
];

export function VariableInspector({
  onClose,
  className,
}: VariableInspectorProps) {
  return (
    <div className={cn("flex flex-col bg-void", className)}>
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Variable className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Variables</span>
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
        <div className="p-2">
          {mockVariables.map((variable) => (
            <div
              className="mb-2 rounded-lg border border-white/5 bg-void-surface p-2"
              key={variable.name}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-biolum text-xs">
                  {variable.name}
                </span>
                <span className="rounded bg-white/10 px-1 text-biolum-dim text-xs">
                  {variable.type}
                </span>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-void p-2 font-mono text-biolum-dim text-xs">
                {typeof variable.value === "object"
                  ? JSON.stringify(variable.value, null, 2)
                  : String(variable.value)}
              </pre>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
