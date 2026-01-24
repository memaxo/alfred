"use client";

/**
 * Tree Sidebar - Directory tree navigation
 */

import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type TreeSidebarProps = {
  currentPath: string;
  onNavigate: (path: string) => void;
  className?: string;
};

type TreeNode = {
  name: string;
  path: string;
  children?: TreeNode[];
};

// Mock tree structure
const mockTree: TreeNode[] = [
  {
    name: "workspace",
    path: "/workspace",
    children: [
      {
        name: "apps",
        path: "/workspace/apps",
        children: [
          { name: "web", path: "/workspace/apps/web" },
          { name: "native", path: "/workspace/apps/native" },
        ],
      },
      {
        name: "packages",
        path: "/workspace/packages",
        children: [
          { name: "api", path: "/workspace/packages/api" },
          { name: "db", path: "/workspace/packages/db" },
          { name: "ui", path: "/workspace/packages/ui" },
        ],
      },
      { name: "docs", path: "/workspace/docs" },
      { name: "scripts", path: "/workspace/scripts" },
    ],
  },
];

export function TreeSidebar({
  currentPath,
  onNavigate,
  className,
}: TreeSidebarProps) {
  return (
    <div className={cn("flex flex-col bg-void", className)}>
      <div className="flex h-9 items-center border-white/5 border-b px-3">
        <span className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
          Folders
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {mockTree.map((node) => (
            <TreeNodeRow
              currentPath={currentPath}
              key={node.path}
              level={0}
              node={node}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function TreeNodeRow({
  node,
  level,
  currentPath,
  onNavigate,
}: {
  node: TreeNode;
  level: number;
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(
    currentPath.startsWith(node.path) || level === 0
  );
  const hasChildren = node.children && node.children.length > 0;
  const isActive = currentPath === node.path;

  return (
    <div>
      <button
        className={cn(
          "flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm transition-colors",
          isActive ? "bg-biolum/10 text-biolum" : "hover:bg-white/5"
        )}
        onClick={() => {
          onNavigate(node.path);
          if (hasChildren) {
            setExpanded(!expanded);
          }
        }}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        type="button"
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-biolum-dim" />
          ) : (
            <ChevronRight className="h-3 w-3 text-biolum-dim" />
          )
        ) : (
          <div className="w-3" />
        )}
        {expanded && hasChildren ? (
          <FolderOpen className="h-4 w-4 text-yellow-400" />
        ) : (
          <Folder className="h-4 w-4 text-yellow-400" />
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {expanded &&
        hasChildren &&
        node.children?.map((child) => (
          <TreeNodeRow
            currentPath={currentPath}
            key={child.path}
            level={level + 1}
            node={child}
            onNavigate={onNavigate}
          />
        ))}
    </div>
  );
}
