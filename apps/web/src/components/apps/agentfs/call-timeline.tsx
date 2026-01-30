/**
 * Call Timeline - Chronological operation history
 */

import { File, FolderPlus, Loader2, Pencil, Trash2 } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import type { Workspace } from "./index";

interface CallTimelineProps {
  workspace: Workspace;
  className?: string;
}

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

export function CallTimeline({ workspace, className }: CallTimelineProps) {
  const { data, isLoading, error } = trpc.agentfs.operationsList.useQuery({
    runId: workspace.runId,
    dbPath: workspace.dbPath,
    limit: 100,
  });

  const operations = data?.operations ?? [];

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex h-9 items-center justify-between border-white/5 border-b px-3">
        <span className="font-medium text-biolum-dim text-xs">
          {operations.length} operations
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
            </div>
          )}
          {error && (
            <div className="py-2 text-center text-red-400 text-xs">
              Failed to load operations
            </div>
          )}
          {!isLoading && operations.length === 0 && !error && (
            <div className="py-4 text-center text-biolum-dim text-sm">
              No operations recorded
            </div>
          )}
          {/* Timeline */}
          {operations.length > 0 && (
            <div className="relative border-biolum/20 border-l pl-6">
              {operations.map((op) => {
                const Icon = typeIcons[op.type] ?? File;
                const color = typeColors[op.type] ?? "text-blue-400";
                return (
                  <div className="relative mb-4" key={op.id}>
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "-left-[25px] absolute flex h-4 w-4 items-center justify-center rounded-full bg-void",
                        color
                      )}
                    >
                      <div className="h-2 w-2 rounded-full bg-current" />
                    </div>

                    {/* Operation card */}
                    <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", color)} />
                        <span className="font-medium text-sm capitalize">
                          {op.type}
                        </span>
                        <span className="text-biolum-dim text-xs">
                          {op.duration}ms
                        </span>
                      </div>
                      <p className="mt-1 truncate font-mono text-biolum-dim text-xs">
                        {op.path || op.name}
                      </p>
                      {op.bytesAffected && (
                        <p className="mt-1 text-biolum-faint text-xs">
                          {op.bytesAffected} bytes
                        </p>
                      )}
                      <p className="mt-1 text-biolum-faint text-xs">
                        {new Date(op.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
