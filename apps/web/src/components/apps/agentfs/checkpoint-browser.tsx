"use client";

/**
 * Checkpoint Browser - Browse and restore checkpoints
 */

import { Archive, Calendar, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type CheckpointBrowserProps = {
  workspaceId: string;
  className?: string;
};

type Checkpoint = {
  id: string;
  name: string;
  createdAt: Date;
  fileCount: number;
  size: number;
  isAutomatic: boolean;
};

// Mock checkpoints
const mockCheckpoints: Checkpoint[] = [
  {
    id: "cp-3",
    name: "pre-commit",
    createdAt: new Date(Date.now() - 300_000),
    fileCount: 45,
    size: 128_000,
    isAutomatic: false,
  },
  {
    id: "cp-2",
    name: "auto-save",
    createdAt: new Date(Date.now() - 900_000),
    fileCount: 42,
    size: 120_000,
    isAutomatic: true,
  },
  {
    id: "cp-1",
    name: "initial",
    createdAt: new Date(Date.now() - 1_800_000),
    fileCount: 30,
    size: 95_000,
    isAutomatic: true,
  },
];

export function CheckpointBrowser({
  workspaceId: _workspaceId,
  className,
}: CheckpointBrowserProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex h-9 items-center justify-between border-white/5 border-b px-3">
        <span className="font-medium text-biolum-dim text-xs">
          {mockCheckpoints.length} checkpoints
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {mockCheckpoints.map((checkpoint) => (
            <CheckpointCard checkpoint={checkpoint} key={checkpoint.id} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function CheckpointCard({ checkpoint }: { checkpoint: Checkpoint }) {
  return (
    <div className="mb-2 rounded-lg border border-white/5 bg-white/5 p-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-biolum-dim" />
          <div>
            <span className="font-medium text-sm">{checkpoint.name}</span>
            {checkpoint.isAutomatic && (
              <span className="ml-2 rounded bg-white/10 px-1 text-biolum-dim text-xs">
                auto
              </span>
            )}
          </div>
        </div>
        <Button className="h-7 gap-1 text-xs" size="sm" variant="outline">
          <RotateCcw className="h-3 w-3" />
          Restore
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-4 text-biolum-dim text-xs">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {checkpoint.createdAt.toLocaleTimeString()}
        </span>
        <span>{checkpoint.fileCount} files</span>
        <span>{formatBytes(checkpoint.size)}</span>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
