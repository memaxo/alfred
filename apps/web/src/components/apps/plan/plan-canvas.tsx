"use client";

/**
 * Plan Canvas - Visual plan step dependencies
 */

import { Check, Circle, Clock, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PlanStep } from "./index";

type PlanCanvasProps = {
  planId: string | null;
};

const mockSteps: PlanStep[] = [
  {
    id: "1",
    name: "Analyze requirements",
    type: "task",
    status: "completed",
    dependencies: [],
  },
  {
    id: "2",
    name: "Create type definitions",
    type: "subtask",
    status: "completed",
    dependencies: ["1"],
  },
  {
    id: "3",
    name: "Implement core logic",
    type: "task",
    status: "running",
    dependencies: ["2"],
    estimate: "2h",
  },
  {
    id: "4",
    name: "Write tests",
    type: "subtask",
    status: "pending",
    dependencies: ["3"],
  },
  {
    id: "5",
    name: "Code review",
    type: "checkpoint",
    status: "pending",
    dependencies: ["3", "4"],
  },
  {
    id: "6",
    name: "Deploy or iterate?",
    type: "decision",
    status: "pending",
    dependencies: ["5"],
  },
];

const statusIcons = {
  pending: Circle,
  running: Loader2,
  completed: Check,
  failed: X,
};

const statusColors = {
  pending: "border-gray-500 text-gray-400",
  running: "border-blue-500 text-blue-400",
  completed: "border-green-500 text-green-400",
  failed: "border-red-500 text-red-400",
};

const typeColors = {
  task: "bg-blue-500/10",
  subtask: "bg-purple-500/10",
  checkpoint: "bg-yellow-500/10",
  decision: "bg-orange-500/10",
};

export function PlanCanvas({ planId }: PlanCanvasProps) {
  if (!planId) {
    return (
      <div className="flex h-full items-center justify-center text-biolum-dim">
        Select a plan to view
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Plan Header */}
      <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3">
        <h3 className="font-medium">Desktop Evolution Phase 8</h3>
        <p className="mt-1 text-biolum-dim text-sm">
          Implement Intelligence & Learning apps for ALFRED desktop.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {mockSteps.map((step, idx) => {
          const Icon = statusIcons[step.status];
          const colors = statusColors[step.status];
          const bgColor = typeColors[step.type];

          return (
            <div
              className={cn(
                "relative rounded-lg border-2 p-3",
                colors,
                bgColor
              )}
              key={step.id}
            >
              {/* Connection line */}
              {idx > 0 && (
                <div className="-top-2 absolute left-6 h-2 w-0.5 bg-white/20" />
              )}

              <div className="flex items-start gap-3">
                <Icon
                  className={cn(
                    "mt-0.5 h-5 w-5",
                    step.status === "running" && "animate-spin"
                  )}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{step.name}</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs capitalize">
                      {step.type}
                    </span>
                  </div>
                  {step.estimate && (
                    <div className="mt-1 flex items-center gap-1 text-biolum-dim text-xs">
                      <Clock className="h-3 w-3" />
                      Est: {step.estimate}
                    </div>
                  )}
                  {step.dependencies.length > 0 && (
                    <div className="mt-1 text-biolum-dim text-xs">
                      Depends on: {step.dependencies.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
