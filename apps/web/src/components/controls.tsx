/**
 * Controls Component
 * 
 * Adapted from ai-sdk.dev/elements/components/controls
 * Provides agent controls and switcher
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ControlsProps {
  agent: "assistant" | "orchestrator";
  onAgentChange: (agent: "assistant" | "orchestrator") => void;
  onClear?: () => void;
  className?: string;
}

export function Controls({
  agent,
  onAgentChange,
  onClear,
  className,
}: ControlsProps) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="group"
      aria-label="Agent controls"
    >
      <div className="flex rounded-lg border bg-muted p-1" role="tablist">
        <Button
          variant={agent === "assistant" ? "default" : "ghost"}
          size="sm"
          onClick={() => onAgentChange("assistant")}
          role="tab"
          aria-selected={agent === "assistant"}
          aria-controls="assistant-panel"
        >
          Assistant
        </Button>
        <Button
          variant={agent === "orchestrator" ? "default" : "ghost"}
          size="sm"
          onClick={() => onAgentChange("orchestrator")}
          role="tab"
          aria-selected={agent === "orchestrator"}
          aria-controls="orchestrator-panel"
        >
          Orchestrator
        </Button>
      </div>
      {onClear && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          aria-label="Clear conversation"
        >
          Clear
        </Button>
      )}
    </div>
  );
}

