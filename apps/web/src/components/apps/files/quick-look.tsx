"use client";

/**
 * Quick Look - File preview modal
 */

import { File, FileCode, FileJson, FileText, Image, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { FileItem } from "./index";

interface QuickLookProps {
  file: FileItem;
  onClose: () => void;
}

// Mock file content
const mockContent = `/**
 * Example TypeScript file
 */

export function hello(name: string): string {
  return \`Hello, \${name}!\`;
}

export const config = {
  debug: true,
  version: "1.0.0",
};
`;

const fileIcons: Record<string, typeof File> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  json: FileJson,
  md: FileText,
  png: Image,
  jpg: Image,
};

export function QuickLook({ file, onClose }: QuickLookProps) {
  const Icon = fileIcons[file.extension || ""] || File;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex h-[80%] w-[60%] flex-col rounded-xl border border-white/10 bg-void-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-white/5 border-b p-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-biolum-dim" />
            <span className="font-medium">{file.name}</span>
          </div>
          <Button
            className="h-8 w-8"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {file.extension &&
          ["png", "jpg", "jpeg", "gif", "webp"].includes(file.extension) ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-white/5">
                <Image className="h-16 w-16 text-biolum-dim" />
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap rounded-lg bg-void p-4 font-mono text-biolum-dim text-sm">
              {mockContent}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-white/5 border-t p-3 text-biolum-dim text-xs">
          <span>{file.path}</span>
          {file.size && <span>{formatSize(file.size)}</span>}
        </div>
      </div>
    </div>
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
