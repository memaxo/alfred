"use client";

/**
 * File Browser Application - Phase 4 Knowledge & Integration
 *
 * Navigate filesystem with tree view, grid/list views, and Quick Look.
 *
 * Features:
 * - Tree sidebar for navigation
 * - Grid/list view with thumbnails
 * - Breadcrumb navigation
 * - Quick Look preview
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.6
 */

import { FolderOpen, LayoutGrid, List, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "./breadcrumbs";
import { FileGrid } from "./file-grid";
import { QuickLook } from "./quick-look";
import { TreeSidebar } from "./tree-sidebar";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type FilesAppProps = {
  windowId?: string;
  className?: string;
  initialPath?: string;
};

export type FileItem = {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  modifiedAt: Date;
  extension?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function FilesApp({
  windowId: _windowId,
  className,
  initialPath: _initialPath,
}: FilesAppProps) {
  const [currentPath, setCurrentPath] = useState("/workspace");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [quickLookFile, setQuickLookFile] = useState<FileItem | null>(null);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setSelectedFile(null);
  };

  const handleFileDoubleClick = (file: FileItem) => {
    if (file.type === "folder") {
      handleNavigate(file.path);
    } else {
      setQuickLookFile(file);
    }
  };

  return (
    <div
      className={cn("flex h-full w-full flex-col bg-void-surface", className)}
      data-app="files"
    >
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Files</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            className={cn(
              "h-7 w-7",
              viewMode === "grid" && "bg-biolum/10 text-biolum"
            )}
            onClick={() => setViewMode("grid")}
            size="icon"
            variant="ghost"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            className={cn(
              "h-7 w-7",
              viewMode === "list" && "bg-biolum/10 text-biolum"
            )}
            onClick={() => setViewMode("list")}
            size="icon"
            variant="ghost"
          >
            <List className="h-4 w-4" />
          </Button>
          <div className="mx-2 h-4 w-px bg-white/10" />
          <Button className="h-7 w-7" size="icon" variant="ghost">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Breadcrumbs */}
      <Breadcrumbs
        className="border-white/5 border-b px-3 py-2"
        onNavigate={handleNavigate}
        path={currentPath}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tree Sidebar */}
        <TreeSidebar
          className="w-56 flex-shrink-0 border-white/5 border-r"
          currentPath={currentPath}
          onNavigate={handleNavigate}
        />

        {/* File Grid/List */}
        <FileGrid
          className="flex-1"
          currentPath={currentPath}
          onDoubleClick={handleFileDoubleClick}
          onSelect={setSelectedFile}
          selectedFile={selectedFile}
          viewMode={viewMode}
        />
      </div>

      {/* Quick Look Modal */}
      {quickLookFile && (
        <QuickLook
          file={quickLookFile}
          onClose={() => setQuickLookFile(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function FilesAppWindow(props: WindowComponentProps) {
  return <FilesApp className="h-full" windowId={props.window.id} />;
}

export default FilesApp;
