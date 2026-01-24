"use client";

/**
 * Workflow Builder Application - Phase 4 Knowledge & Integration
 *
 * Visual workflow builder for creating executable workflows.
 *
 * Features:
 * - Node canvas (ReactFlow DAG)
 * - Node palette sidebar
 * - Execution panel
 * - Variable inspector
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.6
 */

import { GitBranch, Play, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Button } from "@/components/ui/button";
import { useWorkflowSubscription } from "@/hooks/use-workflow-subscription";
import { cn } from "@/lib/utils";

import { ExecutionPanel } from "../../windows/workflow/execution-panel";
import { NodeCanvas } from "./node-canvas";
import { NodePalette } from "./node-palette";
import { VariableInspector } from "./variable-inspector";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type WorkflowAppProps = {
  windowId?: string;
  className?: string;
  workflowId?: string;
};

export type WorkflowNode = {
  id: string;
  type: "trigger" | "action" | "condition" | "loop";
  name: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function WorkflowApp({
  windowId: _windowId,
  className,
  workflowId: _workflowId,
}: WorkflowAppProps) {
  const [showPalette, setShowPalette] = useState(true);
  const [showExecution, setShowExecution] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  const {
    status,
    steps,
    error,
    run,
    stop,
    clear: _clear,
  } = useWorkflowSubscription({
    onError: (_err) => {},
  });

  const isRunning = status === "connecting" || status === "running";

  const handleRun = () => {
    setShowExecution(true);

    const input = {
      requirement: "Test workflow execution",
      auto: "low" as const,
      mode: "sequential" as const,
    };

    void run(input);
  };

  const handleStop = () => {
    stop();
  };

  const handleClear = () => {
    _clear();
  };

  return (
    <div
      className={cn("flex h-full w-full flex-col bg-void-surface", className)}
      data-app="workflow"
    >
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Workflow Builder</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            className={cn(
              "h-7 gap-1 text-xs",
              showPalette && "bg-biolum/10 text-biolum"
            )}
            onClick={() => setShowPalette(!showPalette)}
            size="sm"
            variant="ghost"
          >
            Palette
          </Button>
          <Button
            className={cn(
              "h-7 gap-1 text-xs",
              showVariables && "bg-biolum/10 text-biolum"
            )}
            onClick={() => setShowVariables(!showVariables)}
            size="sm"
            variant="ghost"
          >
            Variables
          </Button>
          <div className="mx-2 h-4 w-px bg-white/10" />
          <Button className="h-7 gap-1 text-xs" size="sm" variant="ghost">
            <Save className="h-3 w-3" />
            Save
          </Button>
          <Button
            className="h-7 gap-1 text-xs"
            onClick={handleClear}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
          <Button
            className={cn(
              "h-7 gap-1 text-xs",
              isRunning && "bg-green-500/20 text-green-400"
            )}
            disabled={isRunning}
            onClick={handleRun}
            size="sm"
            variant="ghost"
          >
            <Play className="h-3 w-3" />
            {isRunning ? "Running" : "Run"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node Palette */}
        {showPalette && (
          <NodePalette
            className="w-56 flex-shrink-0 border-white/5 border-r"
            onClose={() => setShowPalette(false)}
          />
        )}

        {/* Canvas */}
        <NodeCanvas className="flex-1" />

        {/* Variable Inspector */}
        {showVariables && (
          <VariableInspector
            className="w-64 flex-shrink-0 border-white/5 border-l"
            onClose={() => setShowVariables(false)}
          />
        )}
      </div>

      {/* Execution Panel */}
      {showExecution && (
        <ExecutionPanel
          className="h-48 flex-shrink-0 border-white/5 border-t"
          error={error}
          isRunning={isRunning}
          onClose={() => setShowExecution(false)}
          onStop={handleStop}
          steps={steps}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function WorkflowAppWindow(props: WindowComponentProps) {
  return <WorkflowApp className="h-full" windowId={props.window.id} />;
}

export default WorkflowApp;
