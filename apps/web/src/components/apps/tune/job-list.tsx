"use client";

/**
 * Job List - Fine-tuning job list with status filters
 */

import { Check, Clock, Loader2, Pause, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TuneJob } from "./index";

type JobListProps = {
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const mockJobs: TuneJob[] = [
  {
    id: "1",
    name: "Code Assistant v2",
    model: "llama-3-8b",
    dataset: "code-instructions-50k",
    status: "running",
    progress: 0.65,
    metrics: { loss: 0.42, accuracy: 0.87 },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "2",
    name: "Reasoning Tuned",
    model: "mistral-7b",
    dataset: "reasoning-chain-10k",
    status: "completed",
    progress: 1.0,
    metrics: { loss: 0.31, accuracy: 0.92 },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
  },
  {
    id: "3",
    name: "Planning Expert",
    model: "qwen-14b",
    dataset: "execplan-examples",
    status: "pending",
    progress: 0,
    metrics: { loss: 0, accuracy: 0 },
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: "4",
    name: "Failed Experiment",
    model: "phi-2",
    dataset: "test-small",
    status: "failed",
    progress: 0.23,
    metrics: { loss: 2.1, accuracy: 0.45 },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
  },
];

const statusIcons = {
  pending: Clock,
  running: Loader2,
  completed: Check,
  failed: X,
  cancelled: Pause,
};

const statusColors = {
  pending: "text-yellow-400",
  running: "text-blue-400",
  completed: "text-green-400",
  failed: "text-red-400",
  cancelled: "text-gray-400",
};

export function JobList({ selectedId, onSelect }: JobListProps) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-4">
        {mockJobs.map((job) => {
          const Icon = statusIcons[job.status];
          const color = statusColors[job.status];

          return (
            <button
              className={cn(
                "w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-colors",
                selectedId === job.id && "border-biolum/50 bg-biolum/10"
              )}
              key={job.id}
              onClick={() => onSelect(job.id)}
              type="button"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="font-medium">{job.name}</div>
                  <div className="text-biolum-dim text-xs">
                    {job.model} • {job.dataset}
                  </div>
                </div>
                <div className={cn("flex items-center gap-1", color)}>
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      job.status === "running" && "animate-spin"
                    )}
                  />
                  <span className="text-xs capitalize">{job.status}</span>
                </div>
              </div>

              {job.status === "running" && (
                <div className="mb-2">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-biolum-dim">Progress</span>
                    <span>{(job.progress * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${job.progress * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {job.status !== "pending" && (
                <div className="flex gap-4 text-xs">
                  <span className="text-biolum-dim">
                    Loss:{" "}
                    <span className="text-biolum">
                      {job.metrics.loss.toFixed(2)}
                    </span>
                  </span>
                  <span className="text-biolum-dim">
                    Acc:{" "}
                    <span className="text-biolum">
                      {(job.metrics.accuracy * 100).toFixed(0)}%
                    </span>
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
