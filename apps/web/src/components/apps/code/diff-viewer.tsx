import { DiffEditor } from "@monaco-editor/react";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  isOpen: boolean;
  onClose: () => void;
  original: string;
  modified: string;
  fileName: string;
  language: string;
  className?: string;
}

export function DiffViewer({
  isOpen,
  onClose,
  original,
  modified,
  fileName,
  language,
  className,
}: DiffViewerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!(isOpen && mounted)) {
    return null;
  }

  const additions = countDiffLines(original, modified, "+");
  const deletions = countDiffLines(original, modified, "-");

  return (
    <div className={cn("flex h-full flex-col bg-void", className)}>
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">Diff: {fileName}</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-400">+{additions}</span>
            <span className="text-red-400">-{deletions}</span>
          </div>
        </div>
        <Button
          className="h-7 w-7"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1">
        <DiffEditor
          height="100%"
          language={language}
          modified={modified}
          options={{
            readOnly: true,
            renderSideBySide: true,
            automaticLayout: true,
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
          }}
          original={original}
          theme="vs-dark"
        />
      </div>
    </div>
  );
}

function countDiffLines(
  original: string,
  modified: string,
  type: "+" | "-"
): number {
  const originalLines = original.split("\n");
  const modifiedLines = modified.split("\n");

  if (type === "+") {
    return Math.max(0, modifiedLines.length - originalLines.length);
  }
  return Math.max(0, originalLines.length - modifiedLines.length);
}
