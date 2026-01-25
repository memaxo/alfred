"use client";

import { FileCode, Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  files: { path: string; name: string }[];
  isLoading?: boolean;
  className?: string;
}

export function FileSearch({
  isOpen,
  onClose,
  onSelect,
  files,
  isLoading,
  className,
}: FileSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredFiles = query
    ? files.filter(
        (f) =>
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          f.path.toLowerCase().includes(query.toLowerCase())
      )
    : files.slice(0, 20);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredFiles.length - 1)
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === "Enter" && filteredFiles[selectedIndex]) {
        onSelect(filteredFiles[selectedIndex].path);
        onClose();
      }
    },
    [filteredFiles, selectedIndex, onSelect, onClose]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 z-50 mx-auto mt-16 w-full max-w-lg",
        className
      )}
    >
      <div className="overflow-hidden rounded-xl border border-biolum/20 bg-void-surface/95 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 border-white/5 border-b p-3">
          <Search className="h-4 w-4 text-biolum-dim" />
          <input
            className="flex-1 bg-transparent text-sm placeholder:text-biolum-dim focus:outline-none"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name or path..."
            ref={inputRef}
            value={query}
          />
          <Button
            className="h-6 w-6"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-biolum-dim" />
            </div>
          )}

          {!isLoading && filteredFiles.length === 0 && (
            <div className="py-8 text-center text-biolum-dim text-sm">
              {query ? `No files matching "${query}"` : "No files found"}
            </div>
          )}

          {!isLoading &&
            filteredFiles.map((file, index) => (
              <button
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                  index === selectedIndex
                    ? "bg-biolum/10 text-biolum"
                    : "text-biolum-dim hover:bg-white/5"
                )}
                key={file.path}
                onClick={() => {
                  onSelect(file.path);
                  onClose();
                }}
                type="button"
              >
                <FileCode className="h-4 w-4 flex-shrink-0" />
                <span className="truncate font-medium">{file.name}</span>
                <span className="truncate text-biolum-dim/70 text-xs">
                  {file.path}
                </span>
              </button>
            ))}
        </div>

        <div className="border-white/5 border-t px-3 py-2 text-biolum-dim text-xs">
          <kbd className="rounded bg-white/10 px-1">↑↓</kbd> Navigate{" "}
          <kbd className="ml-2 rounded bg-white/10 px-1">Enter</kbd> Open{" "}
          <kbd className="ml-2 rounded bg-white/10 px-1">Esc</kbd> Close
        </div>
      </div>
    </div>
  );
}
