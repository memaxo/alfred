"use client";

/**
 * Code Editor Application - Phase 2 Core Application
 *
 * Monaco-based code editor with AI completions and file operations.
 *
 * Features:
 * - Monaco Editor with ALFRED void theme
 * - Editor tabs with drag-and-drop reordering
 * - File tree sidebar
 * - AI suggestions overlay (Codex)
 * - Diff viewer
 * - Semantic search
 * - Git integration panel
 * - Split view editing
 * - Keyboard shortcuts (Cmd+S, Cmd+W, Cmd+P, Cmd+N)
 * - Settings persistence
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.2
 */

import {
  Code2,
  Columns,
  FilePlus,
  GitBranch,
  Loader2,
  PanelLeft,
  Save,
  Search,
  Settings,
  SplitSquareHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { AISuggestions } from "./ai-suggestions";
import { Breadcrumbs } from "./breadcrumbs";
import { DiffViewer } from "./diff-viewer";
import { EditorTabs } from "./editor-tabs";
import { FileSearch } from "./file-search";
import { FileTree } from "./file-tree";
import { GitPanel } from "./git-panel";
import {
  useEditorSettings,
  useKeyboardShortcuts,
  useUnsavedChangesWarning,
} from "./hooks";
import { MonacoEditor } from "./monaco-editor";
import { NewFileDialog } from "./new-file-dialog";
import { SemanticSearch } from "./semantic-search";
import { SettingsPanel } from "./settings-panel";
import type { FileTab, SplitDirection } from "./types";
import { getLanguageFromPath } from "./types";
import { UnsavedDialog } from "./unsaved-dialog";

type CodeAppProps = {
  windowId?: string;
  className?: string;
  initialPath?: string;
};

const ROOT_PATH = process.cwd?.() ?? "/Users/jackmazac/Development/alfred";

export function CodeApp({
  windowId: _windowId,
  className,
  initialPath: _initialPath,
}: CodeAppProps) {
  // UI State
  const [showFileTree, setShowFileTree] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSemanticSearch, setShowSemanticSearch] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);

  // Editor State
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Split View State
  const [splitDirection, setSplitDirection] = useState<SplitDirection>(null);
  const [secondaryActiveTabId, setSecondaryActiveTabId] = useState<
    string | null
  >(null);

  // AI & Diff State
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  // Unsaved Dialog State
  const [unsavedDialog, setUnsavedDialog] = useState<{
    isOpen: boolean;
    tabId: string;
    action: "close" | "switch";
  } | null>(null);

  // Hooks
  const { settings, updateSettings } = useEditorSettings();
  useUnsavedChangesWarning(tabs);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const secondaryTab = tabs.find((t) => t.id === secondaryActiveTabId);

  // File tree data for search
  const { data: treeData } = trpc.fs.tree.useQuery(
    { path: ROOT_PATH, depth: 5 },
    { staleTime: 60_000 }
  );

  type TreeNode = {
    name: string;
    path: string;
    type: "file" | "folder";
    children?: TreeNode[];
  };

  const flatFiles = useMemo(() => {
    const files: Array<{ path: string; name: string }> = [];
    const flatten = (nodes: TreeNode[] | undefined) => {
      if (!nodes) {
        return;
      }
      for (const node of nodes) {
        if (node.type === "file") {
          files.push({ path: node.path, name: node.name });
        } else if (node.children) {
          flatten(node.children);
        }
      }
    };
    flatten(treeData?.tree as TreeNode[] | undefined);
    return files;
  }, [treeData]);

  // Read file content
  const { data: fileData } = trpc.fs.read.useQuery(
    { path: pendingPath ?? "" },
    { enabled: Boolean(pendingPath) }
  );

  // Write file mutation
  const writeMutation = trpc.fs.write.useMutation({
    onSuccess: () => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, isDirty: false, originalContent: t.content }
            : t
        )
      );
      setIsSaving(false);
      toast.success("File saved");
    },
    onError: (error) => {
      setIsSaving(false);
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Update tab content when file is loaded
  useEffect(() => {
    if (fileData && pendingPath) {
      setTabs((prev) =>
        prev.map((t) =>
          t.path === pendingPath
            ? {
                ...t,
                content: fileData.content,
                originalContent: fileData.content,
                isLoading: false,
              }
            : t
        )
      );
      setPendingPath(null);
    }
  }, [fileData, pendingPath]);

  // Handlers
  const handleFileSelect = useCallback(
    (path: string) => {
      const existing = tabs.find((t) => t.path === path);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }

      const name = path.split("/").pop() ?? "untitled";
      const newTab: FileTab = {
        id: crypto.randomUUID(),
        path,
        name,
        language: getLanguageFromPath(path),
        content: "",
        isDirty: false,
        isLoading: true,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setPendingPath(path);
    },
    [tabs]
  );

  const handleSave = useCallback(() => {
    if (!activeTab?.isDirty || isSaving) {
      return;
    }
    setIsSaving(true);
    writeMutation.mutate({ path: activeTab.path, content: activeTab.content });
  }, [activeTab, isSaving, writeMutation]);

  const handleCloseTab = useCallback(
    (tabId?: string) => {
      const targetId = tabId ?? activeTabId;
      if (!targetId) {
        return;
      }

      const tab = tabs.find((t) => t.id === targetId);
      if (tab?.isDirty) {
        setUnsavedDialog({ isOpen: true, tabId: targetId, action: "close" });
        return;
      }

      setTabs((prev) => prev.filter((t) => t.id !== targetId));
      if (activeTabId === targetId) {
        const remaining = tabs.filter((t) => t.id !== targetId);
        setActiveTabId(remaining[0]?.id ?? null);
      }
    },
    [activeTabId, tabs]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, content, isDirty: t.originalContent !== content }
            : t
        )
      );
    },
    [activeTabId]
  );

  const handleTabReorder = useCallback((newTabs: FileTab[]) => {
    setTabs(newTabs);
  }, []);

  const handleNewFile = useCallback(() => {
    setShowNewFileDialog(true);
  }, []);

  const handleCreateFile = useCallback((path: string) => {
    const name = path.split("/").pop() ?? "untitled";
    const newTab: FileTab = {
      id: crypto.randomUUID(),
      path,
      name,
      language: getLanguageFromPath(path),
      content: "",
      originalContent: "",
      isDirty: true,
      isLoading: false,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const handleToggleSplit = useCallback(() => {
    if (splitDirection) {
      setSplitDirection(null);
      setSecondaryActiveTabId(null);
    } else {
      setSplitDirection("vertical");
      if (tabs.length > 1) {
        const otherTab = tabs.find((t) => t.id !== activeTabId);
        setSecondaryActiveTabId(otherTab?.id ?? null);
      }
    }
  }, [splitDirection, tabs, activeTabId]);

  const handleAcceptSuggestion = useCallback(
    (code: string) => {
      if (!activeTab) {
        return;
      }
      const lines = activeTab.content.split("\n");
      // Split the code if it contains multiple lines
      const codeLines = code.split("\\n");
      lines.splice(cursorPosition.line, 0, ...codeLines);
      handleContentChange(lines.join("\n"));
    },
    [activeTab, cursorPosition.line, handleContentChange]
  );

  const handleSemanticSearchSelect = useCallback(
    (file: string, _line: number) => {
      handleFileSelect(file);
      setShowSemanticSearch(false);
    },
    [handleFileSelect]
  );

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: handleSave,
    onCloseTab: () => handleCloseTab(),
    onOpenSearch: () => setShowSearch(true),
    onNewFile: handleNewFile,
    activeTab,
  });

  // Unsaved dialog handlers
  const handleUnsavedSave = useCallback(() => {
    if (!unsavedDialog) {
      return;
    }
    handleSave();
    setUnsavedDialog(null);
  }, [unsavedDialog, handleSave]);

  const handleUnsavedDiscard = useCallback(() => {
    if (!unsavedDialog) {
      return;
    }
    const { tabId } = unsavedDialog;
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (activeTabId === tabId) {
      const remaining = tabs.filter((t) => t.id !== tabId);
      setActiveTabId(remaining[0]?.id ?? null);
    }
    setUnsavedDialog(null);
  }, [unsavedDialog, activeTabId, tabs]);

  return (
    <div
      className={cn("flex h-full w-full flex-col bg-void-surface", className)}
      data-app="code"
    >
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-2">
        <div className="flex items-center gap-1">
          <Button
            className="h-7 w-7"
            onClick={() => setShowFileTree(!showFileTree)}
            size="icon"
            variant="ghost"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Button
            className={cn("h-7 w-7", showSearch && "bg-white/10")}
            onClick={() => setShowSearch(!showSearch)}
            size="icon"
            variant="ghost"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            className={cn("h-7 w-7", showGitPanel && "bg-white/10")}
            onClick={() => setShowGitPanel(!showGitPanel)}
            size="icon"
            variant="ghost"
          >
            <GitBranch className="h-4 w-4" />
          </Button>
          <Button
            className="h-7 w-7"
            onClick={handleNewFile}
            size="icon"
            variant="ghost"
          >
            <FilePlus className="h-4 w-4" />
          </Button>
          <Button
            className={cn("h-7 w-7", splitDirection && "bg-white/10")}
            onClick={handleToggleSplit}
            size="icon"
            variant="ghost"
          >
            <Columns className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {activeTab && (
            <span className="mr-2 text-biolum-dim text-xs">
              Ln {cursorPosition.line}, Col {cursorPosition.column}
            </span>
          )}
          <Button
            className="h-7 gap-1 text-xs"
            disabled={!activeTab?.isDirty || isSaving}
            onClick={handleSave}
            size="sm"
            variant="ghost"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Save
          </Button>
          {activeTab?.isDirty && activeTab.originalContent && (
            <Button
              className="h-7 gap-1 text-xs"
              onClick={() => setShowDiff(true)}
              size="sm"
              variant="ghost"
            >
              <SplitSquareHorizontal className="h-3 w-3" />
              Diff
            </Button>
          )}
          <Button
            className={cn("h-7 w-7", showSuggestions && "bg-white/10")}
            onClick={() => setShowSuggestions(!showSuggestions)}
            size="icon"
            variant="ghost"
          >
            <Code2 className="h-4 w-4" />
          </Button>
          <Button
            className={cn("h-7 w-7", showSettings && "bg-white/10")}
            onClick={() => setShowSettings(!showSettings)}
            size="icon"
            variant="ghost"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* File Tree */}
        {showFileTree && (
          <FileTree
            className="w-56 flex-shrink-0 border-white/5 border-r"
            onSelect={handleFileSelect}
            rootPath={ROOT_PATH}
            selectedPath={activeTab?.path}
          />
        )}

        {/* Editor Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tabs */}
          <EditorTabs
            activeId={activeTabId}
            onClose={handleCloseTab}
            onReorder={handleTabReorder}
            onSelect={setActiveTabId}
            tabs={tabs}
          />

          {/* Breadcrumbs */}
          {activeTab && (
            <Breadcrumbs
              onNavigate={(_path) => {
                // Could navigate to folder in file tree
              }}
              path={activeTab.path}
            />
          )}

          {/* Split View or Single Editor */}
          <div
            className={cn(
              "flex flex-1 overflow-hidden",
              splitDirection === "vertical" && "flex-row"
            )}
          >
            {/* Primary Editor */}
            {activeTab ? (
              <div
                className={cn(
                  "relative flex-1",
                  splitDirection && "border-white/5 border-r"
                )}
              >
                {activeTab.isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-biolum-dim" />
                  </div>
                ) : (
                  <MonacoEditor
                    content={activeTab.content}
                    language={activeTab.language}
                    onChange={handleContentChange}
                    onCursorChange={(line, column) =>
                      setCursorPosition({ line, column })
                    }
                    path={activeTab.path}
                    settings={settings}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-biolum-dim">
                <div className="text-center">
                  <Code2 className="mx-auto mb-4 h-12 w-12 opacity-20" />
                  <p>No file open</p>
                  <p className="mt-1 text-sm opacity-70">
                    Press <kbd className="rounded bg-white/10 px-1">Cmd+P</kbd>{" "}
                    to search files
                  </p>
                </div>
              </div>
            )}

            {/* Secondary Editor (Split View) */}
            {splitDirection && secondaryTab && (
              <div className="relative flex-1">
                {secondaryTab.isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-biolum-dim" />
                  </div>
                ) : (
                  <MonacoEditor
                    content={secondaryTab.content}
                    language={secondaryTab.language}
                    onChange={(content) => {
                      setTabs((prev) =>
                        prev.map((t) =>
                          t.id === secondaryActiveTabId
                            ? {
                                ...t,
                                content,
                                isDirty: t.originalContent !== content,
                              }
                            : t
                        )
                      );
                    }}
                    path={secondaryTab.path}
                    settings={settings}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Semantic Search Panel */}
        {showSemanticSearch && (
          <div className="w-80 border-white/5 border-l">
            <SemanticSearch onResultSelect={handleSemanticSearchSelect} />
          </div>
        )}

        {/* Git Panel */}
        {showGitPanel && (
          <GitPanel
            isOpen={showGitPanel}
            onClose={() => setShowGitPanel(false)}
            onFileSelect={handleFileSelect}
          />
        )}

        {/* AI Suggestions Overlay */}
        {showSuggestions && activeTab && (
          <AISuggestions
            currentCode={activeTab.content}
            cursorColumn={cursorPosition.column}
            cursorLine={cursorPosition.line}
            language={activeTab.language}
            onAccept={handleAcceptSuggestion}
            onDismiss={() => setShowSuggestions(false)}
            path={activeTab.path}
          />
        )}

        {/* Settings Panel */}
        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onUpdateSettings={updateSettings}
          settings={settings}
        />

        {/* File Search Modal */}
        <FileSearch
          files={flatFiles}
          isOpen={showSearch}
          onClose={() => setShowSearch(false)}
          onSelect={handleFileSelect}
        />
      </div>

      {/* Diff Viewer Modal */}
      {showDiff && activeTab && (
        <div className="absolute inset-0 z-50 bg-void">
          <DiffViewer
            fileName={activeTab.name}
            isOpen={showDiff}
            language={activeTab.language}
            modified={activeTab.content}
            onClose={() => setShowDiff(false)}
            original={activeTab.originalContent ?? ""}
          />
        </div>
      )}

      {/* Unsaved Changes Dialog */}
      {unsavedDialog && (
        <UnsavedDialog
          fileName={tabs.find((t) => t.id === unsavedDialog.tabId)?.name ?? ""}
          isOpen={unsavedDialog.isOpen}
          onCancel={() => setUnsavedDialog(null)}
          onDiscard={handleUnsavedDiscard}
          onSave={handleUnsavedSave}
        />
      )}

      {/* New File Dialog */}
      <NewFileDialog
        basePath={ROOT_PATH}
        isOpen={showNewFileDialog}
        onClose={() => setShowNewFileDialog(false)}
        onCreate={handleCreateFile}
      />
    </div>
  );
}

// Window wrapper
export function CodeAppWindow(props: WindowComponentProps) {
  return <CodeApp className="h-full" windowId={props.window.id} />;
}

export default CodeApp;
