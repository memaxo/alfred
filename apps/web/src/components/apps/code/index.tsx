"use client";

/**
 * Code Editor Application - Phase 2 Core Application
 *
 * Monaco-based code editor with AI completions and file operations.
 *
 * Features:
 * - Monaco Editor with ALFRED void theme
 * - Editor tabs for multiple files
 * - File tree sidebar
 * - AI suggestions overlay (Codex)
 * - Diff viewer
 * - Semantic search
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.2
 */

import { Code2, GitBranch, PanelLeft, Play, Search } from "lucide-react";
import { useCallback, useState } from "react";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AISuggestions } from "./ai-suggestions";
import { EditorTabs } from "./editor-tabs";
import { FileTree } from "./file-tree";
import { MonacoEditor } from "./monaco-editor";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type CodeAppProps = {
  windowId?: string;
  className?: string;
  initialPath?: string;
};

type FileTab = {
  id: string;
  path: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function CodeApp({
  windowId: _windowId,
  className,
  initialPath: _initialPath,
}: CodeAppProps) {
  const [showFileTree, setShowFileTree] = useState(true);
  const [tabs, setTabs] = useState<FileTab[]>([
    {
      id: "1",
      path: "/src/components/desktop/shell.tsx",
      name: "shell.tsx",
      language: "typescript",
      content: "// Desktop shell component",
      isDirty: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("1");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleFileSelect = useCallback(
    (path: string) => {
      // Check if already open
      const existing = tabs.find((t) => t.path === path);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }

      // Open new tab
      const name = path.split("/").pop() ?? "untitled";
      const extension = name.split(".").pop() ?? "";
      const languageMap: Record<string, string> = {
        ts: "typescript",
        tsx: "typescriptreact",
        js: "javascript",
        jsx: "javascriptreact",
        json: "json",
        md: "markdown",
        css: "css",
        html: "html",
      };

      const newTab: FileTab = {
        id: crypto.randomUUID(),
        path,
        name,
        language: languageMap[extension] ?? "plaintext",
        content: `// Loading ${path}...`,
        isDirty: false,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    },
    [tabs]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => prev.filter((t) => t.id !== tabId));
      if (activeTabId === tabId && tabs.length > 1) {
        const remaining = tabs.filter((t) => t.id !== tabId);
        setActiveTabId(remaining[0]?.id ?? "");
      }
    },
    [activeTabId, tabs]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, content, isDirty: true } : t
        )
      );
    },
    [activeTabId]
  );

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
          <Button className="h-7 w-7" size="icon" variant="ghost">
            <Search className="h-4 w-4" />
          </Button>
          <Button className="h-7 w-7" size="icon" variant="ghost">
            <GitBranch className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button className="h-7 gap-1 text-xs" size="sm" variant="ghost">
            <Play className="h-3 w-3" />
            Run
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* File Tree */}
        {showFileTree && (
          <FileTree
            className="w-56 flex-shrink-0 border-white/5 border-r"
            onSelect={handleFileSelect}
            selectedPath={activeTab?.path}
          />
        )}

        {/* Editor Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tabs */}
          <EditorTabs
            activeId={activeTabId}
            onClose={handleCloseTab}
            onSelect={setActiveTabId}
            tabs={tabs}
          />

          {/* Monaco Editor */}
          {activeTab ? (
            <div className="relative flex-1">
              <MonacoEditor
                content={activeTab.content}
                language={activeTab.language}
                onChange={handleContentChange}
                path={activeTab.path}
              />

              {/* AI Suggestions Overlay */}
              {showSuggestions && (
                <AISuggestions onDismiss={() => setShowSuggestions(false)} />
              )}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-biolum-dim">
              <div className="text-center">
                <Code2 className="mx-auto mb-4 h-12 w-12 opacity-20" />
                <p>No file open</p>
                <p className="mt-1 text-sm opacity-70">
                  Select a file from the tree
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function CodeAppWindow(props: WindowComponentProps) {
  return <CodeApp className="h-full" windowId={props.window.id} />;
}

export default CodeApp;
