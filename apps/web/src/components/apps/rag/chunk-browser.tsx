"use client";

/**
 * Chunk Browser - Browse document chunks
 */

import { FileText, Hash, Search } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Chunk } from "./index";

const mockChunks: Chunk[] = [
  {
    id: "chunk-1",
    documentId: "doc-1",
    content:
      "ALFRED is a personal AI assistant designed for developers. It provides intelligent code assistance, task automation, and knowledge management capabilities.",
    metadata: { source: "README.md", section: "overview" },
  },
  {
    id: "chunk-2",
    documentId: "doc-1",
    content:
      "The desktop shell provides a modern windowed interface with tiling support, voice commands, and deep integration with development workflows.",
    metadata: { source: "README.md", section: "features" },
  },
  {
    id: "chunk-3",
    documentId: "doc-2",
    content:
      "ReactFlow is isolated to the graphs/ directory to prevent bundle bloat in the desktop shell. All graph visualizations use this isolated pattern.",
    metadata: { source: "ARCHITECTURE.md", section: "isolation" },
  },
  {
    id: "chunk-4",
    documentId: "doc-3",
    content:
      "The cognitive loop manages ALFRED's state transitions between idle, thinking, and acting phases. Each transition is logged for learning purposes.",
    metadata: { source: "COGNITIVE.md", section: "loop" },
  },
];

export function ChunkBrowser() {
  const [search, setSearch] = useState("");
  const [selectedChunk, setSelectedChunk] = useState<Chunk | null>(null);

  const filtered = mockChunks.filter(
    (c) =>
      c.content.toLowerCase().includes(search.toLowerCase()) ||
      c.metadata.source?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full">
      {/* Chunk List */}
      <div className="w-80 border-white/5 border-r">
        <div className="border-white/5 border-b p-2">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-biolum-dim" />
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pr-3 pl-8 text-sm placeholder:text-biolum-dim focus:border-biolum focus:outline-none"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chunks..."
              value={search}
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100%-52px)]">
          <div className="space-y-2 p-2">
            {filtered.map((chunk) => (
              <button
                className={cn(
                  "w-full rounded-lg border border-white/10 bg-white/5 p-2 text-left transition-colors",
                  selectedChunk?.id === chunk.id &&
                    "border-biolum/50 bg-biolum/10"
                )}
                key={chunk.id}
                onClick={() => setSelectedChunk(chunk)}
                type="button"
              >
                <div className="mb-1 flex items-center gap-2">
                  <FileText className="h-3 w-3 text-biolum" />
                  <span className="truncate text-biolum-dim text-xs">
                    {chunk.metadata.source}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm">{chunk.content}</p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chunk Detail */}
      <div className="flex-1 p-4">
        {selectedChunk ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-biolum" />
              <span className="font-mono text-sm">{selectedChunk.id}</span>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-biolum-dim text-xs">Content</div>
              <p className="text-sm">{selectedChunk.content}</p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-biolum-dim text-xs">Metadata</div>
              <div className="space-y-1">
                {Object.entries(selectedChunk.metadata).map(([key, value]) => (
                  <div className="flex justify-between text-sm" key={key}>
                    <span className="text-biolum-dim">{key}</span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-biolum-dim">
            Select a chunk to view details
          </div>
        )}
      </div>
    </div>
  );
}
