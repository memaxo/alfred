"use client";

/**
 * Semantic Search - AI-powered code search using embeddings
 *
 * Search code by meaning, not just text matching.
 *
 * @see @alfred/embed package
 */

import {
  ChevronRight,
  FileCode,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type SemanticSearchProps = {
  className?: string;
  onResultSelect?: (file: string, line: number) => void;
};

type SearchResult = {
  id: string;
  file: string;
  line: number;
  content: string;
  score: number;
  context: string;
};

export function SemanticSearch({
  className,
  onResultSelect,
}: SemanticSearchProps) {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | null>(null);

  // Use tRPC to fetch semantic search results
  const { data, isLoading, error } = trpc.graph.getContext.useQuery(
    { text: searchQuery ?? "", topK: 10 },
    { enabled: Boolean(searchQuery) }
  );

  const handleSearch = () => {
    if (!query.trim()) {
      return;
    }
    setSearchQuery(query);
  };

  // Transform context items to search results
  const results: SearchResult[] = (data?.items ?? []).map((item) => ({
    id: item.id,
    file: item.title,
    line: 1, // Line info may not be available from semantic search
    content: item.content.slice(0, 200),
    score: item.relevance,
    context: item.content,
  }));

  const hasResults = searchQuery && results.length > 0;
  const noResults = searchQuery && !isLoading && results.length === 0 && !error;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Search Input */}
      <div className="border-white/5 border-b p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Semantic Search</span>
        </div>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-biolum-dim" />
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pr-3 pl-8 text-sm placeholder:text-biolum-dim focus:border-biolum focus:outline-none"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Describe what you're looking for..."
              value={query}
            />
          </div>
          <Button disabled={isLoading} onClick={handleSearch}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>
        <p className="mt-2 text-biolum-dim text-xs">
          Search by meaning: "function that handles user authentication" or
          "where errors are logged"
        </p>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {error && (
          <div className="p-4 text-center text-red-400 text-sm">
            Search failed. Please try again.
          </div>
        )}
        {noResults && (
          <div className="p-4 text-center text-biolum-dim text-sm">
            No results found for "{searchQuery}"
          </div>
        )}
        {hasResults && (
          <div className="space-y-2 p-3">
            <div className="text-biolum-dim text-xs">
              {results.length} results for "{searchQuery}"
            </div>

            {results.map((result) => (
              <button
                className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-colors hover:border-biolum/50 hover:bg-biolum/10"
                key={result.id}
                onClick={() => onResultSelect?.(result.file, result.line)}
                type="button"
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-biolum" />
                    <span className="font-mono text-sm">{result.file}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-mono text-xs",
                        result.score > 0.9
                          ? "text-green-400"
                          : result.score > 0.85
                            ? "text-yellow-400"
                            : "text-biolum-dim"
                      )}
                    >
                      {(result.score * 100).toFixed(0)}%
                    </span>
                    <ChevronRight className="h-4 w-4 text-biolum-dim" />
                  </div>
                </div>

                <code className="block rounded bg-void p-2 font-mono text-xs">
                  {result.content}
                </code>

                {result.context !== result.content && (
                  <p className="mt-2 line-clamp-2 text-biolum-dim text-xs">
                    {result.context}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
        {!searchQuery && (
          <div className="flex h-full items-center justify-center p-8 text-center text-biolum-dim">
            <div>
              <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>Enter a natural language query to search code</p>
              <p className="mt-1 text-xs">Powered by @alfred/embed</p>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
