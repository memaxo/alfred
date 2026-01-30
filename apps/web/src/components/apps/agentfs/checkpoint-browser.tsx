/**
 * Checkpoint Browser - Browse and restore checkpoints
 */

import { Archive, Calendar, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import type { Workspace } from "./index";

interface CheckpointBrowserProps {
  workspace: Workspace;
  onSelectWorkspace: (workspace: Workspace) => void;
  className?: string;
}

interface Checkpoint {
  id: string;
  name: string;
  createdAt: string;
  data?: unknown;
}

export function CheckpointBrowser({
  workspace,
  onSelectWorkspace,
  className,
}: CheckpointBrowserProps) {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.agentfs.checkpointsList.useQuery({
    runId: workspace.runId,
    dbPath: workspace.dbPath,
  });

  const cloneCheckpoint = trpc.agentfs.cloneCheckpoint.useMutation({
    onSuccess: (res) => {
      onSelectWorkspace({
        id: res.runId,
        runId: res.runId,
        dbPath: res.dbPath,
        projectId: workspace.projectId,
        agentType: "unknown",
        status: "completed",
        createdAt: new Date().toISOString(),
        operationCount: 0,
        checkpointCount: 0,
        pinned: false,
        retentionDays: null,
      });
      void utils.agentfs.workspacesList.invalidate();
    },
  });

  const checkpoints = data?.checkpoints ?? [];

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex h-9 items-center justify-between border-white/5 border-b px-3">
        <span className="font-medium text-biolum-dim text-xs">
          {checkpoints.length} checkpoints
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
            </div>
          )}
          {error && (
            <div className="py-2 text-center text-red-400 text-xs">
              Failed to load checkpoints
            </div>
          )}
          {!isLoading && checkpoints.length === 0 && !error && (
            <div className="py-4 text-center text-biolum-dim text-sm">
              No checkpoints found
            </div>
          )}
          {checkpoints.map((checkpoint) => (
            <CheckpointCard
              checkpoint={checkpoint}
              isRestoring={cloneCheckpoint.isPending}
              key={checkpoint.id}
              onRestore={() =>
                cloneCheckpoint.mutate({
                  runId: workspace.runId,
                  dbPath: workspace.dbPath,
                  checkpointId: checkpoint.id,
                })
              }
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function CheckpointCard({
  checkpoint,
  onRestore,
  isRestoring,
}: {
  checkpoint: Checkpoint;
  onRestore: () => void;
  isRestoring: boolean;
}) {
  const isAutomatic = checkpoint.name.includes("auto");

  return (
    <div className="mb-2 rounded-lg border border-white/5 bg-white/5 p-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-biolum-dim" />
          <div>
            <span className="font-medium text-sm">{checkpoint.name}</span>
            {isAutomatic && (
              <span className="ml-2 rounded bg-white/10 px-1 text-biolum-dim text-xs">
                auto
              </span>
            )}
          </div>
        </div>
        <Button
          className="h-7 gap-1 text-xs"
          disabled={isRestoring}
          onClick={onRestore}
          size="sm"
          variant="outline"
        >
          <RotateCcw className="h-3 w-3" />
          Restore
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-4 text-biolum-dim text-xs">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(checkpoint.createdAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
