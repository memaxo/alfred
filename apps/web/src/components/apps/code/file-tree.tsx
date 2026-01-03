"use client";

/**
 * File Tree - File navigation sidebar
 */

import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type FileTreeProps = {
  onSelect: (path: string) => void;
  selectedPath?: string;
  className?: string;
  rootPath?: string;
};

type TreeNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
};

function getFileIcon(name: string) {
  if (name.endsWith(".tsx") || name.endsWith(".ts")) {
    return FileCode;
  }
  if (name.endsWith(".json")) {
    return FileJson;
  }
  return FileText;
}

export function FileTree({
  onSelect,
  selectedPath,
  className,
  rootPath = process.cwd?.() ?? "/Users/jackmazac/Development/alfred",
}: FileTreeProps) {
  // Fetch the file tree from the backend
  const { data, isLoading, error } = trpc.fs.tree.useQuery(
    { path: rootPath, depth: 4 },
    { staleTime: 30_000 } // Cache for 30 seconds
  );

  const tree = data?.tree ?? [];

  return (
    <div className={cn("flex flex-col bg-void", className)}>
      <div className="flex h-9 items-center border-white/5 border-b px-3">
        <span className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
          Explorer
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
              Failed to load files
            </div>
          )}
          {!isLoading && tree.length === 0 && !error && (
            <div className="py-2 text-center text-biolum-dim text-xs">
              No files found
            </div>
          )}
          {tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function TreeItem({
  node,
  onSelect,
  selectedPath,
  depth = 0,
}: {
  node: TreeNode;
  onSelect: (path: string) => void;
  selectedPath?: string;
  depth?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const isSelected = node.path === selectedPath;
  const isFolder = node.type === "folder";

  const handleClick = () => {
    if (isFolder) {
      setIsExpanded(!isExpanded);
    } else {
      onSelect(node.path);
    }
  };

  const Icon = isFolder
    ? isExpanded
      ? FolderOpen
      : Folder
    : getFileIcon(node.name);

  return (
    <div>
      <button
        className={cn(
          "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-sm transition-colors",
          isSelected
            ? "bg-biolum/10 text-biolum"
            : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
        )}
        onClick={handleClick}
        style={{ paddingLeft: depth * 12 + 4 }}
        type="button"
      >
        {isFolder && (
          <span className="flex h-4 w-4 items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        )}
        {!isFolder && <span className="w-4" />}
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>

      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              depth={depth + 1}
              key={child.path}
              node={child}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}
