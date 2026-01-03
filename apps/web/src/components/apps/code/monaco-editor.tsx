"use client";

/**
 * Monaco Editor - Code editor integration
 *
 * Note: This is a placeholder. Full Monaco integration requires:
 * - @monaco-editor/react package
 * - Custom ALFRED void theme
 * - Language server integration
 */

import { cn } from "@/lib/utils";

type MonacoEditorProps = {
  content: string;
  language: string;
  path: string;
  onChange: (content: string) => void;
  className?: string;
};

export function MonacoEditor({
  content,
  language,
  path,
  onChange,
  className,
}: MonacoEditorProps) {
  // Placeholder - will integrate actual Monaco editor
  return (
    <div
      className={cn(
        "h-full w-full overflow-auto bg-void p-4 font-mono text-sm",
        className
      )}
    >
      <textarea
        className="h-full w-full resize-none bg-transparent text-biolum outline-none"
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        value={content}
      />

      {/* Status bar */}
      <div className="absolute right-0 bottom-0 left-0 flex h-6 items-center justify-between border-white/5 border-t bg-void-surface px-3 text-biolum-dim text-xs">
        <div className="flex items-center gap-4">
          <span>{language}</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Ln 1, Col 1</span>
          <span>{path}</span>
        </div>
      </div>
    </div>
  );
}
