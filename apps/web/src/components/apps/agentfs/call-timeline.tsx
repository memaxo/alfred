"use client";

/**
 * Call Timeline - Chronological operation history
 */

import { File, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type CallTimelineProps = {
  workspaceId: string;
  className?: string;
};

type Operation = {
  id: string;
  type: "read" | "write" | "delete" | "mkdir";
  path: string;
  timestamp: Date;
  duration: number;
  bytesAffected?: number;
};

// Mock operations
const mockOperations: Operation[] = [
  {
    id: "1",
    type: "read",
    path: "/workspace/src/index.ts",
    timestamp: new Date(Date.now() - 60_000),
    duration: 5,
  },
  {
    id: "2",
    type: "write",
    path: "/workspace/src/shell.tsx",
    timestamp: new Date(Date.now() - 55_000),
    duration: 12,
    bytesAffected: 1500,
  },
  {
    id: "3",
    type: "mkdir",
    path: "/workspace/src/components/desktop",
    timestamp: new Date(Date.now() - 50_000),
    duration: 2,
  },
  {
    id: "4",
    type: "write",
    path: "/workspace/src/components/desktop/menubar.tsx",
    timestamp: new Date(Date.now() - 45_000),
    duration: 18,
    bytesAffected: 2800,
  },
  {
    id: "5",
    type: "read",
    path: "/workspace/package.json",
    timestamp: new Date(Date.now() - 40_000),
    duration: 3,
  },
  {
    id: "6",
    type: "delete",
    path: "/workspace/src/old-component.tsx",
    timestamp: new Date(Date.now() - 35_000),
    duration: 1,
  },
];

const typeIcons = {
  read: File,
  write: Pencil,
  delete: Trash2,
  mkdir: FolderPlus,
};

const typeColors = {
  read: "text-blue-400",
  write: "text-green-400",
  delete: "text-red-400",
  mkdir: "text-purple-400",
};

export function CallTimeline({
  workspaceId: _workspaceId,
  className,
}: CallTimelineProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex h-9 items-center justify-between border-white/5 border-b px-3">
        <span className="font-medium text-biolum-dim text-xs">
          {mockOperations.length} operations
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Timeline */}
          <div className="relative border-biolum/20 border-l pl-6">
            {mockOperations.map((op) => {
              const Icon = typeIcons[op.type];
              return (
                <div className="relative mb-4" key={op.id}>
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "-left-[25px] absolute flex h-4 w-4 items-center justify-center rounded-full bg-void",
                      typeColors[op.type]
                    )}
                  >
                    <div className="h-2 w-2 rounded-full bg-current" />
                  </div>

                  {/* Operation card */}
                  <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", typeColors[op.type])} />
                      <span className="font-medium text-sm capitalize">
                        {op.type}
                      </span>
                      <span className="text-biolum-dim text-xs">
                        {op.duration}ms
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-biolum-dim text-xs">
                      {op.path}
                    </p>
                    {op.bytesAffected && (
                      <p className="mt-1 text-biolum-faint text-xs">
                        {op.bytesAffected} bytes
                      </p>
                    )}
                    <p className="mt-1 text-biolum-faint text-xs">
                      {op.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
