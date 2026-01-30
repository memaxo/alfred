/**
 * Chunk Browser - Browse document chunks with semantic search
 */

import { FileText, Hash, Loader2, Search } from "lucide-react";
import { useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface RagChunk {
  id: string;
  source: string;
  content: string;
  score: number;
  metadata: {
    section?: string;
    lastUpdated?: string;
  };
}

export function ChunkBrowser() {
  const [search, setSearch] = useState("");
  const [selectedChunk, setSelectedChunk] = useState<RagChunk | null>(null);

  const { data, isLoading, refetch } = trpc.graph.getRagChunks.useQuery(
    { text: search || "knowledge", topK: 20 },
    { enabled: true }
  );

  const chunks = data?.chunks ?? [];

  const handleSearch = () => {
    if (search.trim()) {
      refetch();
    }
  };

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
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Semantic search chunks..."
              value={search}
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100%-52px)]">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-biolum" />
            </div>
          ) : (chunks.length === 0 ? (
            <div className="p-4 text-center text-biolum-dim text-sm">
              No chunks found. Try a different search query.
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {chunks.map((chunk) => (
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
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3 text-biolum" />
                      <span className="truncate text-biolum-dim text-xs">
                        {chunk.source}
                      </span>
                    </div>
                    <span className="font-mono text-biolum text-xs">
                      {(chunk.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm">{chunk.content}</p>
                </button>
              ))}
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chunk Detail */}
      <div className="flex-1 p-4">
        {selectedChunk ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-biolum" />
                <span className="font-mono text-sm">{selectedChunk.id}</span>
              </div>
              <span className="font-mono text-biolum text-lg">
                {(selectedChunk.score * 100).toFixed(1)}%
              </span>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-biolum-dim text-xs">Source</div>
              <p className="font-mono text-sm">{selectedChunk.source}</p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-biolum-dim text-xs">Content</div>
              <p className="whitespace-pre-wrap text-sm">
                {selectedChunk.content}
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-biolum-dim text-xs">Metadata</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-biolum-dim">section</span>
                  <span className="font-mono">
                    {selectedChunk.metadata.section ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-biolum-dim">lastUpdated</span>
                  <span className="font-mono">
                    {selectedChunk.metadata.lastUpdated ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-biolum-dim text-xs">
                Relevance Score
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-biolum"
                  style={{ width: `${selectedChunk.score * 100}%` }}
                />
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
