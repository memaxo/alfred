/**
 * Diff Panel - File diff viewer with inline comments
 */

import { ChevronDown, ChevronRight, File, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface DiffPanelProps {
  prId: string;
  className?: string;
}

interface FileDiff {
  path: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

interface DiffLine {
  type: "context" | "addition" | "deletion";
  content: string;
  lineNumber?: number;
}

// Mock diff data
const mockFiles: FileDiff[] = [
  {
    path: "apps/web/src/store/desktop/types.new.ts",
    additions: 150,
    deletions: 0,
    hunks: [
      {
        header: "@@ -0,0 +1,150 @@",
        lines: [
          { type: "addition", content: "/**", lineNumber: 1 },
          {
            type: "addition",
            content: " * New Desktop Types - Phase 0 Migration",
            lineNumber: 2,
          },
          { type: "addition", content: " */", lineNumber: 3 },
          { type: "addition", content: "", lineNumber: 4 },
          {
            type: "addition",
            content: "export type WindowType =",
            lineNumber: 5,
          },
          { type: "addition", content: '  | "chat"', lineNumber: 6 },
          { type: "addition", content: '  | "terminal"', lineNumber: 7 },
          { type: "addition", content: '  | "code";', lineNumber: 8 },
        ],
      },
    ],
  },
  {
    path: "apps/web/src/store/desktop/windows.ts",
    additions: 20,
    deletions: 45,
    hunks: [
      {
        header: "@@ -10,15 +10,10 @@",
        lines: [
          {
            type: "context",
            content: "import { create } from 'zustand';",
            lineNumber: 10,
          },
          {
            type: "deletion",
            content: "import { applyNodeChanges } from '@xyflow/react';",
            lineNumber: 11,
          },
          {
            type: "addition",
            content: "import type { WindowInstance } from './types.new';",
            lineNumber: 11,
          },
          { type: "context", content: "", lineNumber: 12 },
        ],
      },
    ],
  },
];

export function DiffPanel({ prId: _prId, className }: DiffPanelProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
    new Set(mockFiles.map((f) => f.path))
  );

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className={cn("flex flex-col bg-void", className)}>
      <div className="flex h-9 items-center justify-between border-white/5 border-b px-3">
        <span className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
          {mockFiles.length} files changed
        </span>
      </div>

      <ScrollArea className="flex-1">
        {mockFiles.map((file) => (
          <div className="border-white/5 border-b" key={file.path}>
            {/* File header */}
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5"
              onClick={() => toggleFile(file.path)}
              type="button"
            >
              {expandedFiles.has(file.path) ? (
                <ChevronDown className="h-4 w-4 text-biolum-dim" />
              ) : (
                <ChevronRight className="h-4 w-4 text-biolum-dim" />
              )}
              <File className="h-4 w-4 text-biolum-dim" />
              <span className="flex-1 truncate text-sm">{file.path}</span>
              <span className="text-green-400 text-xs">+{file.additions}</span>
              <span className="text-red-400 text-xs">-{file.deletions}</span>
            </button>

            {/* Diff content */}
            {expandedFiles.has(file.path) && (
              <div className="font-mono text-xs">
                {file.hunks.map((hunk, hunkIdx) => (
                  <div key={hunkIdx}>
                    <div className="bg-blue-500/10 px-3 py-1 text-blue-400">
                      {hunk.header}
                    </div>
                    {hunk.lines.map((line, lineIdx) => (
                      <DiffLineRow key={lineIdx} line={line} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const bgColor =
    line.type === "addition"
      ? "bg-green-500/10"
      : line.type === "deletion"
        ? "bg-red-500/10"
        : "";
  const textColor =
    line.type === "addition"
      ? "text-green-400"
      : line.type === "deletion"
        ? "text-red-400"
        : "text-biolum-dim";
  const prefix =
    line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " ";

  return (
    <div
      className={cn("group flex items-center px-3 hover:bg-white/5", bgColor)}
    >
      <span className="w-12 flex-shrink-0 select-none text-right text-biolum-faint">
        {line.lineNumber}
      </span>
      <span
        className={cn("w-4 flex-shrink-0 select-none text-center", textColor)}
      >
        {prefix}
      </span>
      <span className={cn("flex-1 whitespace-pre", textColor)}>
        {line.content}
      </span>
      <Button
        className="h-5 w-5 opacity-0 group-hover:opacity-100"
        size="icon"
        variant="ghost"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
