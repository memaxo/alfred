"use client";

/**
 * File Audit - File change history
 */

import { Edit, File, Minus, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type FileAuditProps = {
  workspaceId: string;
  className?: string;
};

type FileChange = {
  path: string;
  changeType: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  operations: number;
};

// Mock file changes
const mockFileChanges: FileChange[] = [
  {
    path: "src/components/desktop/shell.tsx",
    changeType: "added",
    additions: 150,
    deletions: 0,
    operations: 1,
  },
  {
    path: "src/components/desktop/menubar.tsx",
    changeType: "added",
    additions: 120,
    deletions: 0,
    operations: 1,
  },
  {
    path: "src/store/desktop/types.new.ts",
    changeType: "added",
    additions: 380,
    deletions: 0,
    operations: 2,
  },
  {
    path: "src/store/desktop/windows.ts",
    changeType: "modified",
    additions: 45,
    deletions: 30,
    operations: 3,
  },
  {
    path: "src/old-component.tsx",
    changeType: "deleted",
    additions: 0,
    deletions: 85,
    operations: 1,
  },
];

export function FileAudit({
  workspaceId: _workspaceId,
  className,
}: FileAuditProps) {
  const totalAdditions = mockFileChanges.reduce((a, f) => a + f.additions, 0);
  const totalDeletions = mockFileChanges.reduce((a, f) => a + f.deletions, 0);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Summary */}
      <div className="flex items-center gap-4 border-white/5 border-b px-4 py-3">
        <span className="text-biolum-dim text-sm">
          {mockFileChanges.length} files changed
        </span>
        <span className="text-green-400 text-sm">+{totalAdditions}</span>
        <span className="text-red-400 text-sm">-{totalDeletions}</span>
      </div>

      {/* File list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {mockFileChanges.map((file) => (
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
