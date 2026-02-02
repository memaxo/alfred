/**
 * Retrieval Debugger - Debug retrieval queries with live API
 */

import { Loader2, Search, Settings } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/utils/trpc";

export function RetrievalDebugger() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(10);
  const [submitted, setSubmitted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { data, isLoading, refetch } = trpc.graph.getRagChunks.useQuery(
    { text: query, topK },
    { enabled: submitted && query.length > 0 }
  );

  const results = data?.chunks ?? null;

  const handleSearch = () => {
    if (query.trim()) {
      setSubmitted(true);
      refetch();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Query Input */}
      <div className="border-white/5 border-b p-4">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-biolum-dim focus:border-biolum focus:outline-none"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Enter a retrieval query..."
            value={query}
          />
          <Button
            className="gap-1"
            disabled={isLoading || !query.trim()}
            onClick={handleSearch}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
          <Button
            onClick={() => setShowSettings(!showSettings)}
            size="icon"
            variant="outline"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {showSettings && (
          <div className="mt-3 flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2">
              <label className="text-biolum-dim text-sm">Top-K:</label>
              <input
                className="w-16 rounded border border-white/10 bg-white/5 px-2 py-1 text-sm"
                max={20}
                min={1}
                onChange={(e) =>
                  setTopK(Math.min(20, Math.max(1, Number(e.target.value))))
                }
                type="number"
                value={topK}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-biolum" />
            <span className="ml-2 text-biolum-dim">Searching...</span>
          </div>
        ) : results ? (
          <div className="space-y-3 p-4">
            <div className="text-biolum-dim text-sm">
              {results.length} results • Top-k: {topK} • Semantic search
            </div>

            {results.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center text-biolum-dim">
                No results found for "{query}"
              </div>
            ) : (
              results.map((result, idx) => (
                <div
                  className="rounded-lg border border-white/10 bg-white/5 p-3"
                  key={result.id}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-biolum/20 font-mono text-biolum text-sm">
                        {idx + 1}
                      </span>
                      <span className="max-w-[200px] truncate font-mono text-biolum-dim text-xs">
                        {result.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-biolum">
                        {(result.score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <p className="line-clamp-3 text-sm">{result.content}</p>

                  {/* Score breakdown */}
                  <div className="mt-2 h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-biolum transition-all"
                      style={{ width: `${result.score * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
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
