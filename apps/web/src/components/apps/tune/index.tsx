"use client";

/**
 * Tune Manager - Fine-tuning jobs and model management
 *
 * Monitor and manage fine-tuning jobs, training progress, datasets,
 * and model comparisons.
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 8.4
 */

import { BarChart3, Database, Play, Settings, Wand2 } from "lucide-react";
import { useState } from "react";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DatasetBrowser } from "./dataset-browser";
import { JobList } from "./job-list";
import { ModelComparison } from "./model-comparison";
import { TrainingProgress } from "./training-progress";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type TuneJob = {
  id: string;
  name: string;
  model: string;
  dataset: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  metrics: { loss: number; accuracy: number };
  createdAt: Date;
  completedAt?: Date;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function TuneApp({ window: _window }: WindowComponentProps) {
  const [tab, setTab] = useState<"jobs" | "progress" | "datasets" | "compare">(
    "jobs"
  );
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col bg-void">
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Tune Manager</span>
        </div>

        <div className="flex items-center gap-1">
          <Button className="h-7 gap-1" size="sm" variant="ghost">
            <Play className="h-3 w-3" />
            New Job
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-white/5 border-b">
        {[
          { id: "jobs", icon: Play, label: "Jobs" },
          { id: "progress", icon: BarChart3, label: "Progress" },
          { id: "datasets", icon: Database, label: "Datasets" },
          { id: "compare", icon: Settings, label: "Compare" },
        ].map((t) => (
          <button
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm transition-colors",
              tab === t.id
                ? "border-biolum border-b-2 text-biolum"
                : "text-biolum-dim hover:text-biolum"
            )}
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            type="button"
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === "jobs" && (
          <JobList onSelect={setSelectedJobId} selectedId={selectedJobId} />
        )}
        {tab === "progress" && <TrainingProgress jobId={selectedJobId} />}
        {tab === "datasets" && <DatasetBrowser />}
        {tab === "compare" && <ModelComparison />}
      </div>
    </div>
  );
}

export function TuneAppWindow(props: WindowComponentProps) {
  return <TuneApp {...props} />;
}
