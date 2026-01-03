"use client";

/**
 * Retrieval Debugger - Debug retrieval queries
 */

import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type RetrievalResult = {
  chunkId: string;
  score: number;
  content: string;
  reranked: boolean;
};

const mockResults: RetrievalResult[] = [
  {
    chunkId: "chunk-1",
    score: 0.92,
    content: "ALFRED is a personal AI assistant designed for developers...",
    reranked: true,
  },
  {
    chunkId: "chunk-4",
    score: 0.87,
    content: "The cognitive loop manages ALFRED's state transitions...",
    reranked: true,
  },
  {
    chunkId: "chunk-2",
    score: 0.78,
    content: "The desktop shell provides a modern windowed interface...",
    reranked: false,
  },
  {
    chunkId: "chunk-3",
    score: 0.65,
    content: "ReactFlow is isolated to the graphs/ directory...",
    reranked: false,
  },
];

export function RetrievalDebugger() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RetrievalResult[] | null>(null);

  const handleSearch = () => {
    setResults(mockResults);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Query Input */}
      <div className="border-white/5 border-b p-4">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-biolum-dim focus:border-biolum focus:outline-none"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a retrieval query..."
            value={query}
          />
          <Button className="gap-1" onClick={handleSearch}>
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {results ? (
          <div className="space-y-3 p-4">
            <div className="text-biolum-dim text-sm">
              {results.length} results • Top-k: 4 • Reranking: enabled
            </div>

            {results.map((result, idx) => (
              <div
                className="rounded-lg border border-white/10 bg-white/5 p-3"
                key={result.chunkId}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-biolum/20 font-mono text-biolum text-sm">
                      {idx + 1}
                    </span>
                    <span className="font-mono text-sm">{result.chunkId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.reranked && (
                      <span className="rounded bg-purple-500/20 px-2 py-0.5 text-purple-400 text-xs">
                        Reranked
                      </span>
                    )}
                    <span className="font-mono text-biolum">
                      {(result.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <p className="text-sm">{result.content}</p>

                {/* Score breakdown */}
                <div className="mt-2 h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-biolum"
                    style={{ width: `${result.score * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-biolum-dim">
            Enter a query to debug retrieval
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
