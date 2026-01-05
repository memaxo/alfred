"use client";

/**
 * File Audit - File change history
 */

import { Edit, File, Loader2, Minus, Plus } from "lucide-react";
import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import type { Workspace } from "./index";

type FileAuditProps = {
  workspace: Workspace;
  className?: string;
};

type FileChange = {
  path: string;
  changeType: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  operations: number;
};

export function FileAudit({ workspace, className }: FileAuditProps) {
  const { data, isLoading, error } = trpc.agentfs.operationsList.useQuery({
    runId: workspace.runId,
    dbPath: workspace.dbPath,
    limit: 500,
  });

  // Group operations by file path and compute change stats
  const fileChanges = useMemo(() => {
    const operations = data?.operations ?? [];
    const byPath = new Map<
      string,
      { type: string; count: number; bytes: number }
    >();

    for (const op of operations) {
      const path = op.path || "unknown";
      const existing = byPath.get(path) ?? { type: "read", count: 0, bytes: 0 };
      existing.count += 1;
      existing.bytes += op.bytesAffected ?? 0;
      if (op.type === "write") {
        existing.type = "modified";
      }
      if (op.type === "delete") {
        existing.type = "deleted";
      }
      byPath.set(path, existing);
    }

    return Array.from(byPath.entries()).map(
      ([path, stats]): FileChange => ({
        path,
        changeType:
          stats.type === "deleted"
            ? "deleted"
            : stats.type === "modified"
              ? "modified"
              : "added",
        additions: stats.type !== "deleted" ? stats.bytes : 0,
        deletions: stats.type === "deleted" ? stats.bytes : 0,
        operations: stats.count,
      })
    );
  }, [data]);

  const totalAdditions = fileChanges.reduce((a, f) => a + f.additions, 0);
  const totalDeletions = fileChanges.reduce((a, f) => a + f.deletions, 0);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Summary */}
      <div className="flex items-center gap-4 border-white/5 border-b px-4 py-3">
        <span className="text-biolum-dim text-sm">
          {fileChanges.length} files changed
        </span>
        <span className="text-green-400 text-sm">+{totalAdditions}</span>
        <span className="text-red-400 text-sm">-{totalDeletions}</span>
      </div>

      {/* File list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
            </div>
          )}
          {error && (
            <div className="py-2 text-center text-red-400 text-xs">
              Failed to load file changes
            </div>
          )}
          {!isLoading && fileChanges.length === 0 && !error && (
            <div className="py-4 text-center text-biolum-dim text-sm">
              No file changes recorded
            </div>
          )}
          {fileChanges.map((file) => (
            <FileChangeRow file={file} key={file.path} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function FileChangeRow({ file }: { file: FileChange }) {
  const Icon =
    file.changeType === "added"
      ? Plus
      : file.changeType === "deleted"
        ? Minus
        : Edit;
  const iconColor =
    file.changeType === "added"
      ? "text-green-400"
      : file.changeType === "deleted"
        ? "text-red-400"
        : "text-yellow-400";

  return (
    <div className="mb-1 flex items-center gap-2 rounded-lg p-2 hover:bg-white/5">
      <Icon className={cn("h-4 w-4 flex-shrink-0", iconColor)} />
      <File className="h-4 w-4 flex-shrink-0 text-biolum-dim" />
      <span className="flex-1 truncate font-mono text-sm">{file.path}</span>
      <span className="text-green-400 text-xs">+{file.additions}</span>
      <span className="text-red-400 text-xs">-{file.deletions}</span>
      <span className="text-biolum-dim text-xs">{file.operations} ops</span>
    </div>
  );
}
