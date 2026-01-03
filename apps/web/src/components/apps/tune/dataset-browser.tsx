"use client";

/**
 * Dataset Browser - Browse training datasets
 */

import { Database, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type Dataset = {
  id: string;
  name: string;
  description: string;
  samples: number;
  size: string;
  format: "jsonl" | "parquet" | "csv";
  createdAt: Date;
};

const mockDatasets: Dataset[] = [
  {
    id: "1",
    name: "code-instructions-50k",
    description: "Code generation instruction pairs",
    samples: 50_000,
    size: "128 MB",
    format: "jsonl",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
  },
  {
    id: "2",
    name: "reasoning-chain-10k",
    description: "Multi-step reasoning examples",
    samples: 10_000,
    size: "45 MB",
    format: "jsonl",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
  },
  {
    id: "3",
    name: "execplan-examples",
    description: "ExecPlan generation and validation",
    samples: 5000,
    size: "22 MB",
    format: "parquet",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
  },
  {
    id: "4",
    name: "conversation-pairs",
    description: "Multi-turn conversation examples",
    samples: 25_000,
    size: "89 MB",
    format: "jsonl",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  },
];

export function DatasetBrowser() {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {mockDatasets.map((dataset) => (
          <div
            className="rounded-lg border border-white/10 bg-white/5 p-3"
            key={dataset.id}
          >
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-biolum" />
                <span className="font-medium">{dataset.name}</span>
              </div>
              <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs">
                {dataset.format}
              </span>
            </div>

            <p className="mb-2 text-biolum-dim text-sm">
              {dataset.description}
            </p>

            <div className="mb-3 flex gap-4 text-xs">
              <span className="text-biolum-dim">
                Samples:{" "}
                <span className="text-biolum">
                  {dataset.samples.toLocaleString()}
                </span>
              </span>
              <span className="text-biolum-dim">
                Size: <span className="text-biolum">{dataset.size}</span>
              </span>
            </div>

            <div className="flex gap-2">
              <Button className="h-7 gap-1" size="sm" variant="outline">
                <Eye className="h-3 w-3" />
                Preview
              </Button>
              <Button className="h-7 gap-1" size="sm" variant="outline">
                <FileText className="h-3 w-3" />
                Details
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
