"use client";

/**
 * File Grid - Grid/list view of files
 */

import {
  Edit2,
  ExternalLink,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  Image,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FileItem } from "./index";

type FileGridProps = {
  currentPath: string;
  viewMode: "grid" | "list";
  selectedFile: FileItem | null;
  onSelect: (file: FileItem) => void;
  onDoubleClick: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
  onRename?: (file: FileItem) => void;
  className?: string;
};

// Mock files
const mockFiles: FileItem[] = [
  {
    name: "src",
    path: "/workspace/src",
    type: "folder",
    modifiedAt: new Date(),
  },
  {
    name: "docs",
    path: "/workspace/docs",
    type: "folder",
    modifiedAt: new Date(),
  },
  {
    name: "package.json",
    path: "/workspace/package.json",
    type: "file",
    size: 1500,
    modifiedAt: new Date(),
    extension: "json",
  },
  {
    name: "tsconfig.json",
    path: "/workspace/tsconfig.json",
    type: "file",
    size: 800,
    modifiedAt: new Date(),
    extension: "json",
  },
  {
    name: "README.md",
    path: "/workspace/README.md",
    type: "file",
    size: 2500,
    modifiedAt: new Date(),
    extension: "md",
  },
  {
    name: "index.ts",
    path: "/workspace/index.ts",
    type: "file",
    size: 350,
    modifiedAt: new Date(),
    extension: "ts",
  },
];

const fileIcons: Record<string, typeof File> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  json: FileJson,
  md: FileText,
  png: Image,
  jpg: Image,
};

export function FileGrid({
  currentPath: _currentPath,
  viewMode,
  selectedFile,
  onSelect,
  onDoubleClick,
  onDelete,
  onRename,
  className,
}: FileGridProps) {
  return (
    <ScrollArea className={cn("bg-void", className)}>
      {viewMode === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-4 p-4">
          {mockFiles.map((file) => (
            <GridItem
              file={file}
              isSelected={selectedFile?.path === file.path}
              key={file.path}
              onDelete={onDelete}
              onDoubleClick={() => onDoubleClick(file)}
              onRename={onRename}
              onSelect={() => onSelect(file)}
            />
          ))}
        </div>
      ) : (
        <div className="p-2">
          {mockFiles.map((file) => (
            <ListItem
              file={file}
              isSelected={selectedFile?.path === file.path}
              key={file.path}
              onDelete={onDelete}
              onDoubleClick={() => onDoubleClick(file)}
              onRename={onRename}
              onSelect={() => onSelect(file)}
            />
          ))}
        </div>
      )}
    </ScrollArea>
  );
}

function GridItem({
  file,
  isSelected,
  onSelect,
  onDoubleClick,
  onDelete,
  onRename,
}: {
  file: FileItem;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  onDelete?: (file: FileItem) => void;
  onRename?: (file: FileItem) => void;
}) {
  const Icon =
    file.type === "folder" ? Folder : fileIcons[file.extension || ""] || File;
  const iconColor =
    file.type === "folder" ? "text-yellow-400" : "text-biolum-dim";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg p-3 transition-colors",
            isSelected ? "bg-biolum/10 text-biolum" : "hover:bg-white/5"
          )}
          onClick={onSelect}
          onDoubleClick={onDoubleClick}
          type="button"
        >
          <Icon className={cn("h-10 w-10", iconColor)} />
          <span className="max-w-full truncate text-xs">{file.name}</span>
        </button>
      </ContextMenuTrigger>
      <FileContextMenu
        file={file}
        onDelete={onDelete}
        onOpen={onDoubleClick}
        onRename={onRename}
      />
    </ContextMenu>
  );
}

function ListItem({
  file,
  isSelected,
  onSelect,
  onDoubleClick,
  onDelete,
  onRename,
}: {
  file: FileItem;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  onDelete?: (file: FileItem) => void;
  onRename?: (file: FileItem) => void;
}) {
  const Icon =
    file.type === "folder" ? Folder : fileIcons[file.extension || ""] || File;
  const iconColor =
    file.type === "folder" ? "text-yellow-400" : "text-biolum-dim";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          className={cn(
            "mb-1 flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
            isSelected ? "bg-biolum/10 text-biolum" : "hover:bg-white/5"
          )}
          onClick={onSelect}
          onDoubleClick={onDoubleClick}
          type="button"
        >
          <Icon className={cn("h-5 w-5 flex-shrink-0", iconColor)} />
          <span className="flex-1 truncate text-sm">{file.name}</span>
          {file.size && (
            <span className="text-biolum-dim text-xs">
              {formatSize(file.size)}
            </span>
          )}
          <span className="text-biolum-dim text-xs">
            {file.modifiedAt.toLocaleDateString()}
          </span>
        </button>
      </ContextMenuTrigger>
      <FileContextMenu
        file={file}
        onDelete={onDelete}
        onOpen={onDoubleClick}
        onRename={onRename}
      />
    </ContextMenu>
  );
}

function FileContextMenu({
  file,
  onOpen,
  onRename,
  onDelete,
}: {
  file: FileItem;
  onOpen: () => void;
  onRename?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
}) {
  return (
    <ContextMenuContent className="border-white/10 bg-void-surface/95 backdrop-blur-xl">
      <ContextMenuItem
        className="gap-2 text-biolum-dim hover:bg-white/5 hover:text-biolum focus:bg-white/5 focus:text-biolum"
        onClick={onOpen}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open
      </ContextMenuItem>
      <ContextMenuSeparator className="bg-white/5" />
      <ContextMenuItem
        className="gap-2 text-biolum-dim hover:bg-white/5 hover:text-biolum focus:bg-white/5 focus:text-biolum"
        onClick={() => onRename?.(file)}
      >
        <Edit2 className="h-3.5 w-3.5" />
        Rename
      </ContextMenuItem>
      <ContextMenuItem
        className="gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300"
        onClick={() => onDelete?.(file)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
