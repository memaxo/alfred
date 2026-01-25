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
    <fieldset
      aria-label="Agent controls"
      className={cn("flex items-center gap-2", className)}
    >
      <div className="flex rounded-lg border bg-muted p-1" role="tablist">
        <Button
          aria-controls="assistant-panel"
          aria-selected={agent === "assistant"}
          onClick={() => onAgentChange("assistant")}
          role="tab"
          size="sm"
          variant={agent === "assistant" ? "default" : "ghost"}
        >
          Assistant
        </Button>
        <Button
          aria-controls="orchestrator-panel"
          aria-selected={agent === "orchestrator"}
          onClick={() => onAgentChange("orchestrator")}
          role="tab"
          size="sm"
          variant={agent === "orchestrator" ? "default" : "ghost"}
        >
          Orchestrator
        </Button>
      </div>
      {onClear && (
        <Button
          aria-label="Clear conversation"
          onClick={onClear}
          size="sm"
          variant="outline"
        >
          Clear
        </Button>
      )}
    </fieldset>
  );
}
